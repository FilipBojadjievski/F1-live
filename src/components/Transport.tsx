import type { LapMarker } from '../replay/format'

const SPEEDS = [1, 10, 30, 60]

interface TransportProps {
  playing: boolean
  speed: number
  clock: number // current playback position, ms since race start
  durationMs: number
  laps: LapMarker[]
  onPlayPause: () => void
  onSpeedChange: (speed: number) => void
  onSeek: (tMs: number) => void
}

export default function Transport({
  playing,
  speed,
  clock,
  durationMs,
  laps,
  onPlayPause,
  onSpeedChange,
  onSeek,
}: TransportProps) {
  return (
    <div className="transport">
      <button className="play" aria-label={playing ? 'Pause' : 'Play'} onClick={onPlayPause}>
        {playing ? '❚❚' : '►'}
      </button>

      <div className="speeds">
        {SPEEDS.map(s => (
          <button
            key={s}
            aria-pressed={speed === s}
            className={speed === s ? 'active' : ''}
            onClick={() => onSpeedChange(s)}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="seek">
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={durationMs}
          value={clock}
          onChange={e => onSeek(Number(e.target.value))}
        />
        <div className="lap-markers">
          {laps.map(l => (
            <span
              key={l.lap}
              data-testid="lap-marker"
              className="lap-marker"
              style={{ left: `${(l.t / durationMs) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
