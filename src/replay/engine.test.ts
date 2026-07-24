import { expect, it, vi } from 'vitest'
import type { ReplayFile } from './format'
import { ReplayEngine, StaticFileSource, type RaceDataSource } from './engine'
// The real baked race, loaded as a raw string (typed by vite/client) so the test needs no
// Node APIs and stays inside the browser-oriented tsconfig.
import realFileRaw from '../../public/replays/1.json?raw'

// Small hand-written fixture: 3 drivers, one position swap (3 passes 2 at t=1000),
// driver 3 retires at t=2000. Leader (1) never has an interval sample → gap 0.
const fixture: ReplayFile = {
  meta: {
    round: 7,
    name: 'Test Grand Prix',
    year: 2026,
    startTime: '2026-07-24T13:00:00.000Z',
    durationMs: 3000,
    totalLaps: 3,
  },
  drivers: [
    { num: 1, code: 'AAA', name: 'Driver A', team: 'Team A', color: '#111111' },
    { num: 2, code: 'BBB', name: 'Driver B', team: 'Team B', color: '#222222' },
    { num: 3, code: 'CCC', name: 'Driver C', team: 'Team C', color: '#333333' },
  ],
  track: { outline: [[0, 0], [100, 100]] },
  laps: [
    { t: 0, lap: 1 },
    { t: 1500, lap: 2 },
    { t: 3000, lap: 3 },
  ],
  positions: [
    { t: 0, num: 1, pos: 1 },
    { t: 0, num: 2, pos: 2 },
    { t: 0, num: 3, pos: 3 },
    { t: 1000, num: 2, pos: 3 },
    { t: 1000, num: 3, pos: 2 },
  ],
  intervals: [
    { t: 0, num: 2, gap: 1.0 },
    { t: 0, num: 3, gap: 2.0 },
    { t: 1000, num: 2, gap: 1.5 },
    { t: 1000, num: 3, gap: 0.8 },
  ],
  locations: {
    '1': [0, 0, 0, 1000, 100, 0, 2000, 100, 100],
    '2': [0, 200, 200, 1000, 300, 200],
    '3': [0, 0, 500, 2000, 50, 500],
  },
  retirements: [{ t: 2000, num: 3 }],
  result: [
    { pos: 1, num: 1 },
    { pos: 2, num: 2 },
  ],
}

const sourceOf = (file: ReplayFile): RaceDataSource => ({ load: async () => file })

const loaded = async (file: ReplayFile) => {
  const engine = new ReplayEngine(sourceOf(file))
  await engine.load(file.meta.round)
  return engine
}

const nums = (state: { order: { num: number }[] }) => state.order.map(o => o.num)

it('StaticFileSource fetches and parses /replays/{round}.json', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => fixture })
  vi.stubGlobal('fetch', fetchMock)

  const source = new StaticFileSource()
  expect(await source.load(7)).toEqual(fixture)
  expect(fetchMock).toHaveBeenCalledWith('/replays/7.json')

  vi.unstubAllGlobals()
})

it('StaticFileSource throws on a failed fetch', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
  await expect(new StaticFileSource().load(99)).rejects.toThrow(/99/)
  vi.unstubAllGlobals()
})

it('orders by position and reports lap + gaps at t=0', async () => {
  const engine = await loaded(fixture)
  const state = engine.seek(0)

  expect(state.lap).toBe(1)
  expect(state.order).toEqual([
    { num: 1, pos: 1, gap: 0, retired: false },
    { num: 2, pos: 2, gap: 1.0, retired: false },
    { num: 3, pos: 3, gap: 2.0, retired: false },
  ])
})

it('reflects a mid-race position swap using the latest event <= t', async () => {
  const engine = await loaded(fixture)
  const state = engine.seek(1000)

  expect(state.lap).toBe(1) // between the lap-1 (t=0) and lap-2 (t=1500) markers
  expect(nums(state)).toEqual([1, 3, 2]) // driver 3 passed driver 2
  expect(state.order).toEqual([
    { num: 1, pos: 1, gap: 0, retired: false },
    { num: 3, pos: 2, gap: 0.8, retired: false },
    { num: 2, pos: 3, gap: 1.5, retired: false },
  ])
})

it('at the end the classified order matches the fixture result and lap is final', async () => {
  const engine = await loaded(fixture)
  const state = engine.seek(fixture.meta.durationMs)

  expect(state.lap).toBe(3)
  const classified = state.order.filter(o => !o.retired).map(o => o.num)
  expect(classified).toEqual(fixture.result.map(r => r.num))
})

it('flags retirement at its timestamp and sorts retired below classified runners', async () => {
  const engine = await loaded(fixture)

  const before = engine.seek(1999)
  expect(before.order.find(o => o.num === 3)?.retired).toBe(false)
  expect(nums(before)).toEqual([1, 3, 2]) // still running, in P2

  const after = engine.seek(2000)
  expect(after.order.find(o => o.num === 3)?.retired).toBe(true)
  expect(nums(after)).toEqual([1, 2, 3]) // dropped below the classified runners
})

it('seek(t) equals playing forward to t with tick()', async () => {
  const stepped = await loaded(fixture)
  stepped.seek(0)
  stepped.tick(1000)
  stepped.tick(1000)
  const afterTicks = stepped.tick(1000)

  const direct = (await loaded(fixture)).seek(3000)
  expect(afterTicks).toEqual(direct)
})

it('tick advances the clock by dt times the speed multiplier', async () => {
  const engine = await loaded(fixture)
  engine.seek(0)
  engine.speed = 2

  expect(engine.tick(500)).toEqual((await loaded(fixture)).seek(1000))
})

it('returns a location sample exactly at a boundary', async () => {
  const engine = await loaded(fixture)
  expect(engine.seek(0).cars[1]).toEqual({ x: 0, y: 0 })
  expect(engine.seek(1000).cars[1]).toEqual({ x: 100, y: 0 })
})

it('linearly interpolates location between two samples', async () => {
  const engine = await loaded(fixture)
  expect(engine.seek(250).cars[1]).toEqual({ x: 25, y: 0 }) // 1/4 into [ (0,0) -> (100,0) ]
  expect(engine.seek(1500).cars[1]).toEqual({ x: 100, y: 50 }) // 1/2 into [ (100,0) -> (100,100) ]
})

it('clamps location to the last sample past the end of a stream', async () => {
  const engine = await loaded(fixture)
  expect(engine.seek(2500).cars[1]).toEqual({ x: 100, y: 100 })
  expect(engine.seek(3000).cars[3]).toEqual({ x: 50, y: 500 }) // driver 3 frozen where it retired
})

// The seek(end) result must equal the official order for the real baked race.
const realFile: ReplayFile = JSON.parse(realFileRaw)

it('seek(durationMs).order matches the real baked race result for the classified runners', async () => {
  const engine = await loaded(realFile)
  const state = engine.seek(realFile.meta.durationMs)

  const classified = state.order
    .filter(o => !o.retired)
    .map(o => o.num)
    .slice(0, realFile.result.length)
  expect(classified).toEqual(realFile.result.map(r => r.num))
})
