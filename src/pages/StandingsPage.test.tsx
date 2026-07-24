import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StandingsPage from './StandingsPage'

const driversJson = {
  MRData: {
    StandingsTable: {
      StandingsLists: [
        {
          DriverStandings: [
            {
              position: '1',
              points: '204',
              wins: '6',
              Driver: {
                driverId: 'antonelli',
                code: 'ANT',
                givenName: 'Andrea Kimi',
                familyName: 'Antonelli',
              },
              Constructors: [{ constructorId: 'mercedes', name: 'Mercedes' }],
            },
            {
              position: '2',
              points: '159',
              wins: '1',
              Driver: {
                driverId: 'hamilton',
                code: 'HAM',
                givenName: 'Lewis',
                familyName: 'Hamilton',
              },
              Constructors: [{ constructorId: 'ferrari', name: 'Ferrari' }],
            },
          ],
        },
      ],
    },
  },
}

const constructorsJson = {
  MRData: {
    StandingsTable: {
      StandingsLists: [
        {
          ConstructorStandings: [
            {
              position: '1',
              points: '358',
              wins: '8',
              Constructor: { constructorId: 'mercedes', name: 'Mercedes' },
            },
            {
              position: '2',
              points: '285',
              wins: '2',
              Constructor: { constructorId: 'ferrari', name: 'Ferrari' },
            },
          ],
        },
      ],
    },
  },
}

function mockFetch() {
  return vi.fn(async (url: unknown) => ({
    ok: true,
    json: async () => (String(url).includes('driverstandings') ? driversJson : constructorsJson),
  }))
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows driver standings with position, team, wins and points', async () => {
  vi.stubGlobal('fetch', mockFetch())
  render(<StandingsPage />)

  const row = (await screen.findByText(/antonelli/i)).closest('tr')!
  expect(row).toHaveTextContent('1')
  expect(row).toHaveTextContent('Mercedes')
  expect(row).toHaveTextContent('6')
  expect(row).toHaveTextContent('204')
})

it('switches tabs without refetching (sessionStorage cache hit)', async () => {
  const fetchMock = mockFetch()
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  render(<StandingsPage />)
  await screen.findByText(/antonelli/i)

  await user.click(screen.getByRole('button', { name: /constructors/i }))
  const row = (await screen.findByText('Mercedes')).closest('tr')!
  expect(row).toHaveTextContent('358')
  expect(fetchMock).toHaveBeenCalledTimes(2)

  await user.click(screen.getByRole('button', { name: /drivers/i }))
  await screen.findByText(/antonelli/i)
  expect(fetchMock).toHaveBeenCalledTimes(2) // cache hit, no refetch
})

it('shows an error state whose retry button refetches', async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error('network down'))
    .mockResolvedValue({ ok: true, json: async () => driversJson })
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  render(<StandingsPage />)

  await user.click(await screen.findByRole('button', { name: /retry/i }))
  expect(await screen.findByText(/antonelli/i)).toBeInTheDocument()
})
