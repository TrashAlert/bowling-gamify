import { schema } from '@bowling-rpg/db';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { buildApp } from './app';
import { parseEnv } from './env';
import { REDACT_PATHS } from './logger';
import { createTokenVerifier, supabaseTokenOptions } from './plugins/auth';

const env = parseEnv(process.env);

// prepare: false, because the Supabase pooler in transaction mode can't keep prepared statements.
const client = postgres(env.DATABASE_URL, { max: env.DATABASE_POOL_SIZE, prepare: false });

const app = await buildApp({
  db: drizzle(client, { schema }),
  verifyToken: createTokenVerifier(supabaseTokenOptions(env.SUPABASE_URL)),
  logger: { level: env.LOG_LEVEL, redact: REDACT_PATHS },
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await client.end({ timeout: 5 });
    process.exit(0);
  });
}

await app.listen({ host: env.HOST, port: env.PORT });
