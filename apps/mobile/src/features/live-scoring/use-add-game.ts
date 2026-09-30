import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import type { Db } from '@/db/games';
import { addGame } from './add-game';

/**
 * Adds a game and opens it. Ignores taps while one is in flight, so a double
 * tap on "+" can't start two sessions.
 */
export function useAddGame(db: Db): () => Promise<void> {
  const busy = useRef(false);
  return useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const sessionId = await addGame(db);
      router.push(`/session/${sessionId}`);
    } finally {
      busy.current = false;
    }
  }, [db]);
}
