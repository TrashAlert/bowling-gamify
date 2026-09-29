# Bowling RPG

A gamified ten-pin bowling tracker. See the technical design doc for the full plan.

## Status: Phase 1 (Foundation), in progress

| Piece | State |
| --- | --- |
| Monorepo, strict TypeScript, Turborepo, CI | Done. Not yet a git repo, so CI hasn't run |
| `packages/scoring` | Done: 130 tests, 100% coverage |
| `packages/contracts` (Zod schemas) | Sync upload and error envelope done |
| `packages/db` (Drizzle schema + migrations) | Phase 1–2 tables done, 27 tests against real Postgres |
| ADR 0001: split definition | Proposed, needs sign-off |
| `packages/progression` | Blocked on which attributes ship in v1 |
| `apps/api` skeleton with Supabase Auth | Not started |
| `apps/mobile` shell | Not started |

## Getting started

Requires Node 22 and Corepack. No Docker: database tests run on PGlite.

```sh
corepack enable
pnpm install
pnpm test        # typecheck + tests, every package
pnpm coverage
```

## Changes from the design doc

Building the scoring engine surfaced three gaps in the schema section. All three
are applied in `packages/db`:

1. **`throws.is_foul`.** Fouls change scoring and respotting, and the doc's schema had
   no way to record one.
2. **`frames.leave_mask` is nullable.** After a first-ball foul there is no leave.
3. **The bestiary reads `throws`, not `frames`.** In the tenth frame, a ball thrown at
   a reset rack produces a first-ball leave too, and `frames` only stores one.
   `throws` now carries `new_rack`, `is_split` and a generated `leave_mask`.

[`packages/db/README.md`](packages/db/README.md) lists the other differences and
the tables deferred to later phases.
# bowling-gamify
