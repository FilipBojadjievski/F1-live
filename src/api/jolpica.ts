// jolpica-f1 fetchers — Design.md §2. Responses cached in sessionStorage with a short TTL.

const BASE = 'https://api.jolpi.ca/ergast/f1/2026'
const TTL_MS = 5 * 60_000

export interface DriverStanding {
  position: string
  points: string
  wins: string
  Driver: {
    driverId: string
    code?: string
    givenName: string
    familyName: string
  }
  Constructors: { constructorId: string; name: string }[]
}

export interface ConstructorStanding {
  position: string
  points: string
  wins: string
  Constructor: { constructorId: string; name: string }
}

export interface Race {
  round: string
  raceName: string
  date: string
  Circuit: { circuitId: string; circuitName: string }
}

export interface RaceResult {
  position: string
  Driver: {
    driverId: string
    code?: string
    givenName: string
    familyName: string
  }
  Constructor: { constructorId: string; name: string }
}

interface StandingsResponse {
  MRData: {
    StandingsTable: {
      StandingsLists: {
        DriverStandings?: DriverStanding[]
        ConstructorStandings?: ConstructorStanding[]
      }[]
    }
  }
}

interface RaceTableResponse {
  MRData: {
    RaceTable: { Races: (Race & { Results?: RaceResult[] })[] }
  }
}

async function fetchCached<J, T>(path: string, extract: (json: J) => T): Promise<T> {
  const key = `jolpica:${path}`
  const hit = sessionStorage.getItem(key)
  if (hit) {
    const { at, data } = JSON.parse(hit) as { at: number; data: T }
    if (Date.now() - at < TTL_MS) return data
  }
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`jolpica ${res.status} for ${path}`)
  const data = extract(await res.json())
  sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }))
  return data
}

export function fetchDriverStandings(): Promise<DriverStanding[]> {
  return fetchCached(
    '/driverstandings/',
    (json: StandingsResponse) => json.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [],
  )
}

export function fetchRaces(): Promise<Race[]> {
  return fetchCached('/races/', (json: RaceTableResponse) => json.MRData.RaceTable.Races)
}

// Podiums for every completed round, keyed by round, sorted P1→P3.
// /results/{pos}/ returns each race's finisher at that position — 3 requests for the season.
export async function fetchPodiums(): Promise<Record<string, RaceResult[]>> {
  const perPosition = await Promise.all(
    ['1', '2', '3'].map(pos =>
      fetchCached(`/results/${pos}/`, (json: RaceTableResponse) => json.MRData.RaceTable.Races),
    ),
  )
  const podiums: Record<string, RaceResult[]> = {}
  for (const races of perPosition) {
    for (const race of races) {
      const result = race.Results?.[0]
      if (result) (podiums[race.round] ??= []).push(result)
    }
  }
  for (const round of Object.keys(podiums)) {
    podiums[round].sort((a, b) => Number(a.position) - Number(b.position))
  }
  return podiums
}

export function fetchConstructorStandings(): Promise<ConstructorStanding[]> {
  return fetchCached(
    '/constructorstandings/',
    (json: StandingsResponse) =>
      json.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [],
  )
}
