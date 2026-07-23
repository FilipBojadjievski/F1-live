# Task 02 — Standings screen

**Depends on:** 01
**Refs:** PRD §4.1, Design.md §2, §5, §7

## Goal

`/` shows live 2026 championship standings: Drivers and Constructors tabs, dark broadcast styling with team-color accents.

## Steps

1. `src/api/jolpica.ts`: typed fetchers for
   - `https://api.jolpi.ca/ergast/f1/2026/driverstandings/`
   - `https://api.jolpi.ca/ergast/f1/2026/constructorstandings/`
   Cache responses in `sessionStorage` with a short TTL (~5 min).
2. Team-color map (2026 palette) as a shared constant.
3. `StandingsPage.tsx`: tab switcher; table rows — position, name, team (color bar accent), points; wins column on Drivers tab.
4. Loading and error states (muted text, retry button).

## Verify

- Rendered drivers standings match formula1.com for the latest completed round (spot-check top 5 + points).
- Constructors tab matches official constructors table.
- Tab switch does not refetch (sessionStorage cache hit).
