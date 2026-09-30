import { randomUUID } from 'node:crypto';
import type { Database } from '@bowling-rpg/db';
import { type FastifyTRPCPluginOptions, fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { sql } from 'drizzle-orm';
import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import { AppError, toEnvelope } from './errors';
import { EventBus } from './events/bus';
import { type TokenVerifier, authenticate } from './plugins/auth';
import { type AppRouter, appRouter } from './routers';
import { type Context, describeError } from './trpc';

export interface AppOptions {
  readonly db: Database;
  readonly verifyToken: TokenVerifier;
  readonly events?: EventBus;
  readonly logger?: FastifyServerOptions['logger'];
}

/** Worst realistic sync batch is well under this; anything bigger is a bug or abuse. */
const BODY_LIMIT_BYTES = 2 * 1024 * 1024;

export async function buildApp(options: AppOptions) {
  const app = Fastify({
    logger: options.logger ?? false,
    genReqId: () => randomUUID(),
    bodyLimit: BODY_LIMIT_BYTES,
    // Fly.io's proxy sets X-Forwarded-For; without this every request's IP is the proxy's.
    trustProxy: true,
  });
  const deps = { db: options.db, events: options.events ?? new EventBus(app.log) };

  app.decorateRequest('userId', null);
  app.addHook('onRequest', authenticate(options.verifyToken));
  // Every response carries the trace ID, so a screenshot is enough to find the request.
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-trace-id', request.id);
  });

  // Errors outside tRPC: bad auth headers, oversized bodies, unknown routes.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const appError = error instanceof AppError ? error : fromFastifyError(error);
    if (appError.code === 'INTERNAL') request.log.error({ err: error }, 'Unhandled error');
    const envelope = toEnvelope(appError, request.id);
    return reply.status(envelope.error.data.httpStatus).send(envelope);
  });
  app.setNotFoundHandler((request, reply) => {
    const envelope = toEnvelope(new AppError('NOT_FOUND', `No route for ${request.method} ${request.url}.`), request.id);
    return reply.status(404).send(envelope);
  });

  app.get('/healthz', async (request, reply) => {
    try {
      await options.db.execute(sql`SELECT 1`);
      return { status: 'ok' };
    } catch (err) {
      request.log.error({ err }, 'Health check failed');
      return reply.status(503).send({ status: 'unavailable' });
    }
  });

  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: ({ req }): Context => ({ userId: req.userId, traceId: req.id, ip: req.ip ?? null, log: req.log, deps }),
      onError: ({ error, ctx, path }) => {
        if (describeError(error).code === 'INTERNAL') ctx?.log.error({ err: error.cause ?? error, path }, 'Procedure failed');
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
  });

  return app;
}

function fromFastifyError(error: FastifyError): AppError {
  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return new AppError('PAYLOAD_TOO_LARGE', 'The request body is too large.');
  if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
    return new AppError('VALIDATION_FAILED', error.message);
  }
  return new AppError('INTERNAL', error.message);
}
