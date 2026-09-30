import { useEffect, useState } from 'react';
import type { Db } from '@/db/games';
import { type LoadedReport, loadGameReport } from './load';

type Loaded = LoadedReport | null;

/**
 * A game's after-action report. Pass null to load nothing (e.g. mid-game).
 * `version` should change whenever the game's balls do, such as after an undo.
 */
export function useGameReport(db: Db, gameId: string | null, version = 0): Loaded | undefined {
  const [state, setState] = useState<{ key: string; value: Loaded } | null>(null);
  const key = `${gameId}:${version}`;

  useEffect(() => {
    if (gameId === null) return;
    let cancelled = false;
    void loadGameReport(db, gameId).then((value) => {
      if (!cancelled) setState({ key: `${gameId}:${version}`, value });
    });
    return () => {
      cancelled = true;
    };
  }, [db, gameId, version]);

  // undefined while loading, so a previous game's report is never shown for this one.
  if (gameId === null) return null;
  return state?.key === key ? state.value : undefined;
}
