import type { ErrorCode, UserId } from '@bowling-rpg/contracts';
import type { Database } from '@bowling-rpg/db';
import { type TRPCError, initTRPC } from '@trpc/server';
import { AppError, hasIssues, toEnvelope, validationError } from './errors';
import type { EventBus } from './events/bus';
import type { Logger } from './logger';

interface Deps {
  readonly db: Database;
  readonly events: EventBus;
}

export interface Context {
  readonly userId: UserId | null;
  readonly traceId: string;
  readonly ip: string | null;
  readonly log: Logger;
  readonly deps: Deps;
}

const FROM_TRPC_CODE: Partial<Record<TRPCError['code'], ErrorCode>> = {
  PARSE_ERROR: 'VALIDATION_FAILED',
  BAD_REQUEST: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_SUPPORTED: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  TOO_MANY_REQUESTS: 'RATE_LIMITED',
};

/** What the client is told about any error tRPC caught. */
export function describeError(error: TRPCError): AppError {
  if (error.cause instanceof AppError) return error.cause;
  if (error.code === 'BAD_REQUEST' && hasIssues(error.cause)) return validationError(error.cause.issues);
  const code = FROM_TRPC_CODE[error.code] ?? 'INTERNAL';
  return new AppError(code, error.message);
}

const t = initTRPC.context<Context>().create({
  errorFormatter: ({ error, ctx }) => toEnvelope(describeError(error), ctx?.traceId ?? 'unknown').error,
});

export const router = t.router;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new AppError('UNAUTHENTICATED', 'Sign in to do this.');
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
