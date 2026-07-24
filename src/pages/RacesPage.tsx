import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchPodiums, fetchRaces, type Race, type RaceResult } from '../api/jolpica'
import { fetchReplayIndex } from '../api/replays'
import { DEFAULT_TEAM_COLOR, TEAM_COLORS } from '../teamColors'

type FetchState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      races: Race[]
      podiums: Record<string, RaceResult[]>
      replayRounds: number[]
    }

function Podium({ results }: { results: RaceResult[] }) {
  return (
    <ol className="podium">
      {results.map(r => (
        <li key={r.position}>
          <span className="num">{r.position}</span>
          <span
            className="team-bar"
            style={{ background: TEAM_COLORS[r.Constructor.constructorId] ?? DEFAULT_TEAM_COLOR }}
          />
          {r.Driver.code ?? r.Driver.familyName}
        </li>
      ))}
    </ol>
  )
}

export default function RacesPage() {
  const [state, setState] = useState<FetchState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchRaces(), fetchPodiums(), fetchReplayIndex()]).then(
      ([races, podiums, index]) => {
        if (!cancelled) setState({ status: 'ready', races, podiums, replayRounds: index.rounds })
      },
      () => {
        if (!cancelled) setState({ status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <h1>Races</h1>
      {state.status === 'loading' && <p className="races-status">Loading races…</p>}
      {state.status === 'error' && <p className="races-status">Couldn’t load races.</p>}
      {state.status === 'ready' && (
        <ul className="race-list">
          {state.races.map(race => {
            const podium = state.podiums[race.round]
            const hasReplay = state.replayRounds.includes(Number(race.round))
            const body = (
              <>
                <span className="race-round">R{race.round}</span>
                <h2>{race.raceName}</h2>
                <p className="race-venue">
                  {race.Circuit.circuitName} · {race.date}
                </p>
                {podium && <Podium results={podium} />}
              </>
            )
            return (
              <li key={race.round} className={podium ? 'race-card' : 'race-card upcoming'}>
                {hasReplay ? (
                  <Link to={`/replay/${race.round}`} className="race-card-link">
                    {body}
                    <span className="replay-badge">Replay ▸</span>
                  </Link>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
