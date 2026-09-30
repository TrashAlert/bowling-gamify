# @bowling-rpg/contracts

Zod schemas for API inputs and outputs, shared by the app and the server. The
phone validates before sending, and the server validates before any handler runs.

So far it has the sync upload (`SyncSessionsInput` / `SyncSessionsOutput`), the error
envelope with its stable codes, and branded ID types.

Errors use tRPC's shape, because the tRPC client needs a numeric `error.code`. The
stable string code the app switches on is `error.data.code`.

## Sync sends raw deliveries only

The phone sends each ball's `knocked` mask and `foul` flag, plus the score it
displayed. It doesn't send frames, strikes, splits or anything else derived. The
server rescores every game with `@bowling-rpg/scoring`:

- An illegal game gets `SESSION_ILLEGAL_GAME`.
- A score that differs from the phone's gets `SESSION_SCORE_MISMATCH`.

Either rejects that one session, not the whole batch.

A parsed `DeliveryPayload` can be passed straight to `scoreGame`, and a test holds
that in place.

## Rules

- Never import from `apps/`.
- Within `v1`, changes are additive only: new optional fields, new error codes. Old
  app builds keep calling this API for years.
