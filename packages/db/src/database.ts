import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

/**
 * A database or a transaction, whichever driver is underneath: postgres.js in
 * production, PGlite in tests. Repositories take this, so they work in both.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
