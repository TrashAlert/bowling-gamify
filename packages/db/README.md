# @bowling-rpg/db

The Postgres schema (Drizzle) and its migrations. Only `apps/api` and `apps/worker`
import this; the mobile app never does.

```sh
pnpm test              # migrations + constraint tests against real Postgres (PGlite)
pnpm generate --name x # new migration from a schema change; review the SQL like code
pnpm check             # migration history is consistent
```

## What's in v1

| Group | Tables |
| --- | --- |
| Reference | `houses`, `oil_patterns` |
| Identity | `profiles` (on top of Supabase `auth.users`) |
| Gear | `balls`, `ball_maintenance_events` |
| Throw spine | `sessions` → `games` → `frames` → `throws` |
| Progression | `player_state`, `xp_events`, `leave_encounters` |
| Operational | `audit_log` |

Every table has RLS enabled with no policies. The API connects as the table owner,
so RLS blocks any other route in, such as PostgREST.

## Where this differs from the design doc

**The three findings from building the scoring engine:**

- `throws.is_foul` exists. Fouls change scoring and respotting.
- `frames.leave_mask` is nullable. After a first-ball foul nothing is left.
- `throws` carries `new_rack`, `is_split` and a generated `leave_mask`. The bestiary
  index lives on `throws`, so a split on a tenth-frame reset rack counts. `frames`
  can only hold one leave, and would miss it. One test covers exactly this case.

**Integrity the doc didn't have:**

- **Children can't disagree with their parent about the owner.** `games`, `frames` and
  `throws` reference their parent by `(parent_id, user_id)`, so a denormalised
  `user_id` can't drift from its parent's. A drifted one would leak rows through
  every `WHERE user_id = ?`.
- **`throws.leave_mask` is a generated column** (`pins_standing_before & ~pins_knocked`),
  so it can't disagree with the pins.
- **The audit log is append-only by trigger**, not by grant. That holds whatever role the
  API uses, and also blocks `TRUNCATE`.
- **`sessions` has `voided_at` + `void_reason`** instead of a `status` smallint. The void
  endpoint takes a reason, and a timestamp says when.

**Simplifications:**

- `profiles.handle` is lowercase `text`, not `citext`. `citext` makes `~` case-insensitive,
  which would have let `Syah` through the lowercase-only format check.
- `houses` has no `geo` column yet. PostGIS arrives with the "houses near me" feature.
- `oil_patterns.is_house` is dropped. `category` already has a `house` value.

**Deferred** until their phase or decision. Each is purely additive, so adding it
later is a normal expand migration:

- `attribute_snapshots`: waits on which attributes ship in v1.
- Quests: Phase 2 step 6, once the predicate DSL is designed.
- `devices`, `idempotency_keys`: when push and non-sync mutations exist.
- Leagues, friendships, seasons, leaderboards, achievements: Phase 4. Includes
  `sessions.league_id`.
- The design doc's clutch and split partial indexes on `frames`: wait until the
  queries that need them exist.

## Not enforced here: the ingest service must check it

A `ball_id` on a game or throw must belong to the same user. A composite foreign key
could enforce it, but `ON DELETE SET NULL` would then also null out `user_id`.

## Testing

Tests run on [PGlite](https://pglite.dev): the real Postgres server compiled to WASM,
in-process. Bit operators, generated columns, partial indexes and triggers all behave
as they do in production, and CI needs no Docker. Supabase's `auth.users` is stubbed
with a one-column table.

Testcontainers is still worth adding when `apps/api` exists: for Supabase-specific
roles and extensions, and for `EXPLAIN` checks against realistic row counts.
