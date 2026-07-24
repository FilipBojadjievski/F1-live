import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import {
  ReplayEngine,
  StaticFileSource,
  type RaceDataSource,
  type RaceState,
} from '../replay/engine'
import type { ReplayFile } from '../replay/format'
import TrackMap from '../components/TrackMap'
import TimingTower from '../components/TimingTower'
import Transport from '../components/Transport'

const DEFAULT_SOURCE = new StaticFileSource()
const DEFAULT_SPEED = 30

type Status = 'loading' | 'error' | 'ready'

export default function ReplayPage({ source = DEFAULT_SOURCE }: { source?: RaceDataSource }) {
  const { round } = useParams()

  const engineRef = useRef<ReplayEngine | null>(null)
  const clockRef = useRef(0)
  const [file, setFile] = useState<ReplayFile | null>(null)
  const [state, setState] = useState<RaceState | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const [clock, setClock] = useState(0)

  // Load once through the page, then hand the engine an inline source over the loaded file so the
  // multi-MB replay is fetched a single time (the engine's own source would fetch again).
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    clockRef.current = 0
    setClock(0)
    setPlaying(false)

    ;(async () => {
      try {
        const loaded = await source.load(Number(round))
        if (cancelled) return
        const engine = new ReplayEngine({ load: async () => loaded })
        await engine.load(Number(round))
        if (cancelled) return
        engineRef.current = engine
        setFile(loaded)
        setState(engine.seek(0))
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [round, source])

  // rAF playback: clockRef is the single source of truth; each frame re-seeks to it so pause,
  // speed change and manual seek compose without drift or double-ticking.
  useEffect(() => {
    if (status !== 'ready' || !playing || !file) return
    const engine = engineRef.current!
    const duration = file.meta.durationMs
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dt = now - last
      last = now
      clockRef.current = Math.min(clockRef.current + dt * speed, duration)
      setClock(clockRef.current)
      setState(engine.seek(clockRef.current))
      if (clockRef.current >= duration) setPlaying(false)
      else raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [status, playing, speed, file])

  const seek = (t: number) => {
    const engine = engineRef.current
    if (!engine) return
    clockRef.current = t
    setClock(t)
    setState(engine.seek(t))
  }

  if (status === 'loading') return <p className="replay-status">Loading replay…</p>
  if (status === 'error' || !file || !state)
    return <p className="replay-status">Couldn’t load replay.</p>

  return (
    <div className="replay">
      <header className="replay-header">
        <h1>{file.meta.name}</h1>
        <span className="replay-badge-live">REPLAY</span>
      </header>

      <div className="replay-stage">
        <TrackMap
          outline={file.track.outline}
          cars={state.cars}
          order={state.order}
          drivers={file.drivers}
        />
        <TimingTower
          order={state.order}
          lap={state.lap}
          totalLaps={file.meta.totalLaps}
          drivers={file.drivers}
        />
      </div>

      <Transport
        playing={playing}
        speed={speed}
        clock={clock}
        durationMs={file.meta.durationMs}
        laps={file.laps}
        onPlayPause={() => setPlaying(p => !p)}
        onSpeedChange={setSpeed}
        onSeek={seek}
      />
    </div>
  )
}
