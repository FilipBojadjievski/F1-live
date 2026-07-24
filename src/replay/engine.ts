// Framework-free replay engine (Design.md §4). Turns a replay file + a timestamp into a
// full RaceState via binary search over the sorted streams — no React, no DOM.

import type { ReplayFile } from './format'

export interface OrderEntry {
  num: number
  pos: number
  gap: number // seconds to the car ahead; 0 for the leader / before the first sample
  retired: boolean
}

export interface CarPos {
  x: number
  y: number
}

export interface RaceState {
  lap: number
  order: OrderEntry[]
  cars: Record<number, CarPos>
}

// The engine consumes race data through this seam so a live adapter could replace the static
// file source later (Design.md §4). StaticFileSource is the only implementation today.
export interface RaceDataSource {
  load(round: number): Promise<ReplayFile>
}

export class StaticFileSource implements RaceDataSource {
  private readonly baseUrl: string

  // Default resolves against Vite's base so replay files load under the Pages subpath
  // (/F1-live/replays/…), not just the dev-server root.
  constructor(baseUrl = `${import.meta.env.BASE_URL}replays`) {
    this.baseUrl = baseUrl
  }

  async load(round: number): Promise<ReplayFile> {
    const res = await fetch(`${this.baseUrl}/${round}.json`)
    if (!res.ok) throw new Error(`Failed to load replay ${round}: ${res.status}`)
    return (await res.json()) as ReplayFile
  }
}

// Index of the last element whose time is <= t, or -1 if none. `time` reads the time key of the
// element at index i — streams are flat triplets ([t,x,y,...]) or object arrays, so it varies.
function latestIndexLE(length: number, t: number, time: (i: number) => number): number {
  let lo = 0
  let hi = length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (time(mid) <= t) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

export class ReplayEngine {
  speed = 1

  private file?: ReplayFile
  private clock = 0
  // Per-driver views into the (already t-sorted) global streams, for O(log n) seek per driver.
  private positionsByNum = new Map<number, { t: number; pos: number }[]>()
  private intervalsByNum = new Map<number, { t: number; gap: number }[]>()
  private retiredAt = new Map<number, number>()
  private readonly source: RaceDataSource

  constructor(source: RaceDataSource) {
    this.source = source
  }

  async load(round: number): Promise<void> {
    const file = await this.source.load(round)
    this.file = file
    this.clock = 0

    this.positionsByNum = groupBy(file.positions, p => p.num)
    this.intervalsByNum = groupBy(file.intervals, i => i.num)
    this.retiredAt = new Map(file.retirements.map(r => [r.num, r.t]))
  }

  seek(tMs: number): RaceState {
    this.clock = tMs
    return this.derive(tMs)
  }

  tick(dtMs: number): RaceState {
    this.clock += dtMs * this.speed
    return this.derive(this.clock)
  }

  private get replay(): ReplayFile {
    if (!this.file) throw new Error('ReplayEngine.load() must resolve before seek/tick')
    return this.file
  }

  private derive(t: number): RaceState {
    const file = this.replay

    const lapIdx = latestIndexLE(file.laps.length, t, i => file.laps[i].t)
    const lap = lapIdx === -1 ? 0 : file.laps[lapIdx].lap

    const order: OrderEntry[] = []
    for (const driver of file.drivers) {
      const positions = this.positionsByNum.get(driver.num)
      if (!positions) continue
      const posIdx = latestIndexLE(positions.length, t, i => positions[i].t)
      if (posIdx === -1) continue // driver has not entered the timing yet

      const intervals = this.intervalsByNum.get(driver.num) ?? []
      const gapIdx = latestIndexLE(intervals.length, t, i => intervals[i].t)
      const retiredAt = this.retiredAt.get(driver.num)

      order.push({
        num: driver.num,
        pos: positions[posIdx].pos,
        gap: gapIdx === -1 ? 0 : intervals[gapIdx].gap,
        retired: retiredAt !== undefined && retiredAt <= t,
      })
    }
    // Classified runners first (by position), retired drivers below (also by position).
    order.sort(
      (a, b) => Number(a.retired) - Number(b.retired) || a.pos - b.pos || a.num - b.num,
    )

    const cars: Record<number, CarPos> = {}
    for (const [num, stream] of Object.entries(file.locations)) {
      cars[Number(num)] = locationAt(stream, t)
    }

    return { lap, order, cars }
  }
}

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>()
  for (const item of items) {
    const k = key(item)
    const bucket = map.get(k)
    if (bucket) bucket.push(item)
    else map.set(k, [item])
  }
  return map
}

// Linear interpolation over a flat [t0,x0,y0, t1,x1,y1, ...] stream. Clamps to the first/last
// sample outside the covered range.
function locationAt(stream: number[], t: number): CarPos {
  const count = stream.length / 3
  const idx = latestIndexLE(count, t, i => stream[i * 3])

  if (idx === -1) return { x: stream[1], y: stream[2] } // before the first sample
  const base = idx * 3
  if (idx === count - 1) return { x: stream[base + 1], y: stream[base + 2] } // at/after the last

  const t0 = stream[base]
  const t1 = stream[base + 3]
  const frac = (t - t0) / (t1 - t0)
  return {
    x: stream[base + 1] + (stream[base + 4] - stream[base + 1]) * frac,
    y: stream[base + 2] + (stream[base + 5] - stream[base + 2]) * frac,
  }
}
