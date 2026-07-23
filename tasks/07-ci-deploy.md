# Task 07 — CI: deploy + scheduled ingest

**Depends on:** 04 (ingest), 06 (complete site)
**Refs:** PRD §4.4, §6, Design.md §6

## Goal

Site live on GitHub Pages; a scheduled workflow bakes new races automatically after race weekends.

## Steps

1. `.github/workflows/deploy.yml`: on push to main — install, `npm run build`, deploy `dist/` to GitHub Pages (official Pages actions). Set Vite `base` for the Pages URL.
2. `.github/workflows/ingest.yml`:
   - `schedule`: Sun 23:00 UTC and Mon 06:00 UTC (covers all race time zones).
   - `workflow_dispatch` with optional `round` input (backfill).
   - Runs `npm run ingest` (no-arg = diff mode); if files changed, commit + push (which triggers deploy). No new race → cheap no-op.
3. Backfill: dispatch the workflow for each completed 2026 round (or run locally and push).

## Verify

- Pages URL serves the site; all routes work under the `base` path (deep-link to `/replay/:round` directly).
- Manual `workflow_dispatch` for one round: commit appears, site redeploys, new race becomes clickable.
- Cron dry-run (no new race): workflow succeeds with no commit.
- After the next real GP: race appears without manual intervention (PRD success criterion #6).
