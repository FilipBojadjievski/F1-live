// OpenF1 free historical tier — raw record shapes. The rate-limited client lives further down.
// Docs: https://openf1.org/. Timestamps are ISO strings; `team_colour` is hex WITHOUT a leading '#'.

export interface RawSession {
  session_key: number
  session_name: string // "Race", "Qualifying", ...
  date_start: string
  date_end: string
  year: number
  meeting_key: number
}

export interface RawDriver {
  driver_number: number
  name_acronym: string
  full_name: string
  team_name: string
  team_colour: string // "RRGGBB", no '#'
}

export interface RawPosition {
  date: string
  driver_number: number
  position: number
}

export interface RawInterval {
  date: string
  driver_number: number
  interval: number | null // gap to car ahead, seconds; null for the leader
}

export interface RawLap {
  date_start: string | null
  driver_number: number
  lap_number: number
  lap_duration: number | null
  is_pit_out_lap: boolean
}

export interface RawLocation {
  date: string
  driver_number: number
  x: number
  y: number
}

export interface RawSessionResult {
  position: number | null // null when not classified (DNS)
  driver_number: number
  dnf: boolean // did not finish (retired)
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Global limiter: guarantees at least `intervalMs` between successive acquisitions so the whole
// ingest run stays well under OpenF1's 30 req/min ceiling. Serialises via a single `next` cursor.
export class RateLimiter {
  private next = 0
  private readonly intervalMs: number

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs
  }

  async acquire(): Promise<void> {
    const now = Date.now()
    const scheduled = Math.max(now, this.next)
    this.next = scheduled + this.intervalMs
    const wait = scheduled - now
    if (wait > 0) await sleep(wait)
  }
}

export interface RetryOptions {
  retries: number
  baseDelayMs: number
  isRetryable: (error: unknown) => boolean
}

// Run `fn`, retrying only retryable failures (429/5xx) with exponential backoff. Non-retryable
// errors propagate immediately; once retries are exhausted the last error is rethrown.
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= opts.retries || !opts.isRetryable(error)) throw error
      await sleep(opts.baseDelayMs * 2 ** attempt)
    }
  }
}

// ── Network client ────────────────────────────────────────────────────────────────────────
// Rate-limited, retrying access to the OpenF1 free tier. Users never touch this — it runs only
// in the ingest script, which is why the 30 req/min limit lives entirely here.

const BASE = 'https://api.openf1.org/v1'
const REQUEST_INTERVAL_MS = 2500 // 24 req/min — comfortably under the 30 req/min ceiling
const LOCATION_CHUNK_MS = 5 * 60_000 // fetch location in 5-minute windows to keep responses small

const limiter = new RateLimiter(REQUEST_INTERVAL_MS)

const httpStatus = (e: unknown): number | undefined => (e as { status?: number }).status

async function getJson<T>(url: string): Promise<T> {
  return withRetry(
    async () => {
      await limiter.acquire()
      console.log(`  GET ${url}`)
      const res = await fetch(url)
      if (!res.ok) {
        const err = new Error(`OpenF1 ${res.status} for ${url}`) as Error & { status: number }
        err.status = res.status
        throw err
      }
      return (await res.json()) as T
    },
    {
      retries: 5,
      baseDelayMs: 1000,
      // Retry throttling, server errors, and transient network failures (no status).
      isRetryable: e => {
        const s = httpStatus(e)
        return s === undefined || s === 429 || s >= 500
      },
    },
  )
}

export const fetchSessions = (year: number) =>
  getJson<RawSession[]>(`${BASE}/sessions?year=${year}&session_name=Race`)

export const fetchDrivers = (sessionKey: number) =>
  getJson<RawDriver[]>(`${BASE}/drivers?session_key=${sessionKey}`)

export const fetchPositions = (sessionKey: number) =>
  getJson<RawPosition[]>(`${BASE}/position?session_key=${sessionKey}`)

export const fetchIntervals = (sessionKey: number) =>
  getJson<RawInterval[]>(`${BASE}/intervals?session_key=${sessionKey}`)

export const fetchLaps = (sessionKey: number) =>
  getJson<RawLap[]>(`${BASE}/laps?session_key=${sessionKey}`)

export const fetchSessionResult = (sessionKey: number) =>
  getJson<RawSessionResult[]>(`${BASE}/session_result?session_key=${sessionKey}`)

// Location is far larger than the other streams, so fetch it in time windows (Design.md §6.2).
// A session's date_end runs past the last real sample, so tail windows legitimately have no data —
// OpenF1 answers those with 404 "No results found", which we treat as an empty chunk, not a failure.
export async function fetchLocations(sessionKey: number, startIso: string, endIso: string): Promise<RawLocation[]> {
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  const all: RawLocation[] = []
  for (let from = start; from < end; from += LOCATION_CHUNK_MS) {
    const to = Math.min(from + LOCATION_CHUNK_MS, end)
    const q = `date%3E=${new Date(from).toISOString()}&date%3C${new Date(to).toISOString()}`
    try {
      const chunk = await getJson<RawLocation[]>(`${BASE}/location?session_key=${sessionKey}&${q}`)
      for (const row of chunk) all.push(row) // avoid push(...spread) — chunks hold tens of thousands of rows
    } catch (e) {
      if (httpStatus(e) !== 404) throw e // 404 = empty window; anything else is a real failure
    }
  }
  return all
}
