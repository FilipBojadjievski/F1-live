# Tasks

Build order for F1 Season Hub. Each task has its own goal, steps, and verification; refs point into [PRD.md](../PRD.md) and [Design.md](../Design.md).

| # | Task | Depends on |
|---|------|-----------|
| 01 | [Project scaffold](01-scaffold.md) | — |
| 02 | [Standings screen](02-standings-screen.md) | 01 |
| 03 | [Season races screen](03-races-screen.md) | 02 |
| 04 | [Ingest script & replay format](04-ingest-script.md) | 01 |
| 05 | [Replay engine](05-replay-engine.md) | 04 |
| 06 | [Replay view UI](06-replay-ui.md) | 03, 05 |
| 07 | [CI: deploy + scheduled ingest](07-ci-deploy.md) | 04, 06 |

Note: 04–05 (data pipeline) are independent of 02–03 (screens) and can be worked in parallel.
