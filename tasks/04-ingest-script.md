# Task 04 — Ingest script & replay file format

**Depends on:** 01 (repo). Independent of 02–03.
**Refs:** PRD §4.4, §5, Design.md §3, §6

## Goal

`npm run ingest -- --round <n>` fetches one race from OpenF1's free historical tier and bakes a validated `public/replays/{round}.json` per the format in Design.md §3, plus updates `index.json`.

## Steps

1. `src/replay/format.ts`: TypeScript types for the replay file (shared client/ingest).
2. `scripts/ingest.ts` (run with `tsx`):
   - Resolve the race `session_key` from OpenF1 `sessions` (year=2026, round → meeting).
   - Fetch `drivers`, `position`, `intervals`, `laps`, `location` (chunk `location` by time window), `session_result`.
   - Global rate limiter well under 30 req/min; backoff + retry on 429/5xx.
3. Bake:
   - `positions`/`intervals` sorted by `t` (ms since race start), absolute values.
   - `locations` downsampled to ~1–2 Hz, flat `[t,x,y,...]` per driver, integer coords normalized to bounding box.
   - `track.outline` from the leader's fastest clean lap.
   - `laps` from leader lap boundaries; `retirements`; `result` from `session_result`.
4. Validate (hard fail, non-zero exit):
   - Final positions order == `session_result` order.
   - Gzipped size < 3 MB.
   - All classified drivers present in `drivers` and `locations`.
5. Write file + update `public/replays/index.json`.
6. No-arg mode: diff jolpica's completed rounds against `index.json`, bake whatever is missing.

## Verify

- Bake one known race; validation passes; logged gzipped size < 3 MB.
- Baked `result` matches the official classification on formula1.com.
- Re-running is idempotent (no-op or identical output).
- Rate limiter observable in logs (no 429s on a full run).
