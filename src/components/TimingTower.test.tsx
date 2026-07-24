import { expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import TimingTower from './TimingTower'
import type { OrderEntry } from '../replay/engine'
import type { ReplayDriver } from '../replay/format'

const drivers: ReplayDriver[] = [
  { num: 1, code: 'AAA', name: 'Driver A', team: 'Team A', color: '#111111' },
  { num: 2, code: 'BBB', name: 'Driver B', team: 'Team B', color: '#222222' },
  { num: 3, code: 'CCC', name: 'Driver C', team: 'Team C', color: '#333333' },
]

const order: OrderEntry[] = [
  { num: 1, pos: 1, gap: 0, retired: false },
  { num: 2, pos: 2, gap: 1.5, retired: false },
  { num: 3, pos: 3, gap: 4.2, retired: true },
]

const renderTower = (o = order, lap = 5) =>
  render(<TimingTower order={o} lap={lap} totalLaps={58} drivers={drivers} />)

it('shows the lap counter in the header', () => {
  renderTower()
  expect(screen.getByText(/LAP\s*5\s*\/\s*58/i)).toBeInTheDocument()
})

it('renders one row per car in position order with code and interval', () => {
  renderTower()
  const rows = screen.getAllByRole('listitem')
  expect(rows.map(r => within(r).getByTestId('code').textContent)).toEqual(['AAA', 'BBB', 'CCC'])

  // Leader has no car ahead; runners show +interval.
  expect(within(rows[0]).getByTestId('gap')).toHaveTextContent(/leader/i)
  expect(within(rows[1]).getByTestId('gap')).toHaveTextContent('+1.5')
})

it('paints each row bar with the driver team color', () => {
  renderTower()
  const leader = screen.getAllByRole('listitem')[0]
  expect(within(leader).getByTestId('team-bar')).toHaveStyle({ background: '#111111' })
})

it('places retired cars below a divider and marks them retired', () => {
  renderTower()
  const divider = screen.getByRole('separator')
  const rows = screen.getAllByRole('listitem')
  const retired = rows[2]

  expect(retired).toHaveTextContent('CCC')
  expect(retired).toHaveClass('retired')
  // The divider comes after the two classified runners and before the retired row.
  expect(divider.compareDocumentPosition(retired) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(divider.compareDocumentPosition(rows[1]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
})

it('shows no divider when nobody has retired', () => {
  renderTower(order.map(o => ({ ...o, retired: false })))
  expect(screen.queryByRole('separator')).toBeNull()
})
