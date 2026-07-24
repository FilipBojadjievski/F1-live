# Task 04 — Ingest script & replay file format

**Depends on:** 01 (repo). Independent of 02–03.
**Refs:** PRD §4.4, §5, Design.md §3, §6

## Goal

`npm run ingest -- --round <n>` fetches one race from OpenF1's free historical tier and bakes a validated `public/replays/{round}.json` per the format in Design.md §3, plus updates `index.json`.

## Steps

Pure logic is split into unit-tested modules (`scripts/bake.ts`, `validate.ts`, `rounds.ts`, and the
client in `openf1.ts`); `ingest.ts` stays thin I/O glue. Run with `tsx` (added as a dev dep, plus
`@types/node`); `npm run ingest -- --round <n>`.

1. `src/replay/format.ts`: TypeScript types for the replay file (shared client/ingest).
2. `scripts/ingest.ts` (run with `tsx`):
   - Resolve the race `session_key` by **matching the OpenF1 Race session nearest jolpica's race time**
     (within a day) — OpenF1 lists the full 24-race schedule and does *not* index-align with jolpica's
     round numbers, so positional `round → Nth session` bakes the wrong race.
   - Fetch `drivers`, `position`, `intervals`, `laps`, `location` (chunk `location` by time window;
     a `404 "No results found"` on a tail window = empty chunk, not a failure), `session_result`.
   - Global rate limiter well under 30 req/min (2.5 s spacing); exponential backoff + retry on 429/5xx
     and transient network errors.
3. Bake:
   - `positions` sorted by `t` (ms since race start), absolute, change-events only; `intervals` sorted,
     absolute (leader's null gap dropped).
   - `locations` downsampled to ~2 Hz, flat `[t,x,y,...]` per driver, integer coords normalized to the
     bounding box. Bbox/duration use running folds (not `Math.min(...spread)`) — a race has ~10⁵ points.
   - `track.outline` from the leader's fastest clean (non-pit) lap; driver `color` from OpenF1 `team_colour`.
   - `laps` from leader lap boundaries; `retirements` (DNF flag, timed at last position update);
     `result` from `session_result` (unclassified null-position rows dropped).
4. Validate (hard fail, non-zero exit):
   - Final positions order == `session_result` order **for the classified drivers** (the position stream
     also carries retired/DNS cars that `session_result` leaves unclassified).
   - Gzipped size < 3 MB.
   - All classified drivers present in `drivers` and `locations`.
5. Write file + update `public/replays/index.json` (rounds kept sorted + unique → idempotent).
6. No-arg mode: diff jolpica's completed rounds against `index.json`, bake whatever is missing.

## Verify

- Bake one known race; validation passes; logged gzipped size < 3 MB.
- Baked `result` matches the official classification on formula1.com.
- Re-running is idempotent (no-op or identical output).
- Rate limiter observable in logs (no 429s on a full run).
