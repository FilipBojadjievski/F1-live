// Round selection — pure. OpenF1 has no "round" field, and its race list (full schedule) does not
// index-align with jolpica's completed-rounds list. We instead match the OpenF1 Race session whose
// start is nearest the jolpica race time; a race weekend is unique enough in time to identify it.

import type { RawSession } from './openf1.ts'

const MATCH_TOLERANCE_MS = 24 * 60 * 60_000

export function resolveSessionKey(sessions: RawSession[], raceIso: string): number {
  const target = Date.parse(raceIso)
  let best: { key: number; diff: number } | undefined
  for (const s of sessions) {
    if (s.session_name !== 'Race') continue
    const diff = Math.abs(Date.parse(s.date_start) - target)
    if (!best || diff < best.diff) best = { key: s.session_key, diff }
  }
  if (!best || best.diff > MATCH_TOLERANCE_MS) throw new Error(`no race session within a day of ${raceIso}`)
  return best.key
}

// No-arg mode: which completed rounds still lack a baked replay. Ascending, deduped.
export function roundsToBake(completedRounds: number[], indexedRounds: number[]): number[] {
  const have = new Set(indexedRounds)
  return [...new Set(completedRounds)].filter(r => !have.has(r)).sort((a, b) => a - b)
}
