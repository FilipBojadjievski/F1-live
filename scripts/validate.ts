// Hard-fail validation gate for a baked replay (Design.md §6.5, Task 04 §4). Pure — returns
// human-readable error strings; the ingest script exits non-zero if the array is non-empty.

import type { ReplayFile } from '../src/replay/format.ts'

export const MAX_GZIP_BYTES = 3 * 1024 * 1024 // < 3 MB gzipped

// Order the drivers by their last position event — the finishing order the replay actually plays out.
function finalOrder(replay: ReplayFile): number[] {
  const lastPos = new Map<number, { t: number; pos: number }>()
  for (const e of replay.positions) {
    const prev = lastPos.get(e.num)
    if (!prev || e.t >= prev.t) lastPos.set(e.num, { t: e.t, pos: e.pos })
  }
  return [...lastPos.entries()].sort((a, b) => a[1].pos - b[1].pos).map(([num]) => num)
}

export function validateReplay(replay: ReplayFile, gzippedBytes: number): string[] {
  const errors: string[] = []

  // Compare only the classified drivers: the position stream also carries retired/DNS cars that
  // session_result leaves unclassified (null position), and their trailing order is not official.
  const official = replay.result.map(r => r.num)
  const classified = new Set(official)
  const played = finalOrder(replay).filter(num => classified.has(num))
  if (played.join(',') !== official.join(',')) {
    errors.push(`final position order [${played}] does not match session result [${official}]`)
  }

  if (gzippedBytes >= MAX_GZIP_BYTES) {
    errors.push(`gzipped size ${gzippedBytes} bytes is at or over the ${MAX_GZIP_BYTES}-byte cap`)
  }

  const known = new Set(replay.drivers.map(d => d.num))
  for (const { num } of replay.result) {
    if (!known.has(num)) errors.push(`classified driver ${num} is missing from drivers`)
    if (!replay.locations[num]) errors.push(`classified driver ${num} is missing from locations`)
  }

  return errors
}
