import { STAGE_H, STAGE_W } from './constants'
import { clamp } from './math'

// The seam's two ends are each a point anywhere on the stage border, stored
// as a perimeter parameter t in [0,4): 0-1 walks the top edge (left->right),
// 1-2 the right edge (top->bottom), 2-3 the bottom edge (right->left), 3-4 the
// left edge (bottom->top). A handle can therefore slide around every edge and
// corner, so the seam can be horizontal, vertical, or anything between.
export interface Seam {
  a: number
  b: number
}

export type Point = [number, number]

/** Keeps the two ends from colliding (shortest perimeter distance, in t-units). */
export const MIN_SEP = 0.12

export function wrapT(t: number): number {
  return ((t % 4) + 4) % 4
}

export function perimPoint(t: number): Point {
  t = wrapT(t)
  if (t < 1) return [t * STAGE_W, 0]
  if (t < 2) return [STAGE_W, (t - 1) * STAGE_H]
  if (t < 3) return [STAGE_W - (t - 2) * STAGE_W, STAGE_H]
  return [0, STAGE_H - (t - 3) * STAGE_H]
}

export function closestPerimT(x: number, y: number): number {
  const cx = clamp(x, 0, STAGE_W)
  const cy = clamp(y, 0, STAGE_H)
  const cands = [
    { t: cx / STAGE_W, px: cx, py: 0 },
    { t: 1 + cy / STAGE_H, px: STAGE_W, py: cy },
    { t: 2 + (STAGE_W - cx) / STAGE_W, px: cx, py: STAGE_H },
    { t: 3 + (STAGE_H - cy) / STAGE_H, px: 0, py: cy },
  ]
  let best = cands[0]!
  let bestD = Infinity
  for (const c of cands) {
    const d = Math.hypot(x - c.px, y - c.py)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best.t
}

export function perimDist(t1: number, t2: number): number {
  const d = Math.abs(t1 - t2) % 4
  return Math.min(d, 4 - d)
}

/**
 * Boundary points walking clockwise from t0 to t1 (t1 > t0, may exceed 4).
 * Corners must be visited in increasing unwrapped order or the polygon
 * self-intersects, so collect and sort them rather than trusting [0,1,2,3].
 */
export function arcPolygon(t0: number, t1: number): Point[] {
  const corners: number[] = []
  for (const c of [0, 1, 2, 3]) {
    let cc = c
    while (cc <= t0) cc += 4
    if (cc < t1) corners.push(cc)
  }
  corners.sort((x, y) => x - y)
  return [perimPoint(t0), ...corners.map(perimPoint), perimPoint(t1)]
}

export function toClipPath(pts: Point[]): string {
  return 'polygon(' + pts.map((p) => `${p[0]}px ${p[1]}px`).join(', ') + ')'
}

/** Clip paths for the two panels on either side of the seam. */
export function seamClipPaths(seam: Seam): { left: string; right: string } {
  const b2 = seam.b <= seam.a ? seam.b + 4 : seam.b
  const a2 = seam.a <= seam.b ? seam.a + 4 : seam.a
  return {
    left: toClipPath(arcPolygon(seam.a, b2)),
    right: toClipPath(arcPolygon(seam.b, a2)),
  }
}
