import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  // `auth` belongs to Supabase. We reference auth.users but never migrate it.
  schemaFilter: ['public'],
  strict: true,
  verbose: true,
});
