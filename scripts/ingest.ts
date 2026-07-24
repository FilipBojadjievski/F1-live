// Ingest CLI (Design.md §6, Task 04). Fetches one race's telemetry from OpenF1, bakes a validated
// replay file, and updates the index. Run with tsx:
//   npm run ingest -- --round 12   (bake a specific round)
//   npm run ingest                 (no-arg: bake every completed round missing from the index)
//
// Pure logic lives in bake.ts / validate.ts / rounds.ts (unit-tested). This file is only I/O glue.

import { gzipSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bake } from './bake.ts'
import {
  fetchDrivers,
  fetchIntervals,
  fetchLaps,
  fetchLocations,
  fetchPositions,
  fetchSessionResult,
  fetchSessions,
} from './openf1.ts'
import { resolveSessionKey, roundsToBake } from './rounds.ts'
import { MAX_GZIP_BYTES, validateReplay } from './validate.ts'

const REPLAYS_DIR = join('public', 'replays')
const INDEX_PATH = join(REPLAYS_DIR, 'index.json')
const JOLPICA = 'https://api.jolpi.ca/ergast/f1/2026'

interface CompletedRace {
  round: number
  name: string
  raceIso: string // scheduled start, used to match the OpenF1 session
}

// jolpica /results/1/ lists exactly the races that have a P1 finisher — i.e. the completed ones.
async function fetchCompletedRaces(): Promise<CompletedRace[]> {
  const res = await fetch(`${JOLPICA}/results/1/`)
  if (!res.ok) throw new Error(`jolpica ${res.status} for completed races`)
  const json = (await res.json()) as {
    MRData: { RaceTable: { Races: { round: string; raceName: string; date: string; time?: string }[] } }
  }
  return json.MRData.RaceTable.Races.map(r => ({
    round: Number(r.round),
    name: r.raceName,
    raceIso: `${r.date}T${r.time ?? '00:00:00Z'}`,
  }))
}

function readIndex(): { rounds: number[] } {
  try {
    return JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as { rounds: number[] }
  } catch {
    return { rounds: [] }
  }
}

function parseRoundArg(argv: string[]): number | undefined {
  const i = argv.indexOf('--round')
  if (i === -1) return undefined
  const n = Number(argv[i + 1])
  if (!Number.isInteger(n) || n < 1) throw new Error(`--round expects a positive integer, got "${argv[i + 1]}"`)
  return n
}

async function bakeRound(race: CompletedRace, sessions: Awaited<ReturnType<typeof fetchSessions>>) {
  const { round, name } = race
  console.log(`\n▶ Round ${round} — ${name}`)
  const sessionKey = resolveSessionKey(sessions, race.raceIso)
  const session = sessions.find(s => s.session_key === sessionKey)!

  const [drivers, positions, intervals, laps, result] = await Promise.all([
    fetchDrivers(sessionKey),
    fetchPositions(sessionKey),
    fetchIntervals(sessionKey),
    fetchLaps(sessionKey),
    fetchSessionResult(sessionKey),
  ])
  const locations = await fetchLocations(sessionKey, session.date_start, session.date_end)

  const replay = bake({ round, raceName: name, session, drivers, positions, intervals, laps, locations, result })

  const json = JSON.stringify(replay)
  const gzippedBytes = gzipSync(json).length
  console.log(`  baked: ${(json.length / 1e6).toFixed(2)} MB raw, ${(gzippedBytes / 1e6).toFixed(2)} MB gzipped`)

  const errors = validateReplay(replay, gzippedBytes)
  if (errors.length) {
    for (const e of errors) console.error(`  ✗ ${e}`)
    throw new Error(`round ${round} failed validation`)
  }

  mkdirSync(REPLAYS_DIR, { recursive: true })
  writeFileSync(join(REPLAYS_DIR, `${round}.json`), json)

  const rounds = [...new Set([...readIndex().rounds, round])].sort((a, b) => a - b)
  writeFileSync(INDEX_PATH, `${JSON.stringify({ rounds })}\n`)
  console.log(`  ✓ wrote ${round}.json (size ${gzippedBytes} B < ${MAX_GZIP_BYTES} B cap)`)
}

async function main() {
  const only = parseRoundArg(process.argv.slice(2))
  const completed = await fetchCompletedRaces()
  const byRound = new Map(completed.map(r => [r.round, r]))

  const rounds = only ? [only] : roundsToBake(completed.map(r => r.round), readIndex().rounds)
  if (!rounds.length) {
    console.log('Nothing to bake — every completed round is already in the index.')
    return
  }
  console.log(`Baking rounds: ${rounds.join(', ')}`)

  const sessions = await fetchSessions(2026)
  for (const round of rounds) {
    const race = byRound.get(round)
    if (!race) throw new Error(`round ${round} is not a completed 2026 race`)
    await bakeRound(race, sessions)
  }
  console.log('\nDone.')
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
