import type { SQLiteDatabase } from 'expo-sqlite';
import { migrate } from '@/db/migrations';

type Param = string | number | null;

/**
 * An in-memory SQLite with the slice of the expo-sqlite API the app uses,
 * backed by Node's built-in SQLite. The app's real SQL runs against it, so
 * migrations and queries are tested without a phone.
 *
 * Loaded through process.getBuiltinModule because Jest's resolver doesn't know
 * the `node:sqlite` scheme-only module.
 */
export async function createMemoryDb(): Promise<SQLiteDatabase> {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');

  const db = {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    runAsync: async (sql: string, ...params: Param[]) => {
      const result = sqlite.prepare(sql).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getAllAsync: async (sql: string, ...params: Param[]) => sqlite.prepare(sql).all(...params).map((row) => ({ ...row })),
    getFirstAsync: async (sql: string, ...params: Param[]) => {
      const row = sqlite.prepare(sql).get(...params);
      return row ? { ...row } : null;
    },
    withExclusiveTransactionAsync: async (task: (txn: unknown) => Promise<void>) => {
      sqlite.exec('BEGIN');
      try {
        await task(db);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };

  const typed = db as unknown as SQLiteDatabase;
  await migrate(typed);
  return typed;
}
