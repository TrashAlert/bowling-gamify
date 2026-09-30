import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Db } from '@/db/games';
import { DEFAULT_SETTINGS, type Settings, fetchSettings, saveSetting } from '@/db/settings';

interface SettingsContextValue {
  readonly settings: Settings;
  readonly update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

// Outside a provider (e.g. a component test), every setting has its default.
const SettingsContext = createContext<SettingsContextValue>({ settings: DEFAULT_SETTINGS, update: async () => {} });

/**
 * Loads settings once and shares them app-wide. Children render straight away
 * with the defaults; SQLite answers in milliseconds, so there's no loading state.
 */
export function SettingsProvider({ db, children }: { db: Db; children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void fetchSettings(db).then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const update = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      await saveSetting(db, key, value);
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [db],
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
