# PRD — F1 Season Hub

## 1. Overview

A personal/portfolio website for following the current Formula 1 season. It shows the championship standings, the results of every completed race, and lets the user replay any race as if it were live — an animated track map with a broadcast-style timing tower.

**Owner:** Filip Bojadjievski
**Status:** Spec agreed 2026-07-23
**Scale:** Personal/portfolio. No backend, free hosting, free data sources only.

## 2. Problem & Goals

Race position data is only "live" for ~2 hours on ~24 weekends a year, and real-time feeds cost money. A portfolio site whose flagship feature is dark 99% of the time is un-demoable.

**Goals:**

1. Present the current (2026) season — standings and race results — cleanly and accurately.
2. Make every completed race watchable *any time* via a replay engine built on free historical telemetry.
3. Look good doing it: simple, dark, broadcast-inspired UI.
4. Stay maintenance-free during the season: new races appear automatically.

**Non-goals (explicitly out of scope):**

- Real-time live data (paid OpenF1 tier). The data layer must merely leave room for a live adapter later.
- Race-window gating of a "live" button — dropped in favor of click-a-race-to-replay.
- Qualifying / practice / sprint replays — race sessions only.
- Past seasons (2023–2025) — current season only. A season picker is possible later since data is organized per-season.
- Accounts, personalization, notifications, mobile apps.

## 3. Users

- **Primary:** the owner and friends watching/demoing on desktop.
- **Secondary:** recruiters/reviewers skimming a portfolio — the site must impress within 30 seconds without instructions.

## 4. Features

### 4.1 Standings screen

- Two tabs: **Drivers** and **Constructors**, powered by live API calls (jolpica-f1).
- Each row: position, name, team (color accent), points. Drivers tab also shows wins.
- Always reflects the latest official standings — no manual updates.

### 4.2 Season races screen

- Every 2026 Grand Prix in calendar order.
- Completed races show their **podium** (top 3: driver, team color, position).
- Upcoming races show date/venue, visually distinct (dimmed / "upcoming" state).
- **Clicking a completed race with baked replay data opens its replay.** Races without replay data yet are not clickable into replay (podium still shown).

### 4.3 Replay view

Per selected race:

- **Animated track map** — canvas rendering; circuit outline derived from lap telemetry; one dot per car in team color with driver code label.
- **Timing tower** — position (P1–P20), driver code, team color bar, interval to car ahead, current lap counter. Retired drivers gray out and sink to the bottom.
- **Transport controls** — play/pause, speed selector (1× / 10× / 30× / 60×, default 30× ≈ full race in ~3 minutes), seek bar with lap markers. Seeking to any timestamp reconstructs correct map + tower state.
- Clearly labeled as **Replay** (never pretends to be live).

### 4.4 Data pipeline (invisible to users)

- A scheduled GitHub Action runs after race weekends, detects newly completed races, fetches telemetry from OpenF1 (free historical tier), bakes one compact static replay file per race, commits it, and triggers a redeploy.
- Manual trigger supported for backfilling the season's earlier rounds.

## 5. Constraints

- **Budget: €0.** Free APIs (jolpica-f1, OpenF1 historical), free hosting (GitHub Pages), free CI (GitHub Actions).
- **OpenF1 free-tier rate limits:** 3 req/s, 30 req/min — ingestion must throttle; users never hit OpenF1 directly.
- **Replay file size:** target < a few MB per race (compressed) so replays start fast on a static host.
- Desktop-first; layout should degrade gracefully on mobile but mobile is not a launch criterion.

## 6. Success criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Standings match official 2026 championship | Compare rendered tables against formula1.com after latest round |
| 2 | All completed 2026 rounds listed with correct podiums | Spot-check every round against official results |
| 3 | Replay finishing order matches official race result | Automated check in ingest: last position snapshot == session result |
| 4 | Seek to any point reproduces correct order & car locations | Manual: seek mid-race, verify tower against known race events |
| 5 | Replay file per race under size target | Ingest script logs and fails the build if exceeded |
| 6 | New race appears without manual work | Observe first post-launch race weekend |
| 7 | Deployed and publicly reachable | Live GitHub Pages URL |

## 7. Future ideas (not commitments)

- Live adapter for OpenF1 paid tier (€9.90/mo) plugged behind the same replay interface.
- Tyre compound / pit stops / fastest lap in the tower ("full broadcast" mode).
- Season picker for 2023–2025.
