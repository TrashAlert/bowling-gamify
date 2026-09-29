# @bowling-rpg/scoring

Pure ten-pin scoring. No dependencies, no I/O, no clock. The phone and the server
both run this exact code, so they can never disagree about a score.

```ts
import { scoreGame, maxPossibleScore, maskFromPins, FULL_RACK } from '@bowling-rpg/scoring';

const result = scoreGame([
  { knocked: FULL_RACK },                                   // strike
  { knocked: maskFromPins([1, 2, 3, 4, 5, 6, 8, 9]) },      // leaves the 7-10
  { knocked: maskFromPins([7]) },                           // converts the 7, misses the 10
]);

if (result.ok) {
  result.game.scoreSoFar;              // 19 + 9 = 28
  result.game.frames[1].isSplit;       // true
  result.game.next;                    // frame 3, ball 1, full rack
  maxPossibleScore(result.game);       // 268
} else {
  result.error.code;                   // 'INVALID_MASK' | 'PIN_NOT_STANDING' | 'GAME_ALREADY_COMPLETE'
}
```

## Pins are a 10-bit mask

Pin N is bit N-1. A rack or leave marks **standing** pins; a delivery marks the
pins **knocked** on that ball. `PinMask` is a branded number, so a plain integer
can't slip into a pin field unchecked.

## Rules implemented

- Standard USBC ten-pin scoring, including all tenth-frame cases.
- **Fouls** count zero, and the pins that fell are respotted. A foul on the first
  ball leaves a full rack for the second, and clearing it is a **spare**, not a strike.
- **Splits** and **washouts** per [ADR 0001](../../docs/adr/0001-split-definition.md).
  Only flagged on a legal ball thrown at a fresh rack.
- Partial games are first-class: a frame's score is `null` until its bonus balls
  exist, and `next` says what the following ball faces. That's what the live scoring
  screen renders from.
- Illegal input returns a typed error. It never throws.

## Tests

```sh
pnpm test       # 130 tests, ~4s
pnpm coverage   # fails below 100% statements, branches, functions and lines
```

Known games are checked frame by frame. Property tests play thousands of random
legal games and check that every one finishes in 11-21 balls with a score from
0 to 300, that pending frames only ever form a suffix, that fouls always score zero
and respot, that the best reachable score never rises, and that a mirrored game
scores identically. Mutation checks during development confirmed the suite catches
a wrong spare bonus, a foul that counts, a foul that doesn't respot, and a broken
split rule.
