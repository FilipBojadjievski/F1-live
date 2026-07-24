import { expect, it } from 'vitest'
import type { ReplayFile } from '../src/replay/format'
import { MAX_GZIP_BYTES, validateReplay } from './validate'

// A minimal well-formed replay: 1 finishes ahead of 44, both present in drivers + locations.
function validReplay(): ReplayFile {
  return {
    meta: { round: 1, name: 'Test GP', year: 2026, startTime: '2026-01-01T00:00:00.000Z', durationMs: 1000, totalLaps: 1 },
    drivers: [
      { num: 1, code: 'VER', name: 'Max Verstappen', team: 'Red Bull', color: '#3671C6' },
      { num: 44, code: 'HAM', name: 'Lewis Hamilton', team: 'Ferrari', color: '#ED1131' },
    ],
    track: { outline: [] },
    laps: [],
    positions: [
      { t: 0, num: 1, pos: 1 },
      { t: 0, num: 44, pos: 2 },
    ],
    intervals: [],
    locations: { '1': [0, 0, 0], '44': [0, 0, 0] },
    retirements: [],
    result: [
      { pos: 1, num: 1 },
      { pos: 2, num: 44 },
    ],
  }
}

const SMALL = 1000

it('validateReplay passes a well-formed replay under the size cap', () => {
  expect(validateReplay(validReplay(), SMALL)).toEqual([])
})

it('validateReplay treats session_result as authoritative and does not compare the position stream order', () => {
  const r = validReplay()
  // A post-race penalty case: result classifies 44 ahead of 1, even though the position stream ends
  // with 1 leading. This must NOT be flagged — session_result is the source of truth.
  r.result = [
    { pos: 1, num: 44 },
    { pos: 2, num: 1 },
  ]

  expect(validateReplay(r, SMALL)).toEqual([])
})

it('validateReplay flags a file at or over the gzip size cap', () => {
  expect(validateReplay(validReplay(), MAX_GZIP_BYTES)).toEqual([expect.stringMatching(/size/i)])
})

it('validateReplay flags a classified driver missing from locations', () => {
  const r = validReplay()
  delete r.locations['44']

  expect(validateReplay(r, SMALL)).toEqual([expect.stringMatching(/44.*locations/i)])
})

it('validateReplay flags a classified driver missing from the driver list', () => {
  const r = validReplay()
  r.drivers = r.drivers.filter(d => d.num !== 44)

  expect(validateReplay(r, SMALL)).toEqual([expect.stringMatching(/44.*drivers/i)])
})
