# ADR 0002: Logging a game from a photo of the lane's score screen

**Status:** Proposed. Only a placeholder exists: the "Scan scoresheet · Coming soon"
card on Home (`apps/mobile/src/components/ScanScoresheetCard.tsx`).
**Date:** 2026-09-30

## Context

Bowlers log each ball on the pin deck: about 20 taps a game. Photographing the
overhead score screen could log a whole game at once, and could be done after the
game rather than between throws. The design doc calls this the biggest
differentiator available, and places it in Phase 4.

## The constraint that shapes it

Score screens show **marks and counts** per ball (X, /, 7, -, F) and running totals.
Most don't show **which** pins were left. The app stores which pins fell on every
ball, so a scanned game carries less:

| Still works | Lost, or only where the machine shows it |
| --- | --- |
| Score, XP, levels, strike/spare/open rates, averages, charts | Which leave was faced; split stats (some machines circle splits); spare conversion by leave; the bestiary; per-ball timestamps |

So scanned balls need a **"pins unknown" state**, and pin-based features must skip
them.

## Options for reading the photo

**A. On-device OCR** (Apple Vision, Google ML Kit)
- **For:** free, offline, private, fast.
- **Against:** returns loose text, so the scoresheet grid has to be rebuilt by hand.
  It struggles with X, / and - symbols, circled splits, glare, angles and brand
  layouts (Brunswick, QubicaAMF, Steltronic). It needs a development build, since
  Expo Go can't load those native modules.

**B. A cloud vision model, called through `apps/api`**
- **For:** handles layout and brand variety much better, returns structured JSON,
  and works in Expo Go (the phone only uploads).
- **Against:** a cost per photo, needs internet, takes a few seconds, and photos
  contain other bowlers' names (privacy). It needs the API deployed with sign-in
  and rate limits. The model's key lives on the server only.

**C. A custom-trained model**
- **For:** the best accuracy long-term.
- **Against:** needs hundreds to thousands of labelled photos across brands, plus
  machine-learning expertise. Not a starting point.

## Proposed approach

1. **Keep the pin deck as the main input.** Scanning is a second way in for when
   pin detail doesn't matter.
2. **Prototype with option B:** one bowler per photo, and a review screen every time.
3. **Check every scan against the screen itself.** Rescore the recognised marks with
   `@bowling-rpg/scoring`. If the result doesn't match the running totals in the
   photo, highlight those frames for the user to fix. A scan is never saved without
   the user confirming it.
4. **Discard photos after reading them**, unless a verified-leaderboard feature later
   needs them as evidence.

## What building it needs

- **Camera:** `expo-image-picker` or `expo-camera` (both in Expo Go), plus
  downscaling the image before upload.
- **Data model:** balls with a pin *count* and no mask, across the phone SQLite,
  `packages/contracts`, and `packages/db` (`throws.pins_knocked` nullable, plus a
  count). The scoring engine also needs a count-only mode.
- **Review screen:** the parsed game in the existing `FrameStrip`, with doubtful
  frames highlighted and tap-to-correct.
- **Choosing the bowler:** screens show several bowlers; pick a row, remembered by name.
- **For option B:** an ingest endpoint, sign-in, rate limiting, and hosting.
- **A test set:** 50–100 real photos from the centres the app is used at, to measure
  accuracy before shipping.

## Consequences

- **Faster logging, at the cost of pin-level detail** for scanned games.
- **Every pin-based stat must handle "pins unknown"** from the day scanning ships.
- **Option B makes the server a hard dependency.** Today the app works fully offline.

## To decide before building

- **Option A or B**, which follows from whether the app stays offline-only.
- **Whether the centres in scope have their own score export or app.** Reading data
  directly beats reading a photo, so check before building a scanner.
