import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RateLimiter, withRetry } from './openf1'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('RateLimiter lets the first call through immediately and spaces the rest', async () => {
  const rl = new RateLimiter(2500)
  let first = false
  let second = false
  void rl.acquire().then(() => (first = true))
  void rl.acquire().then(() => (second = true))

  await vi.advanceTimersByTimeAsync(0)
  expect(first).toBe(true)
  expect(second).toBe(false) // held back by the 2500ms interval

  await vi.advanceTimersByTimeAsync(2500)
  expect(second).toBe(true)
})

const retryable = (e: unknown) => (e as { status: number }).status >= 500

it('withRetry retries retryable failures with exponential backoff, then succeeds', async () => {
  let calls = 0
  const fn = vi.fn(async () => {
    calls++
    if (calls < 3) throw { status: 503 }
    return 'ok'
  })

  const p = withRetry(fn, { retries: 3, baseDelayMs: 100, isRetryable: retryable })
  await vi.advanceTimersByTimeAsync(100 + 200) // backoff after attempt 1, then attempt 2

  await expect(p).resolves.toBe('ok')
  expect(fn).toHaveBeenCalledTimes(3)
})

it('withRetry rethrows a non-retryable failure without retrying', async () => {
  const fn = vi.fn(async () => {
    throw { status: 404 }
  })

  await expect(withRetry(fn, { retries: 3, baseDelayMs: 100, isRetryable: retryable })).rejects.toMatchObject({
    status: 404,
  })
  expect(fn).toHaveBeenCalledTimes(1)
})

it('withRetry gives up after exhausting retries', async () => {
  const fn = vi.fn(async () => {
    throw { status: 503 }
  })

  const p = withRetry(fn, { retries: 2, baseDelayMs: 100, isRetryable: retryable })
  const settled = p.catch(e => e) // capture rejection before advancing timers
  await vi.advanceTimersByTimeAsync(100 + 200)

  await expect(settled).resolves.toMatchObject({ status: 503 })
  expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
})
