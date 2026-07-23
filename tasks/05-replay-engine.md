# Task 05 — Replay engine (core, framework-free)

**Depends on:** 04 (format + one real baked file for fixtures)
**Refs:** Design.md §4, §8

## Goal

`src/replay/engine.ts`: a plain-TS, unit-tested `ReplayEngine` that turns a replay file + a timestamp into a full `RaceState` — no React, no DOM.

## Steps

1. Define the `RaceDataSource` interface and its only current implementation, `StaticFileSource` (fetch + parse `/replays/{round}.json`).
2. `ReplayEngine`:
   - `load(round)`, `seek(tMs)`, `tick(dtMs)` with a speed multiplier.
   - `seek`: binary search each sorted stream for latest event ≤ t → `RaceState { lap, order: [{num, pos, gap, retired}], cars: {num: {x, y}} }`.
   - Car x/y linearly interpolated between location samples.
   - Retired drivers: flagged from `retirements`, sorted below classified runners.
3. Vitest suite against a small hand-written fixture plus a trimmed slice of the real baked file:
   - order correct at t=0, mid-race, and end (end == official result),
   - seek(t) equals playing forward to t,
   - interpolation at and between sample boundaries,
   - retirement transitions,
   - gap values match fixture intervals.

## Verify

- `npm test` green.
- `engine.seek(durationMs).order` equals the file's `result` for the real baked race.
