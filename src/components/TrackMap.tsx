import { useLayoutEffect, useRef } from 'react'
import type { CarPos, OrderEntry } from '../replay/engine'
import type { ReplayDriver } from '../replay/format'
import { fitOutline, project, visibleLabels, type Outline } from '../replay/map'

interface TrackMapProps {
  outline: Outline
  cars: Record<number, CarPos>
  order: OrderEntry[]
  drivers: ReplayDriver[]
}

const MARGIN = 32
const DOT_RADIUS = 4 // ~8px diameter
const LABEL_MIN_DIST = 34 // hide crowded labels below this pixel spacing

export default function TrackMap({ outline, cars, order, drivers }: TrackMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const byNum = useRef(new Map<number, ReplayDriver>())
  byNum.current = new Map(drivers.map(d => [d.num, d]))

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return // jsdom / unsupported — nothing to draw

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const fit = fitOutline(outline, w, h, MARGIN)

    // Track outline — soft gray stroke.
    ctx.beginPath()
    outline.forEach(([x, y], i) => {
      const [cx, cy] = project(fit, x, y)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    })
    ctx.closePath()
    ctx.strokeStyle = '#3a3a45'
    ctx.lineWidth = 2
    ctx.stroke()

    // Car dots, projected through the same fit as the outline.
    const points = order
      .filter(o => cars[o.num])
      .map(o => {
        const [cx, cy] = project(fit, cars[o.num].x, cars[o.num].y)
        return { num: o.num, x: cx, y: cy }
      })

    const labelled = visibleLabels(
      points,
      order.slice(0, 3).map(o => o.num),
      LABEL_MIN_DIST,
    )

    for (const p of points) {
      const color = byNum.current.get(p.num)?.color ?? '#8a8a99'
      ctx.beginPath()
      ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#0a0a0f' // dark ring
      ctx.stroke()

      if (labelled.has(p.num)) {
        ctx.fillStyle = '#f0f0f5'
        ctx.font = '600 11px system-ui, sans-serif'
        ctx.textBaseline = 'middle'
        ctx.fillText(byNum.current.get(p.num)?.code ?? String(p.num), p.x + DOT_RADIUS + 4, p.y)
      }
    }
  }, [outline, cars, order])

  return <canvas ref={canvasRef} className="track-map" />
}
