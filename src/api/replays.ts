// Baked replay availability — Design.md §3: public/replays/index.json lists rounds with replay data.

export interface ReplayIndex {
  rounds: number[]
}

export async function fetchReplayIndex(): Promise<ReplayIndex> {
  const res = await fetch(`${import.meta.env.BASE_URL}replays/index.json`)
  if (!res.ok) return { rounds: [] } // not baked yet — treat as "no replays"
  return (await res.json()) as ReplayIndex
}
