# Design — F1 Season Hub

Technical design for the site specified in [PRD.md](PRD.md).

## 1. Architecture

Static SPA. No backend, no database, no server-side code at runtime.

```
┌─────────────────────────────── Browser ───────────────────────────────┐
│  React SPA (Vite + TypeScript)                                        │
│                                                                       │
│  Standings ──────► jolpica-f1 API (live fetch, drivers+constructors)  │
│  Races list ─────► jolpica-f1 API (calendar + results/podiums)        │
│  Replay view ────► /replays/{round}.json  (static, pre-baked)         │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────────────────── GitHub Actions ───────────────────────────┐
│  cron (Sun/Mon nights) + manual dispatch                              │
│    ingest script ──► OpenF1 historical API (throttled)                │
│                 ──► bakes public/replays/{round}.json                 │
│                 ──► commit + push ──► Pages redeploy                  │
└───────────────────────────────────────────────────────────────────────┘
```

**Why static:** personal scale, €0 budget, and the heavy data (telemetry) is immutable once a race ends — perfect for pre-baking. Standings/results are light and fetched live so they're never stale.

## 2. Data sources

| Data | Source | When fetched |
|------|--------|--------------|
| Driver & constructor standings | jolpica-f1 (`/ergast/f1/2026/driverstandings`, `/constructorstandings`) | Client, on page load |
| Race calendar + results/podiums | jolpica-f1 (`/ergast/f1/2026/races`, `/results`) | Client, on page load |
| Per-race telemetry (`position`, `intervals`, `laps`, `location`, `session_result`, `drivers`) | OpenF1 free historical tier | Ingest script only (CI) |

Users never call OpenF1 directly — its 30 req/min limit lives entirely inside the ingest script.

Client-side jolpica responses are cached in `sessionStorage` with a short TTL to avoid refetching on tab switches.

## 3. Replay file format

One JSON file per race at `public/replays/{round}.json` (served gzipped by Pages). Designed for **random seek**: every stream is a flat array sorted by `t` (milliseconds since race start), so any timestamp resolves via binary search — no event accumulation needed.

```jsonc
{
  "meta": { "round": 12, "name": "Belgian Grand Prix", "year": 2026,
            "startTime": "...", "durationMs": 5400000, "totalLaps": 44 },
  "drivers": [ { "num": 1, "code": "VER", "name": "Max Verstappen",
                 "team": "Red Bull", "color": "#3671C6" }, ... ],
  "track":   { "outline": [[x,y], ...] },        // one clean lap's location trail
  "laps":    [ { "t": 0, "lap": 1 }, ... ],       // leader lap boundaries → seek-bar markers
  "positions":  [ { "t": 12000, "num": 1, "pos": 3 }, ... ],   // change events, sorted by t
  "intervals":  [ { "t": 15000, "num": 1, "gap": 1.2 }, ... ], // sampled ~0.25 Hz, sorted by t
  "locations":  { "1": [t0, x0, y0, t1, x1, y1, ...], ... },   // per driver, flat triplets, ~1–2 Hz
  "retirements": [ { "t": 3100000, "num": 23 } ],
  "result":  [ { "pos": 1, "num": 4 }, ... ]      // official order, used for ingest validation
}
```

**Size control:** locations downsampled to ~1–2 Hz (interpolated client-side), coordinates rounded to integers in OpenF1's native units and normalized to the track bounding box. Estimate: 20 cars × ~5400 s × 2 Hz × 3 numbers ≈ manageable; target **< 3 MB gzipped**, enforced by the ingest script.

`public/replays/index.json` lists which rounds have replay data — the races screen uses it to decide clickability.

## 4. Replay engine (client)

Core module, deliberately framework-free (plain TS) so it is unit-testable and reusable if a live adapter is ever added:

```
ReplayEngine
  load(round): fetch + parse replay file
  seek(tMs):   binary-search all streams → full RaceState snapshot
  tick(dtMs):  advance clock by dt × speed → RaceState
  RaceState = { lap, order: [{num, pos, gap, retired}], cars: {num: {x, y}} }
```

- **Playback loop:** `requestAnimationFrame`; map dots interpolate linearly between location samples; tower re-renders only when the derived order/gap values change.
- **Seek:** since every stream is sorted and positions are *absolute* (each event carries the full `pos`, not a delta), state at time `t` = latest event ≤ `t` per driver. O(log n) per stream.
- **Live-adapter seam (future):** `ReplayEngine` consumes a `RaceDataSource` interface; today there is one implementation (`StaticFileSource`). A paid OpenF1 WebSocket source could implement the same interface. Nothing else is built for this now.

## 5. Frontend structure

```
src/
  api/jolpica.ts          // standings, calendar, results
  replay/engine.ts        // ReplayEngine + types (framework-free)
  replay/format.ts        // replay-file schema types (shared with ingest)
  pages/StandingsPage.tsx // tabs: Drivers | Constructors
  pages/RacesPage.tsx     // calendar cards with podiums → link to replay
  pages/ReplayPage.tsx    // layout: map + tower + transport
  components/TrackMap.tsx     // <canvas>, draws outline + dots + labels
  components/TimingTower.tsx  // ordered rows, FLIP animation on position change
  components/Transport.tsx    // play/pause, speed, seek bar with lap markers
  theme.css               // design tokens
scripts/
  ingest.ts               // Node/tsx entry: orchestration (fetch → bake → validate → write)
  openf1.ts               // OpenF1 raw types + rate-limited/retrying client (RateLimiter, withRetry)
  bake.ts                 // pure transforms: raw records → replay streams (unit-tested)
  validate.ts             // pure hard-fail gate: order/size/driver checks (unit-tested)
  rounds.ts               // pure round selection: session-key match + no-arg diff (unit-tested)
.github/workflows/
  ingest.yml              // cron + workflow_dispatch(round)
  deploy.yml              // build → GitHub Pages
```

Routing: `react-router` — `/` (standings), `/races`, `/replay/:round`.

## 6. Ingest script (`scripts/ingest.ts`)

1. Read `replays/index.json`; ask jolpica which 2026 rounds are completed; diff → rounds to bake (or take an explicit `--round n`).
2. For each round, resolve the OpenF1 `session_key` for the race, then fetch `drivers`, `position`, `intervals`, `laps`, `location` (location chunked by time window to respect response-size limits), `session_result`.
   - **Round → session:** OpenF1 exposes the *full* 24-race schedule (incl. rounds jolpica hasn't marked complete), and its chronological order does **not** index-align with jolpica's round numbers. So the round is resolved by **matching the OpenF1 Race session whose start is nearest jolpica's race time** (within a day), not by position.
   - **Empty location windows:** a session's `date_end` runs past the last real sample, so tail windows have no data — OpenF1 answers those with `404 "No results found"`, which the client treats as an empty chunk rather than a failure.
3. Throttle: global limiter well under 30 req/min (2.5 s spacing ≈ 24 req/min); retry with exponential backoff on 429/5xx and transient network errors.
4. Bake: downsample, sort, normalize → replay JSON. Derive `track.outline` from the leader's fastest clean lap. Driver accent `color` comes from OpenF1's `team_colour`. Large-array steps (bbox, duration) use running folds, not `Math.min(...spread)`, since a race holds ~10⁵ location points.
5. **Validate:** final `positions` order must equal `session_result` order **for the classified drivers** (the position stream also carries retired/DNS cars that `session_result` leaves unclassified); every classified driver must be present in `drivers` and `locations`; gzipped file must be under the 3 MB cap. Any failure → non-zero exit, no commit.
6. Update `index.json`, commit, push.

`ingest.yml` runs on cron (Sun 23:00 & Mon 06:00 UTC — covers all race time zones) and via manual dispatch with an optional round input for backfill. If no new race is found, the run is a cheap no-op.

## 7. Visual design

Dark, broadcast-inspired, minimal.

- **Tokens:** background `#0a0a0f`, panel `#15151e`, text `#f0f0f5`, muted `#8a8a99`. Team colors (2026 palette, hardcoded map in `theme.css`/`drivers` data) used only as accents: tower row bars, map dots, podium trim.
- **Type:** condensed sans for numerals/driver codes (e.g. system stack + a single hosted-locally condensed face for headings). Tabular numerals for gaps and points.
- **Tower:** fixed-height rows; position changes animate by translating rows (FLIP), ~300 ms ease. Retired rows at 40% opacity below a divider.
- **Map:** track outline as a soft gray stroke; dots ~8 px with 2 px dark ring; driver code label beside each dot, decluttered by hiding labels when zoomed-out density is too high (labels always on for top 3).
- **Layout (replay):** map takes the majority of the viewport; tower is a fixed-width right column; transport bar pinned at the bottom. On narrow screens the tower collapses under the map.
- No decorative animation beyond position/dot movement — motion is information.

## 8. Testing & verification

- **Unit (vitest):** `ReplayEngine.seek/tick` against a small fixture file — order, gaps, retirement handling, interpolation at boundaries.
- **Ingest validation** (built-in, §6.5) is the correctness gate for every baked race.
- **Manual demo check** per PRD success criteria: seek mid-race in a known GP and verify tower state against real race events.

## 9. Decisions log

| Decision | Choice | Why |
|----------|--------|-----|
| Live data | Replay engine, no paid feed | €0, demoable 24/7; seam left for live adapter |
| Live-button gating | Dropped — click a race to replay | Gating an old replay to real race windows was incoherent |
| Live view content | Track map + timing tower | User wants both; map is the showpiece |
| Standings | Drivers + constructors | Marginal cost, expected by F1 fans |
| Data refresh | GitHub Action cron | Zero-maintenance; CI/CD portfolio value |
| Stack | Vite + React + TS, canvas map | Mainstream, recognizable, right-sized |
| Seasons | 2026 only | Original ask; per-season data layout keeps door open |
| Tower detail | Order + gaps + laps + retirements | Broadcast feel without full-telemetry ingestion |
| Theme | Dark broadcast | Makes team colors and the map pop |
