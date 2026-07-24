// Replay-file schema — Design.md §3. Shared between the client replay engine and the ingest script.
// Every time-series stream is a flat array sorted by `t` (ms since race start) for O(log n) random seek.

export interface ReplayMeta {
  round: number
  name: string
  year: number
  startTime: string // ISO timestamp of the race start (lights out)
  durationMs: number
  totalLaps: number
}

export interface ReplayDriver {
  num: number
  code: string // 3-letter acronym, e.g. "VER"
  name: string
  team: string
  color: string // hex, "#RRGGBB"
}

export interface ReplayTrack {
  outline: [number, number][] // one clean lap's normalized location trail
}

export interface LapMarker {
  t: number
  lap: number
}

export interface PositionEvent {
  t: number
  num: number
  pos: number // absolute position (1..N)
}

export interface IntervalSample {
  t: number
  num: number
  gap: number | string // seconds to the car ahead, or a lapped-car label ("+1 LAP")
}

// Per driver number (as string key) → flat [t0, x0, y0, t1, x1, y1, ...] triplets, sorted by t.
export type LocationStream = Record<string, number[]>

export interface Retirement {
  t: number
  num: number
}

export interface ResultEntry {
  pos: number
  num: number
}

export interface ReplayFile {
  meta: ReplayMeta
  drivers: ReplayDriver[]
  track: ReplayTrack
  laps: LapMarker[]
  positions: PositionEvent[]
  intervals: IntervalSample[]
  locations: LocationStream
  retirements: Retirement[]
  result: ResultEntry[]
}
