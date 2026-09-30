import { type DeliveryInput, type ScoredGame, scoreGame } from '@bowling-rpg/scoring';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Db, type StoredGame, appendDelivery, endSession, fetchCurrentGame, removeLastDelivery, startNextGame } from '@/db/games';

export type LiveGame =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | {
      readonly status: 'ready';
      readonly game: StoredGame;
      readonly scored: ScoredGame;
      readonly record: (delivery: DeliveryInput) => Promise<void>;
      readonly undo: () => Promise<void>;
      readonly nextGame: () => Promise<void>;
      readonly end: () => Promise<void>;
    };

/**
 * The current game of a session. Every change is written to SQLite before the
 * screen updates, so what's on screen is always what's saved.
 *
 * While a write is in flight, further actions are ignored: a double tap on
 * "Strike" must record one strike, not two.
 */
export function useLiveGame(db: Db, sessionId: string): LiveGame {
  const [game, setGame] = useState<StoredGame | null | undefined>(undefined);
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetchCurrentGame(db, sessionId).then((loaded) => {
      if (!cancelled) setGame(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [db, sessionId]);

  const scored = useMemo(() => {
    if (!game) return null;
    const result = scoreGame(game.deliveries);
    // Stored deliveries were each checked before being written.
    return result.ok ? result.game : null;
  }, [game]);

  const exclusive = useCallback(async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
    } finally {
      busy.current = false;
    }
  }, []);

  if (game === undefined) return { status: 'loading' };
  if (game === null || scored === null) return { status: 'missing' };

  return {
    status: 'ready',
    game,
    scored,
    record: (delivery) =>
      exclusive(async () => {
        const deliveries = [...game.deliveries, delivery];
        if (!scoreGame(deliveries).ok) return; // the pad can't produce this, but never store an illegal ball
        await appendDelivery(db, game.gameId, delivery);
        setGame({ ...game, deliveries });
      }),
    undo: () =>
      exclusive(async () => {
        if (game.deliveries.length === 0) return;
        await removeLastDelivery(db, game.gameId);
        setGame({ ...game, deliveries: game.deliveries.slice(0, -1) });
      }),
    nextGame: () =>
      exclusive(async () => {
        await startNextGame(db, sessionId);
        setGame(await fetchCurrentGame(db, sessionId));
      }),
    end: () => exclusive(() => endSession(db, sessionId)),
  };
}
