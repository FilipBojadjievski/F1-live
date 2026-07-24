import { describe, expect, it } from 'vitest'
import { fitOutline, project, visibleLabels } from './map'

describe('fitOutline + project', () => {
  it('fits a square outline into the canvas with margin and flips the y axis', () => {
    // Square 0..10 on both axes, into 100x100 with a 10px margin → 80px of usable space, scale 8.
    const fit = fitOutline([[0, 0], [10, 0], [10, 10], [0, 10]], 100, 100, 10)

    // Screen y is flipped: outline (0,0) is bottom-left → high canvas y; (10,10) is top-right.
    expect(project(fit, 0, 0)).toEqual([10, 90])
    expect(project(fit, 10, 10)).toEqual([90, 10])
    expect(project(fit, 0, 10)).toEqual([10, 10])
  })

  it('preserves aspect ratio and centers the smaller axis', () => {
    // bbox 20 wide, 10 tall into 100x100 no margin → scale limited by width = 5, height centered.
    const fit = fitOutline([[0, 0], [20, 0], [20, 10], [0, 10]], 100, 100, 0)

    expect(project(fit, 0, 0)).toEqual([0, 75]) // content 50 tall, centered in 100 → 25px band
    expect(project(fit, 20, 10)).toEqual([100, 25])
  })
})

describe('visibleLabels', () => {
  const at = (num: number, x: number, y: number) => ({ num, x, y })

  it('always shows priority labels regardless of density', () => {
    const visible = visibleLabels([at(1, 0, 0), at(2, 1, 0)], [1, 2], 100)
    expect(visible).toEqual(new Set([1, 2]))
  })

  it('hides a non-priority label that sits within minDist of a shown label', () => {
    // 2 is 5px from priority 1 (< 20) → hidden; 3 is far → shown.
    const visible = visibleLabels([at(1, 0, 0), at(2, 5, 0), at(3, 100, 0)], [1], 20)
    expect(visible).toEqual(new Set([1, 3]))
  })

  it('keeps the first of two colliding non-priority labels and drops the second', () => {
    const visible = visibleLabels([at(5, 0, 0), at(6, 3, 0)], [], 20)
    expect(visible).toEqual(new Set([5]))
  })
})
