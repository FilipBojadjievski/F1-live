import { Fragment, memo, useLayoutEffect, useRef } from 'react'
import type { OrderEntry } from '../replay/engine'
import type { ReplayDriver } from '../replay/format'

interface TimingTowerProps {
  order: OrderEntry[]
  lap: number
  totalLaps: number
  drivers: ReplayDriver[]
}

function gapText(entry: OrderEntry, isLeader: boolean): string {
  if (entry.retired) return 'OUT'
  if (isLeader) return 'Leader'
  return `+${entry.gap.toFixed(1)}`
}

// FLIP: capture each row's previous top, then on the next paint animate from the old position to
// the new one so overtakes slide (~300 ms) instead of jumping. Design.md §7.
function useFlip(order: OrderEntry[]) {
  const rows = useRef(new Map<number, HTMLLIElement>())
  const prevTops = useRef(new Map<number, number>())

  useLayoutEffect(() => {
    const tops = new Map<number, number>()
    for (const [num, el] of rows.current) {
      const top = el.offsetTop
      tops.set(num, top)
      const prev = prevTops.current.get(num)
      if (prev !== undefined && prev !== top) {
        el.style.transition = 'none'
        el.style.transform = `translateY(${prev - top}px)`
        // Force reflow, then let the transition carry it home.
        void el.offsetWidth
        el.style.transition = 'transform 300ms ease'
        el.style.transform = ''
      }
    }
    prevTops.current = tops
  }, [order])

  return rows
}

function TimingTower({ order, lap, totalLaps, drivers }: TimingTowerProps) {
  const byNum = new Map(drivers.map(d => [d.num, d]))
  const rows = useFlip(order)
  const firstRetired = order.findIndex(o => o.retired)

  return (
    <div className="timing-tower">
      <div className="tower-header">
        LAP {lap} / {totalLaps}
      </div>
      <ol className="tower-rows">
        {order.map((entry, i) => {
          const driver = byNum.get(entry.num)
          const leader = i === 0 && !entry.retired
          return (
            <Fragment key={entry.num}>
              {i === firstRetired && i > 0 && (
                <li className="tower-divider" role="separator" />
              )}
              <li
                className={entry.retired ? 'tower-row retired' : 'tower-row'}
                ref={el => {
                  if (el) rows.current.set(entry.num, el)
                  else rows.current.delete(entry.num)
                }}
              >
                <span className="pos">{entry.pos}</span>
                <span
                  className="team-bar"
                  data-testid="team-bar"
                  style={{ background: driver?.color }}
                />
                <span className="code" data-testid="code">
                  {driver?.code ?? entry.num}
                </span>
                <span className="gap" data-testid="gap">
                  {gapText(entry, leader)}
                </span>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}

// Re-render only when the derived order/gap values actually change (Design.md §4).
export default memo(TimingTower, (a, b) => {
  if (a.lap === b.lap && a.order === b.order) return true
  if (a.lap !== b.lap || a.order.length !== b.order.length) return false
  return a.order.every((e, i) => {
    const o = b.order[i]
    return e.num === o.num && e.pos === o.pos && e.gap === o.gap && e.retired === o.retired
  })
})
