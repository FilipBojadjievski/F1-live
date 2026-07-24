import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import RacesPage from './RacesPage'

const races = [
  {
    round: '1',
    raceName: 'Australian Grand Prix',
    date: '2026-03-08',
    Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park Grand Prix Circuit' },
  },
  {
    round: '2',
    raceName: 'Chinese Grand Prix',
    date: '2026-03-15',
    Circuit: { circuitId: 'shanghai', circuitName: 'Shanghai International Circuit' },
  },
  {
    round: '3',
    raceName: 'Japanese Grand Prix',
    date: '2026-03-29',
    Circuit: { circuitId: 'suzuka', circuitName: 'Suzuka Circuit' },
  },
]

// Rounds 1 and 2 are completed; round 3 has no results yet.
const podiumByPosition: Record<string, Record<string, [string, string, string]>> = {
  '1': { '1': ['NOR', 'Norris', 'mclaren'], '2': ['VER', 'Verstappen', 'red_bull'] },
  '2': { '1': ['VER', 'Verstappen', 'red_bull'], '2': ['NOR', 'Norris', 'mclaren'] },
  '3': { '1': ['ANT', 'Antonelli', 'mercedes'], '2': ['LEC', 'Leclerc', 'ferrari'] },
}

function resultsJson(pos: string) {
  return {
    MRData: {
      RaceTable: {
        Races: Object.entries(podiumByPosition[pos]).map(([round, [code, family, team]]) => ({
          ...races[Number(round) - 1],
          Results: [
            {
              position: pos,
              Driver: { driverId: family.toLowerCase(), code, givenName: 'X', familyName: family },
              Constructor: { constructorId: team, name: team },
            },
          ],
        })),
      },
    },
  }
}

function stubFetch({ replayRounds = [] as number[], indexStatus = 200 } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) => {
      const u = String(url)
      if (u.includes('replays/index.json')) {
        return {
          ok: indexStatus === 200,
          status: indexStatus,
          json: async () => ({ rounds: replayRounds }),
        }
      }
      const posMatch = u.match(/\/results\/(\d)\//)
      if (posMatch) return { ok: true, json: async () => resultsJson(posMatch[1]) }
      return { ok: true, json: async () => ({ MRData: { RaceTable: { Races: races } } }) }
    }),
  )
}

function renderRaces() {
  return render(
    <MemoryRouter>
      <RacesPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('lists every round in calendar order with round, name, circuit and date', async () => {
  stubFetch()
  renderRaces()

  const cards = await screen.findAllByRole('heading', { level: 2 })
  expect(cards.map(h => h.textContent)).toEqual([
    'Australian Grand Prix',
    'Chinese Grand Prix',
    'Japanese Grand Prix',
  ])

  const australia = screen.getByText('Australian Grand Prix').closest('.race-card')!
  expect(australia).toHaveTextContent('Albert Park Grand Prix Circuit')
  expect(australia).toHaveTextContent('R1')
  expect(australia).toHaveTextContent('2026-03-08')
})

it('shows the top-3 podium on completed rounds', async () => {
  stubFetch()
  renderRaces()

  const australia = (await screen.findByText('Australian Grand Prix')).closest('.race-card')!
  const podium = within(australia as HTMLElement).getAllByRole('listitem')
  expect(podium).toHaveLength(3)
  expect(podium[0]).toHaveTextContent('1')
  expect(podium[0]).toHaveTextContent('NOR')
  expect(podium[1]).toHaveTextContent('VER')
  expect(podium[2]).toHaveTextContent('ANT')
})

it('dims upcoming rounds and shows no podium for them', async () => {
  stubFetch()
  renderRaces()

  const japan = (await screen.findByText('Japanese Grand Prix')).closest('.race-card')!
  expect(japan).toHaveClass('upcoming')
  expect(within(japan as HTMLElement).queryAllByRole('listitem')).toHaveLength(0)
  expect(japan).toHaveTextContent('Suzuka Circuit')
  expect(japan).toHaveTextContent('2026-03-29')
})

it('links only rounds listed in the replay index to /replay/:round', async () => {
  stubFetch({ replayRounds: [1] })
  renderRaces()

  const australia = (await screen.findByText('Australian Grand Prix')).closest('.race-card')!
  const link = within(australia as HTMLElement).getByRole('link', { name: /replay/i })
  expect(link).toHaveAttribute('href', '/replay/1')

  // Completed but not baked — podium shown, no replay link.
  const china = screen.getByText('Chinese Grand Prix').closest('.race-card')!
  expect(within(china as HTMLElement).queryByRole('link')).toBeNull()
  expect(within(china as HTMLElement).getAllByRole('listitem')).toHaveLength(3)
})

it('shows no replay links when index.json is missing (404)', async () => {
  stubFetch({ indexStatus: 404 })
  renderRaces()

  await screen.findByText('Australian Grand Prix')
  expect(screen.queryByRole('link')).toBeNull()
})
