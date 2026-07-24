// Hard-fail validation gate for a baked replay (Design.md §6.5, Task 04 §4). Pure — returns
// human-readable error strings; the ingest script exits non-zero if the array is non-empty.

import type { ReplayFile } from '../src/replay/format.ts'

export const MAX_GZIP_BYTES = 3 * 1024 * 1024 // < 3 MB gzipped

export function validateReplay(replay: ReplayFile, gzippedBytes: number): string[] {
  const errors: string[] = []

  // session_result is the authoritative finishing order: it reflects post-race penalties, which the
  // live position stream does not. So we don't assert the position stream matches it — the two
  // legitimately disagree when a car is reclassified after the flag.

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
