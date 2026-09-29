# ADR 0001: How a split is detected

**Status:** Proposed. Needs the product owner's sign-off before launch.
**Date:** 2026-09-28

## Context

Splits feed the bestiary, the split-conversion stat and the Recovery attribute,
so the definition has to be exact and it has to be the same everywhere.

The USBC playing rules define a split as the pins left after the first delivery,
with the headpin down, where either:

1. at least one pin is down between two or more standing pins (examples: 7-9, 3-10), or
2. at least one pin is down immediately ahead of and between two or more standing
   pins (example: 5-6).

"Between" is only unambiguous for pins on a straight line. For pins that are not
(5-7, 4-9), a rule has to be chosen.

## Decision

Treat the rack as a graph. Two standing pins are linked when:

- they are **diagonal neighbours**, which physically touch (1-2, 2-5, 6-10, ...), or
- one is a **sleeper** directly behind the other (1-5, 2-8, 3-9), with no pin between
  them, so rule 1 can never be met.

Same-row neighbours (4-5, 8-9) are **not** linked. That is exactly rule 2: when the
pin in front of them is down it is a split, and when that pin is standing they are
linked through it anyway.

A leave is a **split** if the headpin is down and the standing pins form more than
one group. A **washout** is the same shape with the headpin standing.

Implemented in `packages/scoring/src/leaves.ts`; every example below is a test.

## Consequences

Matches every commonly cited example: 7-10, 4-6-7-10, both Greek Churches, 2-7, 3-10,
5-7, 5-10, 5-7-10, 8-10, 5-6. Buckets and sleepers (2-8, 3-9) are not splits. Picket
fences (1-2-4-7) are not washouts.

Two consequences worth knowing:

- **4-5, 8-9, 9-10, 7-8 and 2-3 are splits** when the pin in front is down. That is
  rule 2 read literally. Some bowlers would not call 9-10 a split.
- **2-4-5-7-9 is not a split.** Every standing pin connects, although the 8 is missing
  from between the 7 and the 9. A literal reading of rule 1 would call it one. This
  is the one real interpretive call, and one test pins it down.

The rule is mirror-symmetric (checked for all 1,024 leaves), so left- and right-handed
bowlers are treated identically.

## Alternatives rejected

**Pairwise "pin down in the rectangle between two standing pins."** Simple, but it
over-fires for pins far apart in rows. It marks the 1-2-4-7 picket fence as a
washout because the 8 falls inside the rectangle between the 1 and the 7.

**A hand-maintained list of split leaves.** 1,023 possible leaves makes this
unmaintainable, and it gives no principled answer for an unlisted one.

## To confirm

Check both consequences above against the current edition of the USBC playing
rules, and against what the scoring machines at your target centres display. If
you pick the literal reading of rule 1, change the one test named in `leaves.test.ts`.
