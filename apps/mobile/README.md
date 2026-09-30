# @bowling-rpg/mobile

The Expo app (SDK 57, React Native, Expo Router). It works fully offline:

- **Live scoring:** log every ball on the pin deck, see the scoresheet as the
  overhead monitor would, and resume after a crash.
- **XP and levels:** every finished game earns its score in XP, up to 300. Your level
  and XP bar sit at the top of Home.
- **After-action report:** at the end of each game, and for any past game from Home
  or Progress. It shows the XP earned, the bar filling up, a **LEVEL UP** banner with
  a haptic when you reach one, and strikes, spares, open frames and splits.
- **Tab bar:** Progress | **＋** | Home. The ＋ button goes straight into bowling:
  - no session open: it starts one;
  - the last game is finished: it adds the next game.
- **Pausing:** swiping back from a game (or Android's back button) leaves it
  unfinished. The ＋ then turns into a **play/pause** icon, and tapping it asks:
  - **Continue:** back into the game;
  - **Stop game:** ends the session, keeping the game as unfinished.

- **Home:** your level, a Start/Resume button, and your recent games. Games that took
  you to a new level are marked ★. Tap a game for its report.
- **Deleting a game:** **Delete** in a game report's header removes the game and its
  balls, after a confirmation that names the XP it takes away. Later games in that
  session move up a number. Since XP, levels and stats are recomputed from the
  stored balls, the deleted game drops out of all of them, and your level can go down.
- **Progress tab:** stats and trends over finished games. The list of games lives
  only on Home.
  - **Totals:** Games, Average and Best.
  - **Recent form:** your last 10 games against the 10 before (half-and-half with
    fewer than 20). It covers average, strike rate, spare rate and open frames per
    game, each with an arrowed, signed change.
  - **Score chart:** each game as a dot, with a 5-game average line.
  - **Strike and spare chart:** rolling rates over the last 30 games.
  - **Reading the charts:** drag across a chart to read any game. **Show numbers**
    gives the same data as a table.
- **Scan scoresheet** (Home, under Start): a placeholder, shown as "Coming soon" and
  not tappable. The plan is in [ADR 0002](../../docs/adr/0002-scan-scoresheet.md).
- **Profile** (your avatar, top right):
  - your name (the avatar shows your initials), bowling hand, level, and favourite
    ball (name, brand, weight);
  - an Edit sheet with checks, e.g. a weight must be 6–16 lb;
  - **Badges** and **Achievements** are placeholders, shown locked as "Coming soon".
    Their names are draft copy in `src/features/profile/placeholders.ts`.
- **Settings** (the gear, top left):
  - Switches for vibration, keeping the screen awake during a session, and showing
    the best possible score.
  - **Export all games** to a JSON file through the share sheet.
  - **Delete all games**, with a confirmation.
  - The app version and how many games are stored.
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
- Swiping back (or Android's back button) only pauses the game; see below.
- A double tap on the main button records one ball, not two.

## Code

| Path | Holds |
| --- | --- |
| `src/app/` | Routes: `(tabs)/progress`, `(tabs)/add` (the ＋ button's slot, never shown) and `(tabs)/index` (Home), in that order in the tab bar, `(tabs)/bestiary` (hidden), `settings` (opened from the gear), `profile/index` and `profile/edit` (from the avatar), `session/[id]` (live scoring), `game/[id]` (past game's report), `leave/[mask]` (one monster, as a sheet) |
| `src/components/` | `PinDeck`, `FrameStrip`, `ScoringPad`, `XpBar`, `LevelCard`, `GameReportView`, `SettingRow`, `ScanScoresheetCard`, `Avatar`, `ProfileSections`, `FormField`, `StatTile`, `LineChart`, `ChartCard`, `MiniRack`, `MonsterRow` |
| `src/features/live-scoring/` | The throw-entry rules (`entry.ts`) and the game hook (`use-live-game.ts`) |
| `src/features/history/` | Loads stored games and derives scores, XP, levels and reports with `@bowling-rpg/progression` |
| `src/features/progress/` | How Progress presents numbers: deltas, tiles, chart scales |
| `src/features/profile/` | The profile provider, the edit form's rules, and the badge and achievement placeholders |
| `src/features/settings/` | The settings provider, `useHaptics` (the only place that calls expo-haptics), and export |
| `src/features.ts` | Switches for built-but-hidden features |
| `src/db/` | SQLite migrations and every query: games, settings, export and delete |
| `src/theme.ts` | Design tokens. No colour or size value lives anywhere else |

**Storage:** the phone stores only raw balls: the `knocked` mask and a foul flag.
Scores, strikes, spares and splits are recomputed by `@bowling-rpg/scoring` every
time a game is loaded, the same code the server runs.

**IDs** are UUIDv7. A session's ID becomes its sync `clientId`.

**Charts** are drawn with `react-native-svg`, which is in Expo Go. Their colours are
the `chart` tokens in `src/theme.ts`, checked with a colour-blind-safety validator
against the card surface. Re-run it if you change them.

**Settings** live in their own SQLite table as JSON values over defaults, so adding a
setting needs no migration: add it to `DEFAULT_SETTINGS` in `src/db/settings.ts`.

**Exports** use the sync upload's shape (sessions → games → raw deliveries,
`format: "bowling-rpg.export"`, `version: 1`), so a future import or upload can read
them. There's no import yet.

## Tests

```sh
pnpm test    # 132 tests: throw entry, components, hooks, XP, settings, export, navigation, and the real SQL
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
