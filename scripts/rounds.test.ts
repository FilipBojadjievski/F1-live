import { expect, it } from 'vitest'
import type { RawSession } from './openf1'
import { resolveSessionKey, roundsToBake } from './rounds'

const race = (session_key: number, session_name: string, date_start: string, meeting_key: number): RawSession => ({
  session_key,
  session_name,
  date_start,
  date_end: date_start,
  year: 2026,
  meeting_key,
})

const sessions: RawSession[] = [
  race(1, 'Qualifying', '2026-03-08T02:00:00Z', 10), // wrong session type — ignored
  race(2, 'Race', '2026-03-08T05:00:00Z', 10),
  race(3, 'Race', '2026-03-15T07:00:00Z', 11),
]

// jolpica's scheduled race time and OpenF1's actual session start differ by a few hours, so we
// match the nearest Race session rather than relying on positional/round alignment.
it('resolveSessionKey matches the Race session nearest the jolpica race time', () => {
  expect(resolveSessionKey(sessions, '2026-03-08T08:00:00Z')).toBe(2)
  expect(resolveSessionKey(sessions, '2026-03-15T07:00:00Z')).toBe(3)
})

it('resolveSessionKey throws when no race session is within a day of the target', () => {
  expect(() => resolveSessionKey(sessions, '2026-08-01T00:00:00Z')).toThrow(/no race session/i)
})

it('roundsToBake returns completed rounds not yet in the index, ascending', () => {
  expect(roundsToBake([1, 2, 3, 4], [3, 1])).toEqual([2, 4])
})

it('roundsToBake is empty when everything completed is already indexed', () => {
  expect(roundsToBake([1, 2], [1, 2])).toEqual([])
})
