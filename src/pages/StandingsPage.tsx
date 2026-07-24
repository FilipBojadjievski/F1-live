import { useEffect, useState } from 'react'
import {
  fetchConstructorStandings,
  fetchDriverStandings,
  type ConstructorStanding,
  type DriverStanding,
} from '../api/jolpica'
import { DEFAULT_TEAM_COLOR, TEAM_COLORS } from '../teamColors'

type Tab = 'drivers' | 'constructors'

type FetchState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }

function useStandings<T>(load: () => Promise<T>): [FetchState<T>, () => void] {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<FetchState<T>>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    load().then(
      data => {
        if (!cancelled) setState({ status: 'ready', data })
      },
      () => {
        if (!cancelled) setState({ status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  return [state, () => setAttempt(a => a + 1)]
}

function StandingsStatus({ status, onRetry }: { status: 'loading' | 'error'; onRetry: () => void }) {
  if (status === 'loading') return <p className="standings-status">Loading standings…</p>
  return (
    <p className="standings-status">
      Couldn’t load standings.{' '}
      <button className="retry" onClick={onRetry}>
        Retry
      </button>
    </p>
  )
}

function TeamName({ constructorId, name }: { constructorId: string; name: string }) {
  return (
    <span className="team-name">
      <span
        className="team-bar"
        style={{ background: TEAM_COLORS[constructorId] ?? DEFAULT_TEAM_COLOR }}
      />
      {name}
    </span>
  )
}

function DriversTable() {
  const [state, retry] = useStandings<DriverStanding[]>(fetchDriverStandings)
  if (state.status !== 'ready') return <StandingsStatus status={state.status} onRetry={retry} />
  return (
    <table className="standings-table">
      <thead>
        <tr>
          <th className="num">Pos</th>
          <th>Driver</th>
          <th>Team</th>
          <th className="num">Wins</th>
          <th className="num">Points</th>
        </tr>
      </thead>
      <tbody>
        {state.data.map(row => {
          const team = row.Constructors[0]
          return (
            <tr key={row.Driver.driverId}>
              <td className="num">{row.position}</td>
              <td>
                {row.Driver.givenName} {row.Driver.familyName}
              </td>
              <td>{team && <TeamName constructorId={team.constructorId} name={team.name} />}</td>
              <td className="num">{row.wins}</td>
              <td className="num points">{row.points}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ConstructorsTable() {
  const [state, retry] = useStandings<ConstructorStanding[]>(fetchConstructorStandings)
  if (state.status !== 'ready') return <StandingsStatus status={state.status} onRetry={retry} />
  return (
    <table className="standings-table">
      <thead>
        <tr>
          <th className="num">Pos</th>
          <th>Team</th>
          <th className="num">Points</th>
        </tr>
      </thead>
      <tbody>
        {state.data.map(row => (
          <tr key={row.Constructor.constructorId}>
            <td className="num">{row.position}</td>
            <td>
              <TeamName constructorId={row.Constructor.constructorId} name={row.Constructor.name} />
            </td>
            <td className="num points">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function StandingsPage() {
  const [tab, setTab] = useState<Tab>('drivers')
  return (
    <>
      <h1>Standings</h1>
      <div className="tabs">
        <button
          className={tab === 'drivers' ? 'active' : ''}
          aria-pressed={tab === 'drivers'}
          onClick={() => setTab('drivers')}
        >
          Drivers
        </button>
        <button
          className={tab === 'constructors' ? 'active' : ''}
          aria-pressed={tab === 'constructors'}
          onClick={() => setTab('constructors')}
        >
          Constructors
        </button>
      </div>
      {tab === 'drivers' ? <DriversTable /> : <ConstructorsTable />}
    </>
  )
}
