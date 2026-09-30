import { FULL_RACK, type DeliveryInput, maskFromPins, without } from '@bowling-rpg/scoring';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GameReportView } from '@/components/GameReportView';
import { LevelCard } from '@/components/LevelCard';
import { MiniRack } from '@/components/MiniRack';
import { appendDelivery, endSession, startNextGame, startSession } from '@/db/games';
import { attemptsAt, gameStats, levelsReached, loadGameReport, loadHistory } from '@/features/history/load';
import { useGameReport } from '@/features/history/use-game-report';
import { useHistory } from '@/features/history/use-history';
import { formatDay, formatPercent } from '@/lib/format';
import { createMemoryDb } from './memory-db';

// Outside a navigator, "focus" is simply mount. Jest hoists this above the
// imports, so React has to be required inside the factory.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]) };
});

const pins = (...p: number[]) => maskFromPins(p);
const leave = (...p: number[]): DeliveryInput => ({ knocked: without(FULL_RACK, pins(...p)) });
const hit = (...p: number[]): DeliveryInput => ({ knocked: pins(...p) });

let db: SQLiteDatabase;
beforeEach(async () => {
  db = await createMemoryDb();
});

/** One session, one game per entry, each game's balls in order. */
async function bowl(...games: DeliveryInput[][]) {
  const { sessionId, gameId } = await startSession(db, new Date('2026-09-28T19:00:00Z'));
  const ids = [gameId];
  for (const [i, balls] of games.entries()) {
    if (i > 0) ids.push(await startNextGame(db, sessionId));
    for (const ball of balls) await appendDelivery(db, ids[i]!, ball);
  }
  await endSession(db, sessionId);
  return ids;
}

describe('loading history from the phone', () => {
  it('builds it from every stored ball, oldest game first', async () => {
    const [first, second] = await bowl([leave(7, 10), hit(7)], [leave(7, 10), hit(7, 10), leave(10), hit(10)]);
    const data = await loadHistory(db);

    expect(data.games.map((g) => g.gameId)).toEqual([first, second]);
    expect(data.bestiary.map((e) => [e.name ?? e.leave, e.attempts, e.conversions, e.firstSeenGameId])).toEqual([
      ['Bedposts', 2, 1, first],
      [pins(10), 1, 1, second],
    ]);
  });

  it('lists every attempt at a leave, newest first', async () => {
    const [first, second] = await bowl([leave(7, 10), hit(7)], [leave(7, 10), hit(7, 10)]);
    const attempts = attemptsAt(await loadHistory(db), pins(7, 10));
    expect(attempts.map((a) => [a.game.gameId, a.encounter.converted])).toEqual([
      [second, true],
      [first, false],
    ]);
  });

  it('reports a game against the whole bestiary', async () => {
    const [first, second] = await bowl([leave(7, 10), hit(7)], [leave(7, 10), hit(7, 10)]);
    expect((await loadGameReport(db, first!))?.report.monsters[0]?.isNew).toBe(true);
    expect((await loadGameReport(db, second!))?.report.monsters[0]?.isNew).toBe(false);
    expect(await loadGameReport(db, 'missing')).toBeNull();
  });
});

describe('hooks', () => {
  it('useHistory loads on focus', async () => {
    await bowl([leave(10), hit(10)]);
    const { result } = await renderHook(() => useHistory(db));
    await act(async () => {});
    expect(result.current?.bestiary).toHaveLength(1);
  });

  it('useGameReport loads nothing mid-game, and reloads when the balls change', async () => {
    const [gameId] = await bowl([leave(10), hit(10)]);
    const { result, rerender } = await renderHook((props: { id: string | null; version: number }) => useGameReport(db, props.id, props.version), {
      initialProps: { id: null, version: 0 },
    });
    expect(result.current).toBeNull();

    await rerender({ id: gameId!, version: 2 });
    await act(async () => {});
    expect(result.current?.report.spares).toBe(1);

    await appendDelivery(db, gameId!, { knocked: FULL_RACK }); // a strike in frame 2
    await rerender({ id: gameId!, version: 3 });
    await act(async () => {});
    expect(result.current?.report.strikes).toBe(1);
  });
});

describe('components', () => {
  it('the report shows the numbers and every monster, and opens one when tapped', async () => {
    const [gameId] = await bowl([leave(7, 10), hit(7), leave(10), hit(10)]);
    const loaded = await loadGameReport(db, gameId!);
    const onMonsterPress = jest.fn();
    await render(<GameReportView report={loaded!.report} showMonsters onMonsterPress={onMonsterPress} />);

    expect(screen.getByText('Monsters · 1 of 2 slain · 2 new')).toBeOnTheScreen();
    expect(screen.getByLabelText('Splits 0/1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bedposts, 7-10, Boss, new, ✗ Escaped')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('10, Minion, new, ✓ Slain'));
    expect(onMonsterPress).toHaveBeenCalledWith(pins(10));
  });

  it('the report says so when nothing survived the first ball', async () => {
    const [gameId] = await bowl(Array.from({ length: 12 }, () => ({ knocked: FULL_RACK })));
    const loaded = await loadGameReport(db, gameId!);
    await render(<GameReportView report={loaded!.report} showMonsters />);
    expect(screen.getByText('No spares needed. Nothing survived the first ball.')).toBeOnTheScreen();
    expect(screen.getByText('Final score')).toBeOnTheScreen();
  });

  it('the mini rack describes its leave', async () => {
    await render(<MiniRack leave={pins(4, 6, 7, 10)} />);
    expect(screen.getByLabelText('Leave 4-6-7-10')).toBeOnTheScreen();
  });
});

const PERFECT: DeliveryInput[] = Array.from({ length: 12 }, () => ({ knocked: FULL_RACK }));
/** Ten 9-spares with a 9 fill: 190. */
const NINE_SPARES: DeliveryInput[] = [...Array.from({ length: 10 }, () => [leave(10), hit(10)]).flat(), hit(1, 2, 3, 4, 5, 6, 7, 8, 9)];

describe('XP and levels', () => {
  // Reduced motion makes the XP bar jump straight to its value instead of animating after the test ends.
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });

  /** Renders, then lets the XP bar's reduced-motion check resolve inside act. */
  const renderSettled = async (ui: ReactElement) => {
    await render(ui);
    await act(async () => {});
  };

  it('each finished game earns its score, and history adds up to a level', async () => {
    const [perfect, spares, unfinished] = await bowl(PERFECT, NINE_SPARES, [leave(10)]);
    const { progression } = await loadHistory(db);

    expect(progression.gains.map((g) => g.xp)).toEqual([300, 190, 0]);
    expect(progression.current).toMatchObject({ level: 1, totalXp: 490, xpToNext: 10 });
    expect((await loadGameReport(db, spares!))?.xp.before.totalXp).toBe(300);
    expect((await loadGameReport(db, perfect!))?.xp.xp).toBe(300);
    expect((await loadGameReport(db, unfinished!))?.xp.xp).toBe(0);
  });

  it('the report shows XP earned, and celebrates a level-up', async () => {
    const celebrate = jest.spyOn(Haptics, 'notificationAsync').mockResolvedValue();
    const [, second] = await bowl(PERFECT, PERFECT);
    const loaded = await loadGameReport(db, second!);
    await renderSettled(<GameReportView report={loaded!.report} xp={loaded!.xp} />);

    expect(screen.getByText('+300 XP')).toBeOnTheScreen();
    expect(screen.getByText('LEVEL UP · Level 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Level 2')).toHaveAccessibilityValue({ now: 100, max: 750 });
    expect(celebrate).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    // The bestiary is hidden unless asked for.
    expect(screen.queryByText(/Monsters/)).toBeNull();
  });

  it('the report shows no level-up when there was none', async () => {
    const [gameId] = await bowl(NINE_SPARES);
    const loaded = await loadGameReport(db, gameId!);
    await renderSettled(<GameReportView report={loaded!.report} xp={loaded!.xp} />);
    expect(screen.getByText('+190 XP')).toBeOnTheScreen();
    expect(screen.queryByText(/LEVEL UP/)).toBeNull();
  });

  it('an unfinished game earns nothing, and says so', async () => {
    const [gameId] = await bowl([leave(10), hit(10)]);
    const loaded = await loadGameReport(db, gameId!);
    await renderSettled(<GameReportView report={loaded!.report} xp={loaded!.xp} />);
    expect(screen.getByText('Finish a game to earn XP.')).toBeOnTheScreen();
  });

  it('the level card shows what is left to the next level', async () => {
    await bowl(PERFECT);
    const { progression } = await loadHistory(db);
    const onPress = jest.fn();
    await renderSettled(<LevelCard progress={progression.current} onPress={onPress} />);

    expect(screen.getByText('200 XP to level 2 · 300 XP total')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Progress numbers and Home level markers', () => {
  it('count finished games only', async () => {
    await bowl(PERFECT, NINE_SPARES, [leave(10), hit(10)]);
    expect(gameStats(await loadHistory(db))).toEqual({ games: 2, average: 245, best: 300 });
  });

  it('are zero with nothing bowled', async () => {
    expect(gameStats(await loadHistory(db))).toEqual({ games: 0, average: 0, best: 0 });
  });

  it('mark the games that reached a new level', async () => {
    // 300, then 600 (level 2 at 500), then 790 (level 3 is 1250, so no marker).
    const [first, second, third] = await bowl(PERFECT, PERFECT, NINE_SPARES);
    const reached = levelsReached(await loadHistory(db));
    expect([...reached]).toEqual([[second, 2]]);
    expect(reached.has(first!)).toBe(false);
    expect(reached.has(third!)).toBe(false);
  });
});

describe('formatting', () => {
  it('rounds percentages', () => {
    expect(formatPercent(2 / 3)).toBe('67%');
  });

  it('formats a day in the phone’s own timezone', () => {
    // Local noon, so the calendar day is the 28th wherever the test runs.
    expect(formatDay(new Date(2026, 8, 28, 12).toISOString())).toMatch(/28/);
  });
});
