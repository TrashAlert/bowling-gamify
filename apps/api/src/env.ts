import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Point at the pooler in transaction mode (Supabase port 6543) in deployed environments. */
  DATABASE_URL: z.url(),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  /** e.g. https://abcdefgh.supabase.co. The project must use asymmetric JWT signing keys. */
  SUPABASE_URL: z.url(),
});

export type Env = z.infer<typeof Env>;

/** Parse at boot, so a missing variable crashes the process now rather than failing at 3am. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = Env.safeParse(source);
  if (!result.success) throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  return result.data;
}
