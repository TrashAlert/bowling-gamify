import { usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import type { Db } from '@/db/games';
import { type GameInProgress, findGameInProgress } from './add-game';

/**
 * The unfinished game, if any, for components that stay mounted (the tab bar).
 * Re-checked on every navigation, which is exactly when it can change: leaving
 * a game, ending a session, deleting all games.
 */
export function useGameInProgress(db: Db): { game: GameInProgress | null; refresh: () => void } {
  const pathname = usePathname();
  const [game, setGame] = useState<GameInProgress | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void findGameInProgress(db).then((found) => {
      if (!cancelled) setGame(found);
    });
    return () => {
      cancelled = true;
    };
  }, [db, pathname, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { game, refresh };
}
