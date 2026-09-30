/**
 * Test support: a fresh, migrated Postgres per call. Import from
 * `@bowling-rpg/db/testing`, and only from tests.
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { type PgliteDatabase, drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';

export type TestDb = PgliteDatabase<typeof schema> & { $client: PGlite };

/**
 * An in-process Postgres (PGlite: the real server compiled to WASM), with a
 * stand-in for Supabase's `auth.users` and every migration applied.
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  await client.exec('CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);');
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) });
  return db;
}

/** Inserts a Supabase auth user and returns its ID. */
export async function createUser(db: TestDb): Promise<string> {
  const id = randomUUID();
  await db.execute(sql`INSERT INTO auth.users (id) VALUES (${id})`);
  return id;
}
