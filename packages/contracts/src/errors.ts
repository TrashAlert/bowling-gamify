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
  SESSION_ALREADY_VOIDED: 409,
};

/**
 * The one error shape every endpoint returns. `message` is for logs and support
 * and is never shown raw to users; `traceId` finds the request in the traces.
 */
export const ErrorEnvelope = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    traceId: z.string(),
  }),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;
