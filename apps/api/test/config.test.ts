import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/env';
import { supabaseTokenOptions } from '../src/plugins/auth';

describe('environment', () => {
  const valid = { DATABASE_URL: 'postgres://app:secret@localhost:5432/bowling', SUPABASE_URL: 'https://abcdefgh.supabase.co' };

  it('applies defaults', () => {
    expect(parseEnv(valid)).toMatchObject({ PORT: 3000, DATABASE_POOL_SIZE: 10, LOG_LEVEL: 'info' });
  });

  it('crashes at boot naming every missing variable', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*SUPABASE_URL/);
  });

  it('coerces numbers from strings', () => {
    expect(parseEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });
});

describe('Supabase token options', () => {
  it('uses the project’s auth issuer', () => {
    expect(supabaseTokenOptions('https://abcdefgh.supabase.co').issuer).toBe('https://abcdefgh.supabase.co/auth/v1');
  });
});
