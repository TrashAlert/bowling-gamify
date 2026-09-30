import { randomUUID } from 'node:crypto';
import { ErrorEnvelope } from '@bowling-rpg/contracts';
import { beforeAll, describe, expect, it } from 'vitest';
import { INTERNAL_MESSAGE } from '../src/errors';
import { createSigner, createTestApp, session } from './support';

let ctx: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  ctx = await createTestApp();
});

const envelope = (body: string) => ErrorEnvelope.parse(JSON.parse(body)).error;

describe('authentication', () => {
  it('requires a token to sync', async () => {
    const response = await ctx.sync(null, { sessions: [session()] });
    expect(response.statusCode).toBe(401);
    expect(envelope(response.body)).toMatchObject({ code: -32001, data: { code: 'UNAUTHENTICATED' } });
  });

  it.each([
    ['expired', async () => ctx.signer.sign({ sub: randomUUID(), exp: Math.floor(Date.now() / 1000) - 60 })],
    ['signed with a key the server does not trust', async () => (await createSigner('test-key')).sign({ sub: randomUUID() })],
    ['for the anon role', async () => ctx.signer.sign({ sub: randomUUID(), role: 'anon' })],
    ['without a user', async () => ctx.signer.sign({})],
    ['not a JWT at all', async () => 'not-a-jwt'],
  ])('rejects a token that is %s', async (_, makeToken) => {
    const response = await ctx.sync(await makeToken(), { sessions: [session()] });
    expect(response.statusCode).toBe(401);
    expect(envelope(response.body).data.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a header that is not a bearer token, on any route', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/healthz', headers: { authorization: 'Basic dXNlcjpwYXNz' } });
    expect(response.statusCode).toBe(401);
  });
});

describe('errors', () => {
  it('answers an unknown route with the envelope', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/nope' });
    expect(response.statusCode).toBe(404);
    expect(envelope(response.body).data).toMatchObject({ code: 'NOT_FOUND', traceId: response.headers['x-trace-id'] });
  });

  it('answers an unknown procedure with the envelope', async () => {
    const { token } = await ctx.signIn();
    const response = await ctx.app.inject({ method: 'POST', url: '/trpc/v1.sync.nope', headers: { authorization: `Bearer ${token}` }, payload: {} });
    expect(response.statusCode).toBe(404);
    expect(envelope(response.body).data.code).toBe('NOT_FOUND');
  });

  it('refuses an oversized body before parsing it', async () => {
    const { token } = await ctx.signIn();
    const response = await ctx.sync(token, { padding: 'x'.repeat(3 * 1024 * 1024) });
    expect(response.statusCode).toBe(413);
    expect(envelope(response.body).data.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('keeps a failing event handler from failing the request', async () => {
    const { token } = await ctx.signIn();
    ctx.events.subscribe('SessionIngested', () => {
      throw new Error('derivation queue is down');
    });
    const response = await ctx.sync(token, { sessions: [session()] });
    expect(response.statusCode).toBe(200);
  });

  it('reveals nothing about an internal failure', async () => {
    const broken = await createTestApp();
    const { token } = await broken.signIn();
    await broken.db.$client.close();

    const response = await broken.sync(token, { sessions: [session()] });
    expect(response.statusCode).toBe(500);
    const error = envelope(response.body);
    expect(error.message).toBe(INTERNAL_MESSAGE);
    expect(error.data).toEqual({ code: 'INTERNAL', httpStatus: 500, traceId: response.headers['x-trace-id'] });

    const health = await broken.app.inject({ method: 'GET', url: '/healthz' });
    expect(health.statusCode).toBe(503);
  });
});

describe('health', () => {
  it('reports ok when the database answers', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/healthz' });
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
