import type { ImageFrame } from './imageFrame'
import type { ImageOverlay } from './photoEffects'
import { clamp } from './math'

// The page is divided by split bars into a binary tree. Each bar cuts one
// region (a convex polygon) into two, so every panel stays convex. A bar's
// two ends are anchored to the edges of the region it cuts: either the page
// border or an earlier bar. Anchors are stored relative to their host, so
// when a bar moves, every bar hooked onto it follows.

export type Point = [number, number]

export interface Size {
  w: number
  h: number
}

/** What an anchor or polygon edge lies on: the page border, or a bar (by id). */
export type HostId = 'border' | number

/**
 * A point on a host. On the border, t is a perimeter parameter in [0,4):
 * 0-1 walks the top edge (left->right), 1-2 the right edge (top->bottom),
 * 2-3 the bottom edge (right->left) and 3-4 the left edge (bottom->top).
 * On a bar, t runs 0-1 from the bar's `a` end to its `b` end.
 */
export interface Anchor {
  host: HostId
  t: number
}

export interface Bar {
  id: number
  a: Anchor
  b: Anchor
}

export interface Leaf {
  kind: 'leaf'
  id: number
  /** null shows a flat placeholder color */
  frame: ImageFrame | null
  /** a color over the photo; kept when the photo changes */
  overlay: ImageOverlay | null
  /** blur radius in output pixels, 0 for none; kept when the photo changes */
  blur: number
}

/** `front` is the region to the left of the bar looking from `a` to `b` (on screen, y down). */
export interface Split {
  kind: 'split'
  bar: Bar
  front: Region
  back: Region
}

export type Region = Leaf | Split

/** A convex polygon; hosts[i] tags the edge from pts[i] to pts[i+1] (by default, what it lies on). */
export interface Poly<T = HostId> {
  pts: Point[]
  hosts: T[]
}

export interface BarGeom {
  bar: Bar
  /** the region this bar cuts; its ends slide along this region's edges */
  region: Poly
  a: Point
  b: Point
}

export interface PanelGeom {
  leaf: Leaf
  poly: Poly
  clipPath: string
  center: Point
  bbox: { x: number; y: number; w: number; h: number }
}

export interface Layout {
  panels: PanelGeom[]
  bars: BarGeom[]
}

/** Bars shorter than this (in stage units) are rejected. */
export const MIN_BAR_LEN = 30

const EPS = 1e-7
// how close a point must be to an edge to count as lying on it
const ON_EDGE = 0.5

// ---------------------------------------------------------------------------
// Border perimeter
// ---------------------------------------------------------------------------

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
  return wrapT(best.t)
}

// ---------------------------------------------------------------------------
// Polygon helpers
// ---------------------------------------------------------------------------

function lerp(p: Point, q: Point, u: number): Point {
  return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]
}

/** Signed distance of x from the line p->q; positive on the `front` side. */
function side(p: Point, q: Point, x: Point): number {
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  const len = Math.hypot(dx, dy)
  const s = (dx * (x[1] - p[1]) - dy * (x[0] - p[0])) / len
  return Math.abs(s) < EPS ? 0 : s
}

function closestOnSegment(p: Point, q: Point, x: Point): { point: Point; u: number } {
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  const len2 = dx * dx + dy * dy
  const u = len2 === 0 ? 0 : clamp(((x[0] - p[0]) * dx + (x[1] - p[1]) * dy) / len2, 0, 1)
  return { point: lerp(p, q, u), u }
}

function dist(p: Point, q: Point): number {
  return Math.hypot(q[0] - p[0], q[1] - p[1])
}

function edge<T>(poly: Poly<T>, i: number): [Point, Point] {
  return [poly.pts[i]!, poly.pts[(i + 1) % poly.pts.length]!]
}


export function rectPoly({ w, h }: Size): Poly {
  return {
    pts: [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ],
    hosts: ['border', 'border', 'border', 'border'],
  }
}

/** The part of a convex polygon on the front side of the line p->q; the cut edge is tagged `cut`. */
export function clipPoly<T>(poly: Poly<T>, p: Point, q: Point, cut: T): Poly<T> {
  const n = poly.pts.length
  if (n < 3 || dist(p, q) < EPS) return { pts: [], hosts: [] }
  const s = poly.pts.map((x) => side(p, q, x))
  const pts: Point[] = []
  const hosts: T[] = []
  for (let i = 0; i < n; i++) {
    const [cur, nxt] = edge(poly, i)
    const sc = s[i]!
    const sn = s[(i + 1) % n]!
    const host = poly.hosts[i]!
    if (sc >= 0) {
      pts.push(cur)
      // leaving the kept side straight from a vertex on the line: follow the cut
      hosts.push(sc === 0 && sn < 0 ? cut : host)
    }
    if (sc > 0 && sn < 0) {
      pts.push(lerp(cur, nxt, sc / (sc - sn)))
      hosts.push(cut)
    } else if (sc < 0 && sn > 0) {
      pts.push(lerp(cur, nxt, sc / (sc - sn)))
      hosts.push(host)
    }
  }
  // drop zero-length edges; the later point's host is the edge that carries on
  for (let i = pts.length - 1; i >= 0 && pts.length > 1; i--) {
    const prev = (i - 1 + pts.length) % pts.length
    if (dist(pts[i]!, pts[prev]!) < 1e-6) {
      pts.splice(prev, 1)
      hosts.splice(prev, 1)
    }
  }
  return pts.length >= 3 ? { pts, hosts } : { pts: [], hosts: [] }
}

/**
 * Shrinks a convex polygon by moving each edge inward by inset(host of that
 * edge). Returns the shrunken polygon with each edge tagged true if it came
 * from a moved edge, false if it's an original edge that stayed put.
 */
export function insetPoly(poly: Poly, inset: (host: HostId) => number): Poly<boolean> {
  let out: Poly<boolean> = { pts: poly.pts, hosts: poly.hosts.map(() => false) }
  poly.pts.forEach((_, i) => {
    const d = inset(poly.hosts[i]!)
    if (d <= 0) return
    const [p, q] = edge(poly, i)
    const len = dist(p, q)
    if (len < EPS) return
    // inward normal: the interior is on the front (positive) side of each edge
    const nx = (-(q[1] - p[1]) / len) * d
    const ny = ((q[0] - p[0]) / len) * d
    out = clipPoly(out, [p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], true)
  })
  return out
}

/** Closest point on the polygon's boundary, and which edge it's on. */
export function closestOnBoundary(poly: Poly, x: Point): { point: Point; edge: number; host: HostId } {
  let best = { point: x, edge: -1, host: 'border' as HostId }
  let bestD = Infinity
  poly.pts.forEach((_, i) => {
    const [p, q] = edge(poly, i)
    const { point } = closestOnSegment(p, q, x)
    const d = dist(point, x)
    if (d < bestD) {
      bestD = d
      best = { point, edge: i, host: poly.hosts[i]! }
    }
  })
  return best
}

/** True if both points lie on one edge of the polygon (a bar between them would run along it). */
export function shareEdge(poly: Poly, x: Point, y: Point): boolean {
  return poly.pts.some((_, i) => {
    const [p, q] = edge(poly, i)
    return dist(closestOnSegment(p, q, x).point, x) < ON_EDGE && dist(closestOnSegment(p, q, y).point, y) < ON_EDGE
  })
}

export interface ChordEnd {
  point: Point
  host: HostId
}

/**
 * Where the infinite line through p (direction dir) crosses a convex
 * polygon. Ends are ordered along dir. Null if it misses or is too short.
 */
export function lineChord(poly: Poly, p: Point, dir: Point): { a: ChordEnd; b: ChordEnd } | null {
  const n = poly.pts.length
  const len = Math.hypot(dir[0], dir[1])
  if (n < 3 || len < EPS) return null
  const q: Point = [p[0] + dir[0], p[1] + dir[1]]
  const s = poly.pts.map((x) => side(p, q, x))
  const hits: ChordEnd[] = []
  for (let i = 0; i < n; i++) {
    const [cur, nxt] = edge(poly, i)
    const sc = s[i]!
    const sn = s[(i + 1) % n]!
    if (sc === 0) hits.push({ point: cur, host: poly.hosts[i]! })
    else if (sc * sn < 0) hits.push({ point: lerp(cur, nxt, sc / (sc - sn)), host: poly.hosts[i]! })
  }
  if (hits.length < 2) return null
  const along = (h: ChordEnd) => ((h.point[0] - p[0]) * dir[0] + (h.point[1] - p[1]) * dir[1]) / len
  hits.sort((x, y) => along(x) - along(y))
  const a = hits[0]!
  const b = hits[hits.length - 1]!
  if (dist(a.point, b.point) < MIN_BAR_LEN || shareEdge(poly, a.point, b.point)) return null
  return { a, b }
}

export function pointInPoly(poly: Poly, x: Point): boolean {
  let inside = false
  const n = poly.pts.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly.pts[i]!
    const [xj, yj] = poly.pts[j]!
    if (yi > x[1] !== yj > x[1] && x[0] < ((xj - xi) * (x[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Area centroid (falls back to the vertex average if degenerate). */
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
    const n = pts.length || 1
    return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n]
  }
  return [cx / (3 * area), cy / (3 * area)]
}

function bbox(pts: Point[]) {
  if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 }
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

function toClipPath(pts: Point[]): string {
  // an empty polygon() is invalid CSS and would leave the panel unclipped
  if (pts.length < 3) return 'polygon(0 0, 0 0, 0 0)'
  return 'polygon(' + pts.map((p) => `${p[0]}px ${p[1]}px`).join(', ') + ')'
}

// ---------------------------------------------------------------------------
// Anchors
// ---------------------------------------------------------------------------

export type BarSegments = Map<number, [Point, Point]>

export function anchorPoint(anchor: Anchor, segs: BarSegments, size: Size): Point {
  if (anchor.host === 'border') return perimPoint(anchor.t, size)
  const seg = segs.get(anchor.host)
  return seg ? lerp(seg[0], seg[1], anchor.t) : [0, 0]
}

export function anchorAt(host: HostId, point: Point, segs: BarSegments, size: Size): Anchor {
  if (host === 'border') return { host, t: closestPerimT(point[0], point[1], size) }
  const seg = segs.get(host)
  return { host, t: seg ? closestOnSegment(seg[0], seg[1], point).u : 0.5 }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Resolves the tree into panel polygons and bar segments. Each bar's anchors
 * are snapped onto the boundary of the region it cuts, so the layout stays
 * valid even when a host bar has moved out from under a stored anchor.
 */
export function computeLayout(root: Region, size: Size): Layout {
  const panels: PanelGeom[] = []
  const bars: BarGeom[] = []
  const segs: BarSegments = new Map()

  const walk = (node: Region, poly: Poly) => {
    if (node.kind === 'leaf') {
      panels.push({
        leaf: node,
        poly,
        clipPath: toClipPath(poly.pts),
        center: centroid(poly.pts),
        bbox: bbox(poly.pts),
      })
      return
    }
    const { bar } = node
    const a = closestOnBoundary(poly, anchorPoint(bar.a, segs, size)).point
    const b = closestOnBoundary(poly, anchorPoint(bar.b, segs, size)).point
    segs.set(bar.id, [a, b])
    bars.push({ bar, region: poly, a, b })
    walk(node.front, clipPoly(poly, a, b, bar.id))
    walk(node.back, clipPoly(poly, b, a, bar.id))
  }
  walk(root, rectPoly(size))

  return { panels, bars }
}

export function barSegments(layout: Layout): BarSegments {
  return new Map(layout.bars.map((g) => [g.bar.id, [g.a, g.b]]))
}

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

export function leaves(node: Region): Leaf[] {
  return node.kind === 'leaf' ? [node] : [...leaves(node.front), ...leaves(node.back)]
}

export function countBars(node: Region): number {
  return node.kind === 'leaf' ? 0 : 1 + countBars(node.front) + countBars(node.back)
}

/** Swaps `target` for `replacement` in place and returns the (possibly new) root. */
export function replaceNode(node: Region, target: Region, replacement: Region): Region {
  if (node === target) return replacement
  if (node.kind === 'leaf') return node
  node.front = replaceNode(node.front, target, replacement)
  node.back = replaceNode(node.back, target, replacement)
  return node
}

export function findSplit(node: Region, barId: number): Split | undefined {
  if (node.kind === 'leaf') return undefined
  if (node.bar.id === barId) return node
  return findSplit(node.front, barId) ?? findSplit(node.back, barId)
}
