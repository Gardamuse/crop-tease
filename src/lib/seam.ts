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

export interface Size {
  w: number
  h: number
}

/** Keeps the two ends from colliding (shortest perimeter distance, in t-units). */
export const MIN_SEP = 0.12

export function wrapT(t: number): number {
  return ((t % 4) + 4) % 4
}

export function perimPoint(t: number, { w, h }: Size): Point {
  t = wrapT(t)
  if (t < 1) return [t * w, 0]
  if (t < 2) return [w, (t - 1) * h]
  if (t < 3) return [w - (t - 2) * w, h]
  return [0, h - (t - 3) * h]
}

export function closestPerimT(x: number, y: number, { w, h }: Size): number {
  const cx = clamp(x, 0, w)
  const cy = clamp(y, 0, h)
  const cands = [
    { t: cx / w, px: cx, py: 0 },
    { t: 1 + cy / h, px: w, py: cy },
    { t: 2 + (w - cx) / w, px: cx, py: h },
    { t: 3 + (h - cy) / h, px: 0, py: cy },
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
export function arcPolygon(t0: number, t1: number, size: Size): Point[] {
  const corners: number[] = []
  for (const c of [0, 1, 2, 3]) {
    let cc = c
    while (cc <= t0) cc += 4
    if (cc < t1) corners.push(cc)
  }
  corners.sort((x, y) => x - y)
  return [perimPoint(t0, size), ...corners.map((c) => perimPoint(c, size)), perimPoint(t1, size)]
}

export function toClipPath(pts: Point[]): string {
  return 'polygon(' + pts.map((p) => `${p[0]}px ${p[1]}px`).join(', ') + ')'
}

/** Area centroid of a simple polygon (falls back to the vertex average if degenerate). */
export function centroid(pts: Point[]): Point {
  let area = 0
  let cx = 0
  let cy = 0
  pts.forEach(([x0, y0], i) => {
    const [x1, y1] = pts[(i + 1) % pts.length]!
    const cross = x0 * y1 - x1 * y0
    area += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  })
  if (Math.abs(area) < 1e-6) {
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
  }
  return [cx / (3 * area), cy / (3 * area)]
}

export interface PanelShape {
  clipPath: string
  center: Point
}

/**
 * The two panels on either side of the seam. With the default seam (a on
 * the top edge, b on the bottom), walking clockwise from b back round to a
 * covers the left half of the page.
 */
export function seamPanels(seam: Seam, size: Size): { left: PanelShape; right: PanelShape } {
  const a2 = seam.a <= seam.b ? seam.a + 4 : seam.a
  const b2 = seam.b <= seam.a ? seam.b + 4 : seam.b
  const shape = (pts: Point[]) => ({ clipPath: toClipPath(pts), center: centroid(pts) })
  return {
    left: shape(arcPolygon(seam.b, a2, size)),
    right: shape(arcPolygon(seam.a, b2, size)),
  }
}
