import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import Transport from './Transport'
import type { LapMarker } from '../replay/format'

const laps: LapMarker[] = [
  { t: 0, lap: 1 },
  { t: 1000, lap: 2 },
  { t: 2000, lap: 3 },
]

function renderTransport(props: Partial<Parameters<typeof Transport>[0]> = {}) {
  const onPlayPause = vi.fn()
  const onSpeedChange = vi.fn()
  const onSeek = vi.fn()
  render(
    <Transport
      playing={false}
      speed={30}
      clock={0}
      durationMs={2000}
      laps={laps}
      onPlayPause={onPlayPause}
      onSpeedChange={onSpeedChange}
      onSeek={onSeek}
      {...props}
    />,
  )
  return { onPlayPause, onSpeedChange, onSeek }
}

it('toggles play/pause through the callback and labels by state', () => {
  const { onPlayPause } = renderTransport({ playing: false })
  const button = screen.getByRole('button', { name: /play/i })
  fireEvent.click(button)
  expect(onPlayPause).toHaveBeenCalledTimes(1)
})

it('labels the toggle Pause while playing', () => {
  renderTransport({ playing: true })
  expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
})

it('offers 1×/10×/30×/60× and marks the current speed active', () => {
  renderTransport({ speed: 30 })
  for (const s of [1, 10, 30, 60]) {
    expect(screen.getByRole('button', { name: `${s}×` })).toBeInTheDocument()
  }
  expect(screen.getByRole('button', { name: '30×' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'false')
})

it('changes speed through the callback', () => {
  const { onSpeedChange } = renderTransport({ speed: 30 })
  fireEvent.click(screen.getByRole('button', { name: '60×' }))
  expect(onSpeedChange).toHaveBeenCalledWith(60)
})

it('seeks to the dragged time in milliseconds', () => {
  const { onSeek } = renderTransport()
  fireEvent.change(screen.getByRole('slider'), { target: { value: '1500' } })
  expect(onSeek).toHaveBeenCalledWith(1500)
})

it('renders a marker per lap', () => {
  renderTransport()
  expect(screen.getAllByTestId('lap-marker')).toHaveLength(3)
})
