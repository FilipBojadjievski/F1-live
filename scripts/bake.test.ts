import { expect, it } from 'vitest'
import type { PositionEvent } from '../src/replay/format'
import {
  bake,
  bakeDrivers,
  bakeIntervals,
  bakeLaps,
  bakeLocations,
  bakePositions,
  bakeResult,
  bakeRetirements,
  boundingBox,
  deriveOutline,
} from './bake'
import type {
  RawDriver,
  RawInterval,
  RawLap,
  RawLocation,
  RawPosition,
  RawSession,
  RawSessionResult,
} from './openf1'

const START = '2026-07-24T13:00:00.000Z'
const at = (secs: number) => new Date(Date.parse(START) + secs * 1000).toISOString()

it('bakePositions sorts by t and keeps only change events per driver', () => {
  const raw: RawPosition[] = [
    { date: at(10), driver_number: 44, position: 2 },
    { date: at(0), driver_number: 1, position: 2 },
    { date: at(5), driver_number: 1, position: 2 }, // no change — dropped
    { date: at(10), driver_number: 1, position: 1 }, // change — kept
    { date: at(0), driver_number: 44, position: 1 },
  ]

  expect(bakePositions(raw, START)).toEqual([
    { t: 0, num: 1, pos: 2 },
    { t: 0, num: 44, pos: 1 },
    { t: 10_000, num: 1, pos: 1 },
    { t: 10_000, num: 44, pos: 2 },
  ])
})

it('bakeIntervals sorts by t and drops the leader (null gap)', () => {
  const raw: RawInterval[] = [
    { date: at(15), driver_number: 44, interval: 1.2 },
    { date: at(15), driver_number: 1, interval: null }, // leader — dropped
    { date: at(0), driver_number: 44, interval: 0.8 },
  ]

  expect(bakeIntervals(raw, START)).toEqual([
    { t: 0, num: 44, gap: 0.8 },
    { t: 15_000, num: 44, gap: 1.2 },
  ])
})

it('bakeIntervals preserves lapped-car interval strings ("+1 LAP") verbatim', () => {
  const raw: RawInterval[] = [
    { date: at(0), driver_number: 44, interval: 1.2 },
    { date: at(0), driver_number: 23, interval: '+1 LAP' }, // lapped — kept, not dropped
  ]

  expect(bakeIntervals(raw, START)).toEqual([
    { t: 0, num: 23, gap: '+1 LAP' },
    { t: 0, num: 44, gap: 1.2 },
  ])
})

const locs: RawLocation[] = [
  { date: at(0), driver_number: 1, x: 100, y: 200 },
  { date: at(0.2), driver_number: 1, x: 110, y: 210 }, // same 500ms bucket — dropped
  { date: at(0.6), driver_number: 1, x: 150, y: 260 }, // next bucket — kept
  { date: at(0), driver_number: 44, x: 50, y: 100 },
]

it('boundingBox spans every raw location point', () => {
  expect(boundingBox(locs)).toEqual({ minX: 50, minY: 100, maxX: 150, maxY: 260 })
})

it('bakeLocations downsamples per bucket and normalizes to the bbox origin', () => {
  const bbox = { minX: 50, minY: 100, maxX: 150, maxY: 260 }

  expect(bakeLocations(locs, START, bbox, 500)).toEqual({
    '1': [0, 50, 100, 600, 100, 160],
    '44': [0, 0, 0],
  })
})

it("deriveOutline traces the leader's fastest clean lap window", () => {
  const laps: RawLap[] = [
    { date_start: at(0), driver_number: 1, lap_number: 1, lap_duration: 15, is_pit_out_lap: true }, // out lap, ignored
    { date_start: at(30), driver_number: 1, lap_number: 2, lap_duration: 20, is_pit_out_lap: false }, // fastest clean
    { date_start: at(50), driver_number: 1, lap_number: 3, lap_duration: 25, is_pit_out_lap: false },
  ]
  const locations: RawLocation[] = [
    { date: at(25), driver_number: 1, x: 10, y: 10 }, // before window
    { date: at(30), driver_number: 1, x: 100, y: 100 },
    { date: at(35), driver_number: 44, x: 500, y: 500 }, // not the leader
    { date: at(40), driver_number: 1, x: 200, y: 100 },
    { date: at(49), driver_number: 1, x: 100, y: 200 },
    { date: at(50), driver_number: 1, x: 999, y: 999 }, // window is [start, start+dur)
  ]
  const bbox = { minX: 0, minY: 0, maxX: 200, maxY: 200 }

  expect(deriveOutline(1, laps, locations, bbox)).toEqual([
    [100, 100],
    [200, 100],
    [100, 200],
  ])
})

it('bakeLaps emits the leader lap boundaries as seek-bar markers', () => {
  const laps: RawLap[] = [
    { date_start: at(0), driver_number: 1, lap_number: 1, lap_duration: 90, is_pit_out_lap: false },
    { date_start: at(90), driver_number: 1, lap_number: 2, lap_duration: 88, is_pit_out_lap: false },
    { date_start: at(30), driver_number: 44, lap_number: 1, lap_duration: 92, is_pit_out_lap: false }, // not leader
    { date_start: null, driver_number: 1, lap_number: 3, lap_duration: null, is_pit_out_lap: false }, // no timestamp
  ]

  expect(bakeLaps(1, laps, START)).toEqual([
    { t: 0, lap: 1 },
    { t: 90_000, lap: 2 },
  ])
})

it('bakeResult sorts by finishing position and drops the unclassified', () => {
  const result: RawSessionResult[] = [
    { position: 2, driver_number: 44, dnf: false },
    { position: 1, driver_number: 1, dnf: false },
    { position: null, driver_number: 99, dnf: false }, // DNS — no finishing position
  ]

  expect(bakeResult(result)).toEqual([
    { pos: 1, num: 1 },
    { pos: 2, num: 44 },
  ])
})

it('bakeRetirements times each DNF at its last known position update', () => {
  const result: RawSessionResult[] = [
    { position: 1, driver_number: 1, dnf: false },
    { position: 20, driver_number: 23, dnf: true },
  ]
  const positions: PositionEvent[] = [
    { t: 0, num: 1, pos: 1 },
    { t: 0, num: 23, pos: 15 },
    { t: 300_000, num: 23, pos: 18 }, // last update before retiring
  ]

  expect(bakeRetirements(result, positions)).toEqual([{ t: 300_000, num: 23 }])
})

it('bake assembles a full replay file, using the P1 finisher as the leader', () => {
  const session: RawSession = {
    session_key: 100,
    session_name: 'Race',
    date_start: START,
    date_end: at(10),
    year: 2026,
    meeting_key: 5,
  }
  const file = bake({
    round: 12,
    raceName: 'Belgian Grand Prix',
    session,
    drivers: [
      { driver_number: 1, name_acronym: 'VER', full_name: 'Max Verstappen', team_name: 'Red Bull', team_colour: '3671C6' },
      { driver_number: 44, name_acronym: 'HAM', full_name: 'Lewis Hamilton', team_name: 'Ferrari', team_colour: 'ED1131' },
    ],
    positions: [
      { date: at(0), driver_number: 1, position: 1 },
      { date: at(0), driver_number: 44, position: 2 },
    ],
    intervals: [
      { date: at(0), driver_number: 44, interval: 1 },
      { date: at(0), driver_number: 1, interval: null },
    ],
    laps: [
      { date_start: at(0), driver_number: 1, lap_number: 1, lap_duration: 10, is_pit_out_lap: false },
      { date_start: at(10), driver_number: 1, lap_number: 2, lap_duration: 9, is_pit_out_lap: false }, // fastest clean
      { date_start: at(0), driver_number: 44, lap_number: 1, lap_duration: 11, is_pit_out_lap: false },
    ],
    locations: [
      { date: at(0), driver_number: 1, x: 0, y: 0 },
      { date: at(5), driver_number: 1, x: 100, y: 0 },
      { date: at(9), driver_number: 1, x: 0, y: 100 },
      { date: at(10), driver_number: 1, x: 5, y: 5 }, // lap 2 (fastest) window
      { date: at(0), driver_number: 44, x: 200, y: 200 },
    ],
    result: [
      { position: 1, driver_number: 1, dnf: false },
      { position: 2, driver_number: 44, dnf: false },
    ],
  })

  expect(file).toEqual({
    meta: { round: 12, name: 'Belgian Grand Prix', year: 2026, startTime: START, durationMs: 10_000, totalLaps: 2 },
    drivers: [
      { num: 1, code: 'VER', name: 'Max Verstappen', team: 'Red Bull', color: '#3671C6' },
      { num: 44, code: 'HAM', name: 'Lewis Hamilton', team: 'Ferrari', color: '#ED1131' },
    ],
    track: { outline: [[5, 5]] }, // leader's fastest clean lap (lap 2)
    laps: [
      { t: 0, lap: 1 },
      { t: 10_000, lap: 2 },
    ],
    positions: [
      { t: 0, num: 1, pos: 1 },
      { t: 0, num: 44, pos: 2 },
    ],
    intervals: [{ t: 0, num: 44, gap: 1 }],
    locations: {
      '1': [0, 0, 0, 5000, 100, 0, 9000, 0, 100, 10_000, 5, 5],
      '44': [0, 200, 200],
    },
    retirements: [],
    result: [
      { pos: 1, num: 1 },
      { pos: 2, num: 44 },
    ],
  })
})

it('bakeDrivers maps OpenF1 fields and prefixes the team colour', () => {
  const drivers: RawDriver[] = [
    { driver_number: 44, name_acronym: 'HAM', full_name: 'Lewis Hamilton', team_name: 'Ferrari', team_colour: 'ED1131' },
    { driver_number: 1, name_acronym: 'VER', full_name: 'Max Verstappen', team_name: 'Red Bull', team_colour: '3671C6' },
  ]

  expect(bakeDrivers(drivers)).toEqual([
    { num: 1, code: 'VER', name: 'Max Verstappen', team: 'Red Bull', color: '#3671C6' },
    { num: 44, code: 'HAM', name: 'Lewis Hamilton', team: 'Ferrari', color: '#ED1131' },
  ])
})
