import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import ReplayPage from './ReplayPage'
import type { RaceDataSource } from '../replay/engine'
import type { ReplayFile } from '../replay/format'

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
  ],
  track: { outline: [[0, 0], [100, 0], [100, 100], [0, 100]] },
  laps: [{ t: 0, lap: 1 }, { t: 1500, lap: 2 }, { t: 3000, lap: 3 }],
  positions: [{ t: 0, num: 1, pos: 1 }, { t: 0, num: 2, pos: 2 }],
  intervals: [{ t: 0, num: 2, gap: 1.0 }],
  locations: { '1': [0, 0, 0], '2': [0, 50, 50] },
  retirements: [],
  result: [{ pos: 1, num: 1 }, { pos: 2, num: 2 }],
}

const sourceOf = (file: ReplayFile): RaceDataSource => ({ load: async () => file })

function renderReplay(source: RaceDataSource = sourceOf(fixture), round = '7') {
  return render(
    <MemoryRouter initialEntries={[`/replay/${round}`]}>
      <Routes>
        <Route path="/replay/:round" element={<ReplayPage source={source} />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('shows a loading state before the replay resolves', () => {
  renderReplay()
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})

it('shows an error state when the replay fails to load', async () => {
  renderReplay({ load: async () => { throw new Error('nope') } })
  expect(await screen.findByText(/could/i)).toBeInTheDocument()
})

it('heads the page with the GP name and a REPLAY badge', async () => {
  renderReplay()
  expect(await screen.findByText('Test Grand Prix')).toBeInTheDocument()
  expect(screen.getByText(/replay/i)).toBeInTheDocument()
})

it('renders the tower at lap 1 for the initial (t=0) state', async () => {
  renderReplay()
  expect(await screen.findByText(/LAP\s*1\s*\/\s*3/i)).toBeInTheDocument()
})

it('defaults the transport to 30× and seek spanning the race duration', async () => {
  renderReplay()
  expect(await screen.findByRole('button', { name: '30×' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('slider')).toHaveAttribute('max', '3000')
})

it('draws the track map canvas', async () => {
  const { container } = renderReplay()
  await screen.findByText('Test Grand Prix')
  expect(container.querySelector('canvas.track-map')).toBeInTheDocument()
})
