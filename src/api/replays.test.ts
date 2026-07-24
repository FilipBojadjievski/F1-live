import { afterEach, expect, it, vi } from 'vitest'
import { fetchReplayIndex } from './replays'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('fetchReplayIndex returns the rounds that have replay data', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ rounds: [3, 7] }) })),
  )

  await expect(fetchReplayIndex()).resolves.toEqual({ rounds: [3, 7] })
})

it('fetchReplayIndex treats a 404 as "no replays"', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))

  await expect(fetchReplayIndex()).resolves.toEqual({ rounds: [] })
})
