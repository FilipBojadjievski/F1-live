import { useParams } from 'react-router'

export default function ReplayPage() {
  const { round } = useParams()
  return <h1>Replay — Round {round}</h1>
}
