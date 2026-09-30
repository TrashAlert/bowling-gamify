# @bowling-rpg/api

Fastify + tRPC. Procedures are served at `POST /trpc/v1.<router>.<procedure>`.

```sh
cp .env.example .env   # DATABASE_URL, SUPABASE_URL
pnpm dev               # tsx watch
pnpm test              # HTTP-level tests on PGlite with locally signed tokens
```

## Layers

| Folder | Holds | Never imports |
| --- | --- | --- |
| `routers/` | Input and output schemas, one service call each | Repositories, Drizzle |
| `services/` | The rules, and transactions | Fastify, tRPC |
| `repositories/` | Every SQL query. Each one that reads user data takes `userId` | Services |
| `events/` | In-process domain events, published after commit | |
| `plugins/` | Fastify hooks: authentication | |

## Endpoints

| Route | Auth | |
| --- | --- | --- |
| `GET /healthz` | Public | 200, or 503 when Postgres doesn't answer |
| `POST /trpc/v1.sync.sessions` | User | Upload up to 20 finished sessions |

## Authentication

Supabase issues the tokens. The API verifies each one against the project's JWKS
(ES256 or RS256), fetching the keys once and caching them in memory. A token must:

- have audience `authenticated`, issuer `<SUPABASE_URL>/auth/v1`, and role `authenticated`;
- carry a UUID `sub`.

The anon key, which names no user, is refused.

The Supabase project must use **asymmetric JWT signing keys**, the default for new
projects. The legacy shared HS256 secret isn't supported, on purpose.

## Sync ingest

`services/session-ingest.ts` handles each session on its own:

1. **Already stored** for this user and `clientId`: accepted again with the same server
   ID. That makes a retry free. Client IDs are scoped per user.
2. **Every game rescored** with `@bowling-rpg/scoring`:
   - an illegal game → `SESSION_ILLEGAL_GAME`;
   - a score differing from the phone's → `SESSION_SCORE_MISMATCH`.
3. **Every ball, house and oil pattern must exist**, and balls must belong to the user.
   Otherwise → `SESSION_UNKNOWN_REFERENCE`. Another user's ball is reported exactly
   like a missing one.
4. **Inserted in one transaction**, using `ON CONFLICT DO NOTHING` on `(user_id, client_id)`.
   Two concurrent uploads of the same session store it once.
5. **`SessionIngested` is published** right after the commit.

Every rejection is written to `audit_log`. An unexpected failure is a 500. The client
retries the whole batch, and sessions that committed come back as already accepted.

## Where this differs from the design doc

- **The error envelope lives in `error.data`.** The tRPC client throws on any error
  whose `code` isn't a JSON-RPC number, so the doc's `{ error: { code: "…" } }` can't
  be the body. The body is `{ error: { message, code: <number>, data: { code, httpStatus, details?, traceId } } }`.
  Clients switch on `error.data.code`. Every route uses this shape, tRPC or not.
- **`derivationJobId` is always null.** Nothing subscribes to `SessionIngested` until
  `apps/worker` and Redis exist.
- **`traceId` is Fastify's request ID** (also sent as `x-trace-id`). Swap in the
  OpenTelemetry trace ID when tracing is added.

## Not built yet

- **Rate limiting** needs Redis. It's in Phase 3, but sync should get a limit before any public beta.
- **The `X-App-Version` minimum-version check (426).**
- **Void and cursor endpoints**, and a deploy build. `tsx` runs it for now; bundle it in
  the Docker step.
- **A durable handoff from ingest to derivation.** An in-process event is lost if the
  process dies between the commit and the publish. When the worker exists, it should
  also sweep for sessions that have no derived XP.
- **The concurrent-upload branch is untested.** PGlite has a single connection, so two
  transactions can never actually race. Cover it with Testcontainers Postgres.
