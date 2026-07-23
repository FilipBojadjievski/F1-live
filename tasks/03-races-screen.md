# Task 03 — Season races screen

**Depends on:** 02 (jolpica client, team colors)
**Refs:** PRD §4.2, Design.md §2, §3 (`index.json`), §5

## Goal

`/races` lists every 2026 Grand Prix in calendar order; completed races show their podium; races with baked replay data link to `/replay/:round`.

## Steps

1. Extend `src/api/jolpica.ts`: season calendar + race results (`/ergast/f1/2026/results/` per round or the season results endpoint).
2. Fetch `public/replays/index.json` (may not exist yet — treat 404 as "no replays"). Create a placeholder `index.json` (`{"rounds": []}`) now so the shape is fixed.
3. `RacesPage.tsx`: one card per round — round number, GP name, circuit, date.
   - Completed: podium top 3 (position, driver code/name, team color trim).
   - Upcoming: dimmed card, date/venue only.
   - Replay available (round in `index.json`): card is a link to `/replay/:round`, with a visible "Replay" affordance. Completed-but-no-replay: podium shown, not clickable into replay.

## Verify

- Every completed 2026 round appears with the correct podium (spot-check all rounds against official results).
- Upcoming races render dimmed, in date order.
- With a hand-edited `index.json` containing one round, only that card links to the replay route.
