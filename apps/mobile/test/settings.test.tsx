import { FULL_RACK } from '@bowling-rpg/scoring';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Text } from 'react-native';
import { PinDeck } from '@/components/PinDeck';
import { ActionRow, InfoRow, SwitchRow } from '@/components/SettingRow';
import { countGames, deleteAllGames, fetchExport } from '@/db/backup';
import { appendDelivery, endSession, startNextGame, startSession } from '@/db/games';
import { DEFAULT_SETTINGS, fetchSettings, saveSetting } from '@/db/settings';
import { SettingsProvider, useSettings } from '@/features/settings/settings-context';
import { shareExport } from '@/features/settings/share-export';
import { createMemoryDb } from './memory-db';

// The file system is native; record what the export writes instead.
jest.mock('expo-file-system', () => {
  const mockFiles: { name: string; content: string; uri: string }[] = [];
  class File {
    readonly name: string;
    readonly uri: string;
    constructor(_directory: unknown, fileName: string) {
      this.name = fileName;
      this.uri = `file:///cache/${fileName}`;
    }
    create() {
      mockFiles.push({ name: this.name, content: '', uri: this.uri });
    }
    write(content: string) {
      mockFiles.at(-1)!.content = content;
    }
  }
  return { File, Paths: { cache: 'cache' }, mockFiles };
});
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const { mockFiles } = jest.requireMock<{ mockFiles: { name: string; content: string; uri: string }[] }>('expo-file-system');

let db: SQLiteDatabase;
beforeEach(async () => {
  db = await createMemoryDb();
  jest.clearAllMocks();
});

describe('stored settings', () => {
  it('are the defaults on a fresh install', async () => {
    expect(await fetchSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trip, and saving twice keeps the last value', async () => {
    await saveSetting(db, 'haptics', false);
    await saveSetting(db, 'keepAwake', false);
    await saveSetting(db, 'keepAwake', true);
    expect(await fetchSettings(db)).toEqual({ ...DEFAULT_SETTINGS, haptics: false, keepAwake: true });
  });

  it('ignore unknown keys, wrong types and broken JSON', async () => {
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('retired', 'true'), ('haptics', '\"no\"'), ('keepAwake', '{oops')");
    expect(await fetchSettings(db)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('the settings provider', () => {
  function Probe() {
    const { settings, update } = useSettings();
    return (
      <Text onPress={() => void update('showBestPossible', !settings.showBestPossible)}>
        best:{String(settings.showBestPossible)}
      </Text>
    );
  }

  const renderWithSettings = async (ui: React.ReactElement) => {
    await render(<SettingsProvider db={db}>{ui}</SettingsProvider>);
    await act(async () => {});
  };

  it('loads stored settings and saves changes', async () => {
    await saveSetting(db, 'showBestPossible', false);
    await renderWithSettings(<Probe />);
    expect(screen.getByText('best:false')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('best:false'));
    expect(screen.getByText('best:true')).toBeOnTheScreen();
    expect((await fetchSettings(db)).showBestPossible).toBe(true);
  });

  it('silences every vibration when Vibration is off', async () => {
    const selection = jest.spyOn(Haptics, 'selectionAsync').mockResolvedValue();
    await saveSetting(db, 'haptics', false);
    await renderWithSettings(<PinDeck standing={FULL_RACK} selected={0 as never} onToggle={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('pin-7'));
    expect(selection).not.toHaveBeenCalled();
  });

  it('vibrates by default', async () => {
    const selection = jest.spyOn(Haptics, 'selectionAsync').mockResolvedValue();
    await renderWithSettings(<PinDeck standing={FULL_RACK} selected={0 as never} onToggle={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('pin-7'));
    expect(selection).toHaveBeenCalledTimes(1);
  });
});

describe('your data', () => {
  async function bowlTwoSessions() {
    const first = await startSession(db, new Date('2026-09-20T19:00:00Z'));
    await appendDelivery(db, first.gameId, { knocked: FULL_RACK }, new Date('2026-09-20T19:05:00Z'));
    await appendDelivery(db, first.gameId, { knocked: 7, foul: true }, new Date('2026-09-20T19:06:00Z'));
    await startNextGame(db, first.sessionId);
    await endSession(db, first.sessionId, new Date('2026-09-20T21:00:00Z'));
    const open = await startSession(db, new Date('2026-09-27T19:00:00Z'));
    return { first, open };
  }

  it('exports every session, game and ball, oldest first', async () => {
    const { first, open } = await bowlTwoSessions();
    const exported = await fetchExport(db, new Date('2026-09-30T08:00:00Z'));

    expect(exported).toEqual({
      format: 'bowling-rpg.export',
      version: 1,
      exportedAt: '2026-09-30T08:00:00.000Z',
      sessions: [
        {
          clientId: first.sessionId,
          startedAt: '2026-09-20T19:00:00.000Z',
          endedAt: '2026-09-20T21:00:00.000Z',
          games: [
            {
              gameNumber: 1,
              deliveries: [
                { knocked: FULL_RACK, foul: false, thrownAt: '2026-09-20T19:05:00.000Z' },
                { knocked: 7, foul: true, thrownAt: '2026-09-20T19:06:00.000Z' },
              ],
            },
          ],
        },
        { clientId: open.sessionId, startedAt: '2026-09-27T19:00:00.000Z', endedAt: null, games: [{ gameNumber: 1, deliveries: [] }] },
      ],
    });
  });

  it('exports an empty list from a fresh install', async () => {
    expect((await fetchExport(db)).sessions).toEqual([]);
  });

  it('counts games, and deletes them all while keeping settings', async () => {
    await bowlTwoSessions();
    await saveSetting(db, 'haptics', false);
    expect(await countGames(db)).toBe(2);

    await deleteAllGames(db);
    expect(await countGames(db)).toBe(0);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM deliveries')).toEqual({ n: 0 });
    expect((await fetchSettings(db)).haptics).toBe(false);
  });

  it('writes the export to a dated file and opens the share sheet', async () => {
    await bowlTwoSessions();
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);

    expect(await shareExport(db, new Date('2026-09-30T08:00:00Z'))).toBe('shared');
    const file = mockFiles.at(-1)!;
    expect(file.name).toBe('bowling-rpg-2026-09-30.json');
    expect(JSON.parse(file.content).sessions).toHaveLength(2);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(file.uri, expect.objectContaining({ mimeType: 'application/json' }));
  });

  it('reports when the device cannot share', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
    expect(await shareExport(db)).toBe('unavailable');
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe('setting rows', () => {
  it('a switch row reports the new value', async () => {
    const onChange = jest.fn();
    await render(<SwitchRow label="Vibration" description="On pin taps." value onChange={onChange} />);
    await fireEvent(screen.getByLabelText('Vibration'), 'valueChange', false);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.getByText('On pin taps.')).toBeOnTheScreen();
  });

  it('a disabled action does nothing', async () => {
    const onPress = jest.fn();
    await render(<ActionRow label="Delete all games" onPress={onPress} disabled destructive />);
    await fireEvent.press(screen.getByText('Delete all games'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('an info row reads as one line', async () => {
    await render(<InfoRow label="Version" value="1.0.0" />);
    expect(screen.getByLabelText('Version: 1.0.0')).toBeOnTheScreen();
  });
});
