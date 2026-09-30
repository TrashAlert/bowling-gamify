import type { ClientSessionId, SessionId, UserId } from '@bowling-rpg/contracts';
import { type Database, frames, games, sessions, throws } from '@bowling-rpg/db';
import { and, eq } from 'drizzle-orm';

export type NewSession = typeof sessions.$inferInsert;
export type NewGame = typeof games.$inferInsert;
export type NewFrame = typeof frames.$inferInsert;
export type NewThrow = typeof throws.$inferInsert;

export async function fetchSessionIdByClientId(db: Database, userId: UserId, clientId: ClientSessionId): Promise<SessionId | null> {
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.clientId, clientId)));
  return row ? (row.id as SessionId) : null;
}

/**
 * Inserts the session unless this user already has one with the same client ID.
 * Returns null when it already existed: a concurrent upload of the same session won.
 */
export async function insertSessionIfAbsent(db: Database, session: NewSession & { userId: UserId }): Promise<SessionId | null> {
  const [row] = await db
    .insert(sessions)
    .values(session)
    .onConflictDoNothing({ target: [sessions.userId, sessions.clientId] })
    .returning({ id: sessions.id });
  return row ? (row.id as SessionId) : null;
}

/** One statement per table. A 30-game session is ~630 throws, well under Postgres's parameter limit. */
export async function insertGameRecords(
  db: Database,
  records: { games: readonly NewGame[]; frames: readonly NewFrame[]; throws: readonly NewThrow[] },
): Promise<void> {
  await db.insert(games).values([...records.games]);
  await db.insert(frames).values([...records.frames]);
  await db.insert(throws).values([...records.throws]);
}
