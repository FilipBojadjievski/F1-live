// Pure canvas geometry for the track map (Design.md §7). No DOM — the <canvas> draw code calls
// fitOutline once per resize and project per point, and visibleLabels decides label declutter.

export type Outline = [number, number][]

// A fit maps track coordinates (OpenF1 native units, y-up) into canvas pixels (y-down),
// preserving aspect ratio and centering within the margin.
export interface Fit {
  scale: number
  minX: number
  maxY: number
  offsetX: number
  offsetY: number
}

export function fitOutline(outline: Outline, width: number, height: number, margin: number): Fit {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of outline) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const availW = width - 2 * margin
  const availH = height - 2 * margin
  const scale = Math.min(availW / spanX, availH / spanY)

  return {
    scale,
    minX,
    maxY,
    offsetX: margin + (availW - spanX * scale) / 2,
    offsetY: margin + (availH - spanY * scale) / 2,
  }
}

export function project(fit: Fit, x: number, y: number): [number, number] {
  return [fit.offsetX + (x - fit.minX) * fit.scale, fit.offsetY + (fit.maxY - y) * fit.scale]
}

export interface LabelPoint {
  num: number
  x: number
  y: number
}

// Priority cars (top 3) always get a label; others are shown only where they don't crowd an
// already-placed label — greedy, so the first of a colliding pair wins.
export function visibleLabels(points: LabelPoint[], priority: number[], minDist: number): Set<number> {
  const prioritySet = new Set(priority)
  const placed: LabelPoint[] = []
  const shown = new Set<number>()

  const place = (p: LabelPoint) => {
    placed.push(p)
    shown.add(p.num)
  }

  const byNum = new Map(points.map(p => [p.num, p]))
  for (const num of priority) {
    const p = byNum.get(num)
    if (p) place(p)
  }

  const clear = (p: LabelPoint) =>
    placed.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= minDist)

  for (const p of points) {
    if (prioritySet.has(p.num)) continue
    if (clear(p)) place(p)
  }

  return shown
}
