# @bowling-rpg/mobile

The Expo app (SDK 57, React Native, Expo Router). It works fully offline:

- **Live scoring:** log every ball on the pin deck, see the scoresheet as the
  overhead monitor would, and resume after a crash.
- **XP and levels:** every finished game earns its score in XP, up to 300. Your level
  and XP bar sit at the top of Home.
- **After-action report:** at the end of each game, and for any past game from Home
  or Progress. It shows the XP earned, the bar filling up, a **LEVEL UP** banner with
  a haptic when you reach one, and strikes, spares, open frames and splits.
- **Progress tab:** level, games, average and best XP, and your XP history.
- **Bestiary:** built but hidden. Set `features.bestiary` in `src/features.ts` to `true`
  to bring back its tab and the monster list in reports.

There's no account or sync yet.

## Run it on your phone

1. Install **Expo Go** from the App Store or Play Store.
2. From the repo root, run `pnpm dev:mobile`.
3. Scan the QR code: with the Camera app on iOS, or from inside Expo Go on Android.

The phone and the computer need to be on the same Wi-Fi. At an alley with bad Wi-Fi,
use `pnpm --filter @bowling-rpg/mobile dev --tunnel`.

Every dependency is one Expo Go already contains, so no native build, Xcode or EAS
account is needed yet.

## Logging a ball

Mark the pins **still standing**; everything else fell.

| Situation | Taps |
| --- | --- |
| Strike, or spare | 1: the main button reads "Strike" or "Spare" |
| Complete miss | 1: "Miss" |
| A leave, e.g. the 10-pin | 2: tap the 10, then "10 left" |
| A split | Same as a leave. A "SPLIT" badge appears before you record |
| A foul | "Foul", then record as usual |

**Undo** removes the last ball, even after the game is over.

**Safety:**
- Every ball is written to SQLite before the screen updates.
- The screen stays awake.
- Swipe-back is disabled.
- A double tap on the main button records one ball, not two.

## Code

| Path | Holds |
| --- | --- |
| `src/app/` | Routes: `(tabs)/index` (Home), `(tabs)/progress`, `(tabs)/bestiary` (hidden), `session/[id]` (live scoring, full-screen modal), `game/[id]` (past game's report), `leave/[mask]` (one monster, as a sheet) |
| `src/components/` | `PinDeck`, `FrameStrip`, `ScoringPad`, `XpBar`, `LevelCard`, `GameReportView`, `MiniRack`, `MonsterRow` |
| `src/features/live-scoring/` | The throw-entry rules (`entry.ts`) and the game hook (`use-live-game.ts`) |
| `src/features/history/` | Loads stored games and derives scores, XP, levels and reports with `@bowling-rpg/progression` |
| `src/features.ts` | Switches for built-but-hidden features |
| `src/db/` | SQLite migrations and every query |
| `src/theme.ts` | Design tokens. No colour or size value lives anywhere else |

**Storage:** the phone stores only raw balls: the `knocked` mask and a foul flag.
Scores, strikes, spares and splits are recomputed by `@bowling-rpg/scoring` every
time a game is loaded, the same code the server runs.

**IDs** are UUIDv7. A session's ID becomes its sync `clientId`.

## Tests

```sh
pnpm test    # 50 tests: throw entry, components, hooks, XP and history loading, and the real SQL
pnpm lint
```

After adding or renaming a route, run `pnpm dev` once before `pnpm typecheck`.
Expo Router regenerates its route types (`.expo/types`, git-ignored) only when the
dev server starts. CI has no generated types, so it isn't affected.

Database tests run the app's actual migrations and queries against Node's built-in
SQLite (`test/memory-db.ts`), so no phone is needed.

## Where this differs from the design doc

- **`expo-sqlite` instead of `op-sqlite`.** It's in Expo Go, and the data is tiny.
  Switch if profiling ever says so.
- **Plain SQL, not Drizzle, on the phone.** Three tables. Drizzle's migration setup
  for React Native (a Babel plugin and Metro config for `.sql` files) costs more than it saves.
- **The pin deck is native views, not a Skia canvas.** Each pin is a real accessible
  checkbox, so VoiceOver and TalkBack work without the separate list input the doc
  planned. Skia is still the plan for reward animations.
- **pnpm uses `nodeLinker: hoisted`**, workspace-wide. Isolated installs produced
  duplicate copies of native modules, which native builds can't contain.

## Next

- Sign-in with Supabase, once the project exists.
- The sync outbox: upload ended sessions with `synced_at IS NULL` to
  `POST /v1/sync/sessions`, then set `synced_at` for the accepted client IDs.
- **Time a real game at a lane.** The design doc's biggest risk is throw entry
  being too slow.
