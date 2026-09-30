import type { UserId } from '@bowling-rpg/contracts';
import { type Database, balls, houses, oilPatterns } from '@bowling-rpg/db';
import { and, eq, inArray } from 'drizzle-orm';

/** The subset of `ballIds` that belong to this user. Another user's ball looks exactly like a missing one. */
export async function fetchOwnedBallIds(db: Database, userId: UserId, ballIds: readonly string[]): Promise<Set<string>> {
  if (ballIds.length === 0) return new Set();
  const rows = await db
    .select({ id: balls.id })
    .from(balls)
    .where(and(eq(balls.userId, userId), inArray(balls.id, [...ballIds])));
  return new Set(rows.map((row) => row.id));
}

export async function houseExists(db: Database, houseId: string): Promise<boolean> {
  const [row] = await db.select({ id: houses.id }).from(houses).where(eq(houses.id, houseId));
  return row !== undefined;
}

export async function oilPatternExists(db: Database, oilPatternId: string): Promise<boolean> {
  const [row] = await db.select({ id: oilPatterns.id }).from(oilPatterns).where(eq(oilPatterns.id, oilPatternId));
  return row !== undefined;
}
