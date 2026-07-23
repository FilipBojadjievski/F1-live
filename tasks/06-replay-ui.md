# Task 06 — Replay view UI

**Depends on:** 03 (route/link), 05 (engine)
**Refs:** PRD §4.3, Design.md §5, §7

## Goal

`/replay/:round` — track map + timing tower + transport, driven by `ReplayEngine` on a `requestAnimationFrame` loop. Clearly labeled "Replay".

## Steps

1. `ReplayPage.tsx`: load engine for `:round`; rAF loop calls `tick`; layout — map fills most of the viewport, fixed-width tower right column, transport bar pinned bottom; tower collapses under the map on narrow screens. Header shows GP name + "REPLAY" badge.
2. `TrackMap.tsx` (canvas):
   - Track outline as soft gray stroke, scaled to fit with margin.
   - One dot per car (~8 px, team color, 2 px dark ring), positions from `RaceState.cars`.
   - Driver-code labels: always for top 3; others hidden when local density is too high.
3. `TimingTower.tsx`:
   - Rows: position, driver code, team color bar, interval to car ahead; lap counter in the header.
   - Position changes animate via FLIP (~300 ms ease).
   - Retired rows at 40% opacity below a divider.
   - Re-render only when order/gap values actually change (memo on derived state).
4. `Transport.tsx`:
   - Play/pause, speed selector 1×/10×/30×/60× (default 30×).
   - Seek bar with lap markers from `laps`; drag/click calls `engine.seek`.

## Verify

- Full playback at 30× runs smoothly (no dropped-frame jank on dev machine); final tower order matches the official result.
- Seeking mid-race instantly shows correct order and car locations (spot-check against a known race event, e.g. a documented overtake or retirement lap).
- Pause, speed change, and seek compose correctly (no drift or double-ticking).
- Tower animation triggers only on real position changes.
