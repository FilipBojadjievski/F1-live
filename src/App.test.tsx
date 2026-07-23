import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import App from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

it('renders the standings placeholder at /', () => {
  renderAt('/')
  expect(screen.getByRole('heading', { name: /standings/i })).toBeInTheDocument()
})

it('renders the races placeholder at /races', () => {
  renderAt('/races')
  expect(screen.getByRole('heading', { name: /races/i })).toBeInTheDocument()
})

it('renders the replay placeholder for its round at /replay/:round', () => {
  renderAt('/replay/12')
  expect(screen.getByRole('heading', { name: /replay.*round 12/i })).toBeInTheDocument()
})

it('navigates between Standings and Races via the top nav', async () => {
  const user = userEvent.setup()
  renderAt('/')

  await user.click(screen.getByRole('link', { name: /races/i }))
  expect(screen.getByRole('heading', { name: /races/i })).toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: /standings/i }))
  expect(screen.getByRole('heading', { name: /standings/i })).toBeInTheDocument()
})
