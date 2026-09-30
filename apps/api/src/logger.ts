/**
 * The slice of Pino that services use. Declared here so services never import
 * Fastify; Fastify's request logger satisfies it.
 */
export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

/** Keys Pino must never write out, wherever they appear. */
export const REDACT_PATHS = ['req.headers.authorization', '*.authorization', '*.password', '*.token', '*.email'];
