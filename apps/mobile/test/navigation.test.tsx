import { FULL_RACK } from '@bowling-rpg/scoring';
import { act, fireEvent, renderHook, screen } from '@testing-library/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Stack, router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Alert, type AlertButton, Text } from 'react-native';
import TabsLayout from '@/app/(tabs)/_layout';
import { appendDelivery, endSession, fetchCurrentGame, startSession } from '@/db/games';
import { addGame, findGameInProgress } from '@/features/live-scoring/add-game';
import { useAddGame } from '@/features/live-scoring/use-add-game';
import { createMemoryDb } from './memory-db';

// The "+" button reads the database through the SQLite context.
let mockDb: SQLiteDatabase;
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));

beforeEach(async () => {
  mockDb = await createMemoryDb();
});

const countSessions = async () => (await mockDb.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sessions'))!.n;

async function bowlPerfectGame(gameId: string) {
  for (let i = 0; i < 12; i++) await appendDelivery(mockDb, gameId, { knocked: FULL_RACK });
}

describe('adding a game', () => {
  it('starts a session when none is open', async () => {
    const sessionId = await addGame(mockDb);
    expect(await fetchCurrentGame(mockDb, sessionId)).toMatchObject({ gameNumber: 1, deliveries: [] });
  });

  it('goes back to a game still being bowled rather than starting another', async () => {
    const { sessionId, gameId } = await startSession(mockDb);
    await appendDelivery(mockDb, gameId, { knocked: FULL_RACK });

    expect(await addGame(mockDb)).toBe(sessionId);
    expect(await fetchCurrentGame(mockDb, sessionId)).toMatchObject({ gameId, gameNumber: 1 });
  });

  it('adds the next game once the last one is finished', async () => {
    const { sessionId, gameId } = await startSession(mockDb);
    await bowlPerfectGame(gameId);

    expect(await addGame(mockDb)).toBe(sessionId);
    expect(await fetchCurrentGame(mockDb, sessionId)).toMatchObject({ gameNumber: 2, deliveries: [] });
  });

  it('starts a fresh session after the last one was ended', async () => {
    const ended = await startSession(mockDb, new Date('2026-09-20T19:00:00Z'));
    await bowlPerfectGame(ended.gameId);
    await endSession(mockDb, ended.sessionId);

    expect(await addGame(mockDb)).not.toBe(ended.sessionId);
    expect(await countSessions()).toBe(2);
  });
});

describe('finding a game in progress', () => {
  it('is nothing on a fresh install', async () => {
    expect(await findGameInProgress(mockDb)).toBeNull();
  });

  it('finds a started game, even one with no balls yet', async () => {
    const { sessionId } = await startSession(mockDb);
    expect(await findGameInProgress(mockDb)).toMatchObject({ sessionId, gameNumber: 1 });
  });

  it('ignores a finished game and an ended session', async () => {
    const { sessionId, gameId } = await startSession(mockDb);
    await bowlPerfectGame(gameId);
    expect(await findGameInProgress(mockDb)).toBeNull();

    await addGame(mockDb); // game 2, unfinished
    await endSession(mockDb, sessionId);
    expect(await findGameInProgress(mockDb)).toBeNull();
  });
});

/**
 * The real tab layout under a root stack, as in the app: the tabs stay mounted
 * underneath a game, so the tab bar has to notice changes itself. Stand-in screens.
 */
async function renderApp() {
  await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': () => <Text>home screen</Text>,
      '(tabs)/progress': () => <Text>progress screen</Text>,
      '(tabs)/add': () => <Text>add screen</Text>,
      '(tabs)/bestiary': () => <Text>bestiary screen</Text>,
      settings: () => <Text>settings screen</Text>,
      'profile/index': () => <Text>profile screen</Text>,
      'session/[id]': () => <Text>session screen</Text>,
    },
    { initialUrl: '/' },
  );
}

describe('navigation', () => {
  it('opens on Home, even though Home is the right-hand tab', async () => {
    await renderApp();
    expect(screen.getByText('home screen')).toBeOnTheScreen();
  });

  it('lays the bar out as Progress, +, Home, with the bestiary hidden', async () => {
    await renderApp();
    const bar = screen
      .getAllByRole('button')
      .map((button) => String(button.props.accessibilityLabel ?? ''))
      .filter((label) => /Progress|Add game|Home|Bestiary/.test(label));
    expect(bar.map((label) => label.split(',')[0])).toEqual(['Progress', 'Add game', 'Home']);
  });

  it('opens Settings from the gear', async () => {
    await renderApp();
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(await screen.findByText('settings screen')).toBeOnTheScreen();
  });

  it('opens your profile from the avatar, top right', async () => {
    await renderApp();
    await fireEvent.press(screen.getByLabelText('Profile'));
    expect(await screen.findByText('profile screen')).toBeOnTheScreen();
  });

  it('opens a new game from +', async () => {
    await renderApp();
    await fireEvent.press(screen.getByLabelText('Add game'));
    expect(await screen.findByText('session screen')).toBeOnTheScreen();
    expect(await countSessions()).toBe(1);
  });

  it('starts one session, not two, when + is double-tapped', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    try {
      const { result } = await renderHook(() => useAddGame(mockDb));
      // Two taps land before the first one's database write finishes.
      await act(async () => {
        await Promise.all([result.current(), result.current()]);
      });
      expect(await countSessions()).toBe(1);
      expect(push).toHaveBeenCalledTimes(1);
    } finally {
      push.mockRestore(); // even on failure, so later tests navigate for real
    }
  });

  it('turns + into play/pause after backing out of a started game', async () => {
    await renderApp();
    expect(screen.getByTestId('icon-add')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Add game'));
    await screen.findByText('session screen');
    await act(async () => router.back());

    expect(await screen.findByLabelText('Game in progress')).toBeOnTheScreen();
    expect(screen.getByTestId('icon-play-pause')).toBeOnTheScreen();
  });

  describe('choosing what to do with a paused game', () => {
    let buttons: AlertButton[];
    beforeEach(async () => {
      const { gameId } = await startSession(mockDb);
      await appendDelivery(mockDb, gameId, { knocked: FULL_RACK });
      jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, given) => {
        buttons = given ?? [];
      });
      await renderApp();
      await fireEvent.press(await screen.findByLabelText('Game in progress'));
    });
    const tap = async (text: string) => act(async () => buttons.find((b) => b.text === text)!.onPress!());

    it('asks Continue or Stop, with the game and score', () => {
      expect(Alert.alert).toHaveBeenCalledWith('Game 1 in progress', expect.stringContaining('Frame 2, score 0'), expect.anything(), {
        cancelable: true,
      });
      expect(buttons.map((b) => b.text)).toEqual(['Stop game', 'Continue']);
    });

    it('Continue goes back to the game', async () => {
      await tap('Continue');
      expect(await screen.findByText('session screen')).toBeOnTheScreen();
      expect(await findGameInProgress(mockDb)).not.toBeNull();
    });

    it('Stop ends the session, keeps the ball, and brings + back', async () => {
      await tap('Stop game');
      expect(await findGameInProgress(mockDb)).toBeNull();
      expect(await mockDb.getFirstAsync('SELECT COUNT(*) AS n FROM deliveries')).toEqual({ n: 1 });
      expect(await screen.findByLabelText('Add game')).toBeOnTheScreen();
    });
  });
});
