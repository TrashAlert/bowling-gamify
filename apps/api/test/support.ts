import { randomUUID } from 'node:crypto';
import { createTestDb, createUser } from '@bowling-rpg/db/testing';
import { FULL_RACK, maskFromPins } from '@bowling-rpg/scoring';
import { type JWTPayload, SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { buildApp } from '../src/app';
import { type DomainEvent, EventBus } from '../src/events/bus';
import { createTokenVerifier } from '../src/plugins/auth';

const ISSUER = 'https://test-project.supabase.co/auth/v1';
const silentLog = { info() {}, warn() {}, error() {} };

/** Signs tokens the way Supabase does: ES256, `sub` = user ID, `role` = authenticated. */
export async function createSigner(kid = 'test-key') {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256' };
  const sign = (claims: JWTPayload & { exp?: number | string } = {}) => {
    const { exp = '1h', ...rest } = claims;
    return new SignJWT({ role: 'authenticated', ...rest })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(privateKey);
  };
  return { jwk, sign };
}

export async function createTestApp() {
  const db = await createTestDb();
  const signer = await createSigner();
  const events = new EventBus(silentLog);
  const published: DomainEvent[] = [];
  events.subscribe('SessionIngested', (event) => {
    published.push(event);
  });

  const app = await buildApp({
    db,
    events,
    verifyToken: createTokenVerifier({ keys: createLocalJWKSet({ keys: [signer.jwk] }), issuer: ISSUER }),
  });

  /** A new Supabase user and a valid access token for them. */
  const signIn = async () => {
    const userId = await createUser(db);
    return { userId, token: await signer.sign({ sub: userId }) };
  };

  const sync = (token: string | null, input: unknown) =>
    app.inject({
      method: 'POST',
      url: '/trpc/v1.sync.sessions',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      payload: input as object,
    });

  return { app, db, events, published, signer, signIn, sync };
}

// ---------------------------------------------------------------- payloads

const T0 = '2026-09-28T19:30:00+08:00';
type Delivery = { knocked: number; foul?: boolean; ballId?: string; thrownAt: string };

export const ball = (knocked: number, extra: Partial<Delivery> = {}): Delivery => ({ knocked, thrownAt: T0, ...extra });
export const PERFECT = Array.from({ length: 12 }, () => ball(FULL_RACK));
export const GUTTER = Array.from({ length: 20 }, () => ball(0));
/** Nine gutter frames, then X, a 7-10 split on the reset rack, and the 7 converted. Scores 19. */
export const TENTH_FRAME_SPLIT = [
  ...Array.from({ length: 18 }, () => ball(0)),
  ball(FULL_RACK),
  ball(maskFromPins([1, 2, 3, 4, 5, 6, 8, 9])),
  ball(maskFromPins([7])),
];

export function game(deliveries: Delivery[], claimedScore: number, extra: Record<string, unknown> = {}) {
  return { gameNumber: 1, claimedScore, deliveries, ...extra };
}

export function session(games = [game(PERFECT, 300)], extra: Record<string, unknown> = {}) {
  return { clientId: randomUUID(), startedAt: T0, endedAt: '2026-09-28T21:00:00+08:00', games, ...extra };
}
