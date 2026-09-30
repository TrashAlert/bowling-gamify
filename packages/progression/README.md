# @bowling-rpg/progression

The game layer on top of `@bowling-rpg/scoring`. Pure functions with no I/O, run
by both the phone and (later) the derivation worker.

So far it has **XP and levels**, and the **bestiary** (built, hidden in the app for
now). Attributes and ranks come once v1's attributes are decided.

## XP and levels

- **A finished game earns its score in XP**, so 300 is the most any game can earn.
  An unfinished game earns nothing.
- **Level 1 starts at 0 XP.** Levelling up costs 500 XP, and each level after that
  costs 250 XP more than the one before:

  | Level | Total XP | Games at a 150 average |
  | --- | --- | --- |
  | 2 | 500 | ~3 |
  | 5 | 3,500 | ~23 |
  | 10 | 13,500 | ~90 |
  | 20 | 52,250 | ~350 |

- **The numbers live in `src/xp.ts`.** Bump `XP_FORMULA_VERSION` whenever you change one.
  Since XP is recomputed from raw balls, retuning changes every bowler's history
  consistently.

## Stats

`stats.ts` turns scored games into improvement numbers.
- **Per-game counts:** strikes out of strike chances (every ball at a fresh rack,
  including tenth-frame fills), spares out of leaves shot at, and open frames.
- **Rates are pooled** across games (total made ÷ total chances), so one game with a
  single spare chance can't swing a rate.
- **`rollingForm`:** a 5-game trailing window for trends.
- **`compareForm`:** your last 10 games against the 10 before, or half-and-half with
  fewer than 20. It needs at least 4 games.

## Bestiary rules

- **An encounter is one spare attempt.** A legal ball at a fresh rack leaves pins,
  and another ball is thrown at them.
  - Tenth-frame reset racks count.
  - A leave on the final ball of a game doesn't, since nobody shoots at it.
  - A first-ball foul doesn't either: its pins are respotted.
- **Converting the leave slays the monster.** A foul on the spare ball counts as a miss.
- **Each leave's tier comes from its shape:**

  | Tier | Name | Leave |
  | --- | --- | --- |
  | 1 | Minion | A single pin |
  | 2 | Brute | A connected cluster |
  | 3 | Trickster | A washout |
  | 4 | Elite | A split |
  | 5 | Boss | Bedposts, Big Four and both Greek Churches |

- **"New" means the first game in which this bowler ever faced the leave.**

Tier names are placeholder copy in `TIER_NAMES`: change them freely.

Nothing here is stored as the only copy of anything. The phone rebuilds the bestiary
from raw balls on every load, so changing a rule changes all of history.

```sh
pnpm test   # 42 tests, 100% coverage required
```
