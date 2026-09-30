import type { Db } from './games';

export interface Settings {
  /** Vibrate on pin taps, recorded balls and level-ups. */
  readonly haptics: boolean;
  /** Stop the phone sleeping while a session is open. */
  readonly keepAwake: boolean;
  /** Show the best score still reachable during a game. */
  readonly showBestPossible: boolean;
}

export const DEFAULT_SETTINGS: Settings = { haptics: true, keepAwake: true, showBestPossible: true };

/**
 * Stored settings over the defaults. A key that's missing, unknown or of the
 * wrong type falls back to its default, so a new setting needs no migration.
 */
export async function fetchSettings(db: Db): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    const parsed = parseJson(value);
    if (typeof parsed === typeof DEFAULT_SETTINGS[key as keyof Settings]) settings[key] = parsed;
  }
  return settings as unknown as Settings;
}

export async function saveSetting<K extends keyof Settings>(db: Db, key: K, value: Settings[K]): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
