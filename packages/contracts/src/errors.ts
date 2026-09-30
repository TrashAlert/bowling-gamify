import { z } from 'zod';

/**
 * Stable, machine-readable error codes. The client switches on these, so
 * within a major API version they are only ever added, never renamed or removed.
 */
export const ErrorCode = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'UPGRADE_REQUIRED',
  'INTERNAL',
  /** The deliveries can't be a legal game (a pin knocked twice, a ball after the tenth). */
  'SESSION_ILLEGAL_GAME',
  /** The server's score for a game differs from the one the phone showed. */
  'SESSION_SCORE_MISMATCH',
  /**
   * The session names a ball, house or oil pattern the server doesn't know, or a
   * ball that belongs to someone else. Usually a ball created offline that hasn't
   * synced yet: the client syncs it, then resends the session.
   */
  'SESSION_UNKNOWN_REFERENCE',
  'SESSION_ALREADY_VOIDED',
]);

export type ErrorCode = z.infer<typeof ErrorCode>;

/** HTTP status for each code, so the router and the client agree on it. */
export const ERROR_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  UPGRADE_REQUIRED: 426,
  INTERNAL: 500,
  SESSION_ILLEGAL_GAME: 422,
  SESSION_SCORE_MISMATCH: 409,
  SESSION_UNKNOWN_REFERENCE: 422,
  SESSION_ALREADY_VOIDED: 409,
};

/**
 * The one error shape every endpoint returns, tRPC or not.
 *
 * It is tRPC's own error shape, because the tRPC client refuses any error whose
 * `code` is not a JSON-RPC number. Our fields live in `data`: switch on
 * `data.code`, never on the number. `message` is for logs and support and is
 * never shown raw to users; `traceId` finds the request in the logs.
 */
export const ErrorEnvelope = z.object({
  error: z.object({
    message: z.string(),
    /** JSON-RPC error number, for the tRPC client. */
    code: z.int(),
    data: z.object({
      code: ErrorCode,
      httpStatus: z.int(),
      details: z.record(z.string(), z.unknown()).optional(),
      traceId: z.string(),
    }),
  }),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;
