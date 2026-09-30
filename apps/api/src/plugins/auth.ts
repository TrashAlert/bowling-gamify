import { type UserId, UserId as UserIdSchema } from '@bowling-rpg/contracts';
import type { FastifyRequest } from 'fastify';
import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from 'jose';
import { AppError } from '../errors';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set from a verified bearer token. Null when the request carried none. */
    userId: UserId | null;
  }
}

/** Resolves a bearer token to the user it was issued to, or throws UNAUTHENTICATED. */
export type TokenVerifier = (token: string) => Promise<UserId>;

export interface TokenVerifierOptions {
  keys: JWTVerifyGetKey;
  issuer: string;
}

export function createTokenVerifier({ keys, issuer }: TokenVerifierOptions): TokenVerifier {
  return async (token) => {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, keys, { issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'] }));
    } catch {
      throw new AppError('UNAUTHENTICATED', 'The access token is invalid or expired.');
    }
    // Supabase's anon key is also a valid JWT, but it names no user.
    const userId = UserIdSchema.safeParse(payload.sub);
    if (payload['role'] !== 'authenticated' || !userId.success) {
      throw new AppError('UNAUTHENTICATED', 'The access token does not identify a signed-in user.');
    }
    return userId.data;
  };
}

/** Keys and issuer for a Supabase project. Keys are fetched once and cached in memory. */
export function supabaseTokenOptions(supabaseUrl: string): TokenVerifierOptions {
  return {
    keys: createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', supabaseUrl)),
    issuer: new URL('/auth/v1', supabaseUrl).href,
  };
}

/**
 * onRequest hook. No Authorization header leaves the request anonymous, and
 * each procedure decides whether that's allowed. A header that is present but
 * wrong is always a 401, on every route.
 */
export function authenticate(verify: TokenVerifier) {
  return async (request: FastifyRequest): Promise<void> => {
    const header = request.headers.authorization;
    if (header === undefined) return;
    const match = /^Bearer (\S+)$/.exec(header);
    if (!match) throw new AppError('UNAUTHENTICATED', 'Expected "Authorization: Bearer <token>".');
    request.userId = await verify(match[1]!);
  };
}
