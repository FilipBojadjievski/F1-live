// Pure transforms: raw OpenF1 records → replay-file streams (Design.md §3, Task 04 §3).
// No I/O here — the ingest script fetches, calls these, then validates and writes.

import type {
  IntervalSample,
  LapMarker,
  LocationStream,
  PositionEvent,
  ReplayDriver,
  ReplayFile,
  Retirement,
  ResultEntry,
} from '../src/replay/format.ts'
import type {
  RawDriver,
  RawInterval,
  RawLap,
  RawLocation,
  RawPosition,
  RawSession,
  RawSessionResult,
} from './openf1.ts'

// ~2 Hz location samples — interpolated client-side (Design.md §3).
const LOCATION_PERIOD_MS = 500

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const toMs = (date: string, startTime: string) => Date.parse(date) - Date.parse(startTime)

// Absolute position change-events, sorted by t. Consecutive same-position samples per driver
// are dropped so the stream carries only the moments a driver's position actually changes.
export function bakePositions(raw: RawPosition[], startTime: string): PositionEvent[] {
  const sorted = [...raw].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date) || a.driver_number - b.driver_number,
  )
  const last = new Map<number, number>()
  const out: PositionEvent[] = []
  for (const r of sorted) {
    if (last.get(r.driver_number) === r.position) continue
    last.set(r.driver_number, r.position)
    out.push({ t: toMs(r.date, startTime), num: r.driver_number, pos: r.position })
  }
  return out
}

// Absolute gap-to-car-ahead samples, sorted by t. Leader samples (null interval) are dropped.
export function bakeIntervals(raw: RawInterval[], startTime: string): IntervalSample[] {
  return raw
    .filter((r): r is RawInterval & { interval: number } => r.interval !== null)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.driver_number - b.driver_number)
    .map(r => ({ t: toMs(r.date, startTime), num: r.driver_number, gap: r.interval }))
}

// Bounding box over every location point — the shared frame for both car dots and track outline.
// Computed with a running fold (not Math.min(...spread)) because a race has ~10^5 location points.
export function boundingBox(raw: RawLocation[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of raw) {
    if (r.x < minX) minX = r.x
    if (r.x > maxX) maxX = r.x
    if (r.y < minY) minY = r.y
    if (r.y > maxY) maxY = r.y
  }
  return { minX, minY, maxX, maxY }
}

const normX = (x: number, b: BBox) => Math.round(x - b.minX)
const normY = (y: number, b: BBox) => Math.round(y - b.minY)

// Per-driver flat [t,x,y,...] triplets: downsampled to one sample per `periodMs` bucket,
// coordinates normalized to the bbox origin as integers, sorted by t.
export function bakeLocations(
  raw: RawLocation[],
  startTime: string,
  bbox: BBox,
  periodMs: number,
): LocationStream {
  const sorted = [...raw].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const stream: LocationStream = {}
  const lastBucket = new Map<number, number>()
  for (const r of sorted) {
    const t = toMs(r.date, startTime)
    const bucket = Math.floor(t / periodMs)
    if (lastBucket.get(r.driver_number) === bucket) continue
    lastBucket.set(r.driver_number, bucket)
    ;(stream[r.driver_number] ??= []).push(t, normX(r.x, bbox), normY(r.y, bbox))
  }
  return stream
}

// The leader's fastest non-pit lap traced as a normalized [x,y] path — the track outline.
export function deriveOutline(
  leaderNum: number,
  laps: RawLap[],
  locations: RawLocation[],
  bbox: BBox,
): [number, number][] {
  const clean = laps.filter(
    (l): l is RawLap & { date_start: string; lap_duration: number } =>
      l.driver_number === leaderNum && !l.is_pit_out_lap && l.date_start !== null && l.lap_duration !== null,
  )
  const fastest = clean.reduce((best, l) => (l.lap_duration < best.lap_duration ? l : best))
  const start = Date.parse(fastest.date_start)
  const end = start + fastest.lap_duration * 1000
  return locations
    .filter(r => r.driver_number === leaderNum)
    .filter(r => {
      const d = Date.parse(r.date)
      return d >= start && d < end
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map(r => [normX(r.x, bbox), normY(r.y, bbox)])
}

// Leader lap-start boundaries → seek-bar markers, in lap order. Laps without a timestamp are skipped.
export function bakeLaps(leaderNum: number, laps: RawLap[], startTime: string): LapMarker[] {
  return laps
    .filter((l): l is RawLap & { date_start: string } => l.driver_number === leaderNum && l.date_start !== null)
    .sort((a, b) => a.lap_number - b.lap_number)
    .map(l => ({ t: toMs(l.date_start, startTime), lap: l.lap_number }))
}

// Official classification, sorted by finishing position. Unclassified entries (null position) are dropped.
export function bakeResult(result: RawSessionResult[]): ResultEntry[] {
  return result
    .filter((r): r is RawSessionResult & { position: number } => r.position !== null)
    .sort((a, b) => a.position - b.position)
    .map(r => ({ pos: r.position, num: r.driver_number }))
}

// One entry per retired (DNF) driver, timed at that driver's last known position update.
export function bakeRetirements(result: RawSessionResult[], positions: PositionEvent[]): Retirement[] {
  return result
    .filter(r => r.dnf)
    .map(r => {
      const t = positions.filter(p => p.num === r.driver_number).reduce((m, p) => Math.max(m, p.t), 0)
      return { t, num: r.driver_number }
    })
    .sort((a, b) => a.t - b.t || a.num - b.num)
}

export function bakeDrivers(drivers: RawDriver[]): ReplayDriver[] {
  return [...drivers]
    .sort((a, b) => a.driver_number - b.driver_number)
    .map(d => ({
      num: d.driver_number,
      code: d.name_acronym,
      name: d.full_name,
      team: d.team_name,
      color: `#${d.team_colour}`,
    }))
}

export interface BakeInput {
  round: number
  raceName: string
  session: RawSession
  drivers: RawDriver[]
  positions: RawPosition[]
  intervals: RawInterval[]
  laps: RawLap[]
  locations: RawLocation[]
  result: RawSessionResult[]
}

// Assemble one race's raw OpenF1 records into a complete replay file. Pure — no I/O.
export function bake(input: BakeInput): ReplayFile {
  const startTime = input.session.date_start
  const bbox = boundingBox(input.locations)

  const result = bakeResult(input.result)
  const leaderNum = result[0].num // P1 finisher drives the outline and lap markers

  const positions = bakePositions(input.positions, startTime)
  const intervals = bakeIntervals(input.intervals, startTime)
  const locations = bakeLocations(input.locations, startTime, bbox, LOCATION_PERIOD_MS)
  const laps = bakeLaps(leaderNum, input.laps, startTime)

  const maxOf = <T>(arr: T[], get: (x: T) => number) => arr.reduce((m, x) => Math.max(m, get(x)), 0)
  const durationMs = Math.max(
    maxOf(positions, p => p.t),
    maxOf(intervals, i => i.t),
    maxOf(laps, l => l.t),
    maxOf(Object.values(locations), s => s[s.length - 3] ?? 0), // last t triplet per driver
  )
  const totalLaps = Math.max(0, ...input.laps.filter(l => l.driver_number === leaderNum).map(l => l.lap_number))

  return {
    meta: {
      round: input.round,
      name: input.raceName,
      year: input.session.year,
      startTime,
      durationMs,
      totalLaps,
    },
    drivers: bakeDrivers(input.drivers),
    track: { outline: deriveOutline(leaderNum, input.laps, input.locations, bbox) },
    laps,
    positions,
    intervals,
    locations,
    retirements: bakeRetirements(input.result, positions),
    result,
  }
}
