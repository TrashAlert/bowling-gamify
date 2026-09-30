import { ERROR_STATUS, type ErrorCode, type ErrorEnvelope } from '@bowling-rpg/contracts';

/**
 * An error the client can act on. Anything thrown that isn't one of these is a
 * bug: it's logged and becomes a generic 500 that reveals nothing.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** JSON-RPC numbers tRPC uses for each code. The tRPC client needs one on every error. */
const JSON_RPC_CODE: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: -32600,
  UNAUTHENTICATED: -32001,
  FORBIDDEN: -32003,
  NOT_FOUND: -32004,
  CONFLICT: -32009,
  PAYLOAD_TOO_LARGE: -32013,
  RATE_LIMITED: -32029,
  UPGRADE_REQUIRED: -32012,
  INTERNAL: -32603,
  SESSION_ILLEGAL_GAME: -32022,
  SESSION_SCORE_MISMATCH: -32009,
  SESSION_UNKNOWN_REFERENCE: -32022,
  SESSION_ALREADY_VOIDED: -32009,
};

export const INTERNAL_MESSAGE = 'Something went wrong on our side. Quote the trace ID to support.';

export function toEnvelope(error: AppError, traceId: string): ErrorEnvelope {
  return {
    error: {
      message: error.code === 'INTERNAL' ? INTERNAL_MESSAGE : error.message,
      code: JSON_RPC_CODE[error.code],
      data: {
        code: error.code,
        httpStatus: ERROR_STATUS[error.code],
        ...(error.details && { details: error.details }),
        traceId,
      },
    },
  };
}

/** Zod and Standard Schema errors both carry `issues`. Report where and what, never the rejected values. */
export function validationError(issues: readonly { path?: readonly PropertyKey[]; message: string }[]): AppError {
  return new AppError('VALIDATION_FAILED', 'The request is not valid.', {
    issues: issues.map((issue) => ({ path: (issue.path ?? []).map(String).join('.'), message: issue.message })),
  });
}

export function hasIssues(value: unknown): value is { issues: { path?: PropertyKey[]; message: string }[] } {
  return typeof value === 'object' && value !== null && Array.isArray((value as { issues?: unknown }).issues);
}
