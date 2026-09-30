import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { Db } from '@/db/games';
import { type History, loadHistory } from './load';

/** Game history with everything derived from it, reloaded whenever the screen comes into view. */
export function useHistory(db: Db): History | null {
  const [history, setHistory] = useState<History | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadHistory(db).then((loaded) => {
        if (!cancelled) setHistory(loaded);
      });
      return () => {
        cancelled = true;
      };
    }, [db]),
  );
  return history;
}
