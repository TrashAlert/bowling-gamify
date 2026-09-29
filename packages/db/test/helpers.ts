import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { type DeliveryInput, scoreGame } from '@bowling-rpg/scoring';
import { sql } from 'drizzle-orm';
import { type PgliteDatabase, drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../src/schema';

export type Db = PgliteDatabase<typeof schema>;

/**
 * A fresh in-process Postgres (PGlite: the real server compiled to WASM), with
 * a stand-in for Supabase's `auth.users` and every migration applied.
 */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  await client.exec('CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);');
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) });
  return db;
}

export async function createUser(db: Db): Promise<string> {
  const id = randomUUID();
  await db.execute(sql`INSERT INTO auth.users (id) VALUES (${id})`);
  return id;
}

export async function createSession(db: Db, userId: string): Promise<string> {
  const [row] = await db
    .insert(schema.sessions)
    .values({ userId, clientId: randomUUID(), startedAt: new Date('2026-09-28T19:30:00+08:00'), endedAt: new Date('2026-09-28T21:00:00+08:00') })
    .returning({ id: schema.sessions.id });
  return row!.id;
}

/**
 * Score a game with the real engine and store it the way the ingest service
 * will: one games row, one frames row per frame, one throws row per delivery.
 */
export async function insertScoredGame(db: Db, userId: string, sessionId: string, deliveries: readonly DeliveryInput[]) {
  const result = scoreGame(deliveries);
  if (!result.ok) throw new Error(result.error.message);
  const { game } = result;

  return db.transaction(async (tx) => {
    const [gameRow] = await tx
      .insert(schema.games)
      .values({ sessionId, userId, gameNumber: 1, totalScore: game.scoreSoFar, isComplete: game.isComplete })
      .returning({ id: schema.games.id });

    for (const frame of game.frames) {
      const [frameRow] = await tx
        .insert(schema.frames)
        .values({
          gameId: gameRow!.id,
          userId,
          frameNumber: frame.frameNumber,
          leaveMask: frame.firstBallLeave,
          isStrike: frame.isStrike,
          isSpare: frame.isSpare,
          isSplit: frame.isSplit,
          frameScore: frame.frameScore,
          cumulativeScore: frame.cumulativeScore,
        })
        .returning({ id: schema.frames.id });

      await tx.insert(schema.throws).values(
        frame.deliveries.map((d) => ({
          frameId: frameRow!.id,
          userId,
          throwNumber: d.deliveryInFrame,
          pinsStandingBefore: d.standingBefore,
          pinsKnocked: d.knocked,
          isFoul: d.foul,
          newRack: d.newRack,
          isSplit: d.isSplit,
          thrownAt: new Date(),
        })),
      );
    }
    return gameRow!.id;
  });
}

/** Runs a statement expected to fail, and returns the constraint or error message Postgres gave. */
export async function violation(statement: PromiseLike<unknown>): Promise<string> {
  try {
    await statement;
  } catch (error) {
    const cause = (error instanceof Error && error.cause) || error;
    const { constraint, message } = cause as { constraint?: string; message?: string };
    return constraint ?? message ?? String(cause);
  }
  throw new Error('Expected the statement to fail, but it succeeded');
}
