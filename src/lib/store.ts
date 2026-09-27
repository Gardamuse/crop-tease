import { computed, reactive } from 'vue'

import { DEFAULT_BORDER, DEFAULT_PAGE, MAX_BORDER_WIDTH, MAX_PAGE_SIDE, MIN_PAGE_SIDE, STAGE_SHORT } from './constants'
import type { ExportFormat } from './exportImage'
import { coverFrame, type ImageFrame } from './imageFrame'
import { getImage, type StoredImage } from './images'
import {
  anchorAt,
  barSegments,
  closestOnBoundary,
  computeLayout,
  countBars,
  findSplit,
  leaves,
  lineChord,
  MIN_BAR_LEN,
  pointInPoly,
  replaceNode,
  shareEdge,
  type Leaf,
  type Point,
  type Region,
} from './layout'
import { clamp } from './math'

interface ElementBase {
  id: number
  x: number
  y: number
  z: number
}

export interface CircleElement extends ElementBase {
  kind: 'circle'
  d: number
  /** null shows a flat placeholder color */
  frame: ImageFrame | null
}

export interface TextElement extends ElementBase {
  kind: 'caption' | 'bubble'
  w: number
  h: number
  rot: number
  text: string
  fontSize: number
  color: string
}

export type ComicElement = CircleElement | TextElement

let nextId = 1
let zTop = 10

/** Moves the id and z-order counters past everything in the current project. */
export function syncCounters(): void {
  const ids = [
    ...leaves(store.layout).map((l) => l.id),
    ...layout.value.bars.map((g) => g.bar.id),
    ...store.elements.map((e) => e.id),
  ]
  nextId = Math.max(0, ...ids) + 1
  zTop = Math.max(10, ...store.elements.map((e) => e.z))
}

function newLeaf(frame: ImageFrame | null = null): Leaf {
  return { kind: 'leaf', id: nextId++, frame }
}

// default: one vertical bar through the middle (top-mid to bottom-mid)
function starterLayout(): Region {
  return {
    kind: 'split',
    bar: { id: nextId++, a: { host: 'border', t: 0.5 }, b: { host: 'border', t: 2.5 } },
    front: newLeaf(),
    back: newLeaf(),
  }
}

export const store = reactive({
  /** Output size in pixels. */
  page: { ...DEFAULT_PAGE },
  /** page border: width in output pixels (0 = none); color also used for bars and close-up rings */
  border: { ...DEFAULT_BORDER },
  exportFormat: 'webp' as ExportFormat,
  /** Current render scale of the stage (screen px per stage unit). */
  displayScale: 1,
  layout: starterLayout(),
  elements: [] as ComicElement[],
  selectedId: null as number | null,
  selectedBarId: null as number | null,
  /** true while waiting for a click on the panel to split */
  splitMode: false,
  /** bumped whenever a different project is loaded, to remount the stage's components */
  generation: 0,
})

/** Replaces the project with a blank one: default page, one bar, no elements. */
export function resetProject(): void {
  store.page = { ...DEFAULT_PAGE }
  store.border = { ...DEFAULT_BORDER }
  store.layout = starterLayout()
  store.elements = []
  store.selectedId = null
  store.selectedBarId = null
  store.splitMode = false
  store.generation++
}

/** The page in stage units (see STAGE_SHORT), and the factor that scales it to output pixels. */
export const stageSize = computed(() => {
  const exportScale = Math.min(store.page.width, store.page.height) / STAGE_SHORT
  return { w: store.page.width / exportScale, h: store.page.height / exportScale, exportScale }
})

export const layout = computed(() => computeLayout(store.layout, stageSize.value))

export async function setPageSize(width: number, height: number): Promise<void> {
  store.page.width = Math.round(clamp(width, MIN_PAGE_SIDE, MAX_PAGE_SIDE))
  store.page.height = Math.round(clamp(height, MIN_PAGE_SIDE, MAX_PAGE_SIDE))
  // re-fit panel photos so they still cover their reshaped panels
  for (const leaf of leaves(store.layout)) {
    const image = leaf.frame && getImage(leaf.frame.imageId)
    if (image) await setPanelImage(leaf.id, image)
  }
}

export function setBorderWidth(width: number): void {
  store.border.width = Math.round(clamp(width, 0, MAX_BORDER_WIDTH))
}

export function selectElement(id: number): void {
  store.selectedId = id
  store.selectedBarId = null
  const el = findElement(id)
  if (el) el.z = ++zTop
}

export function selectBar(id: number): void {
  store.selectedBarId = id
  store.selectedId = null
}

export function deselectAll(): void {
  store.selectedId = null
  store.selectedBarId = null
}

export function findElement(id: number): ComicElement | undefined {
  return store.elements.find((e) => e.id === id)
}

export function removeElement(id: number): void {
  store.elements = store.elements.filter((e) => e.id !== id)
  if (store.selectedId === id) store.selectedId = null
}

// ---------------------------------------------------------------------------
// Panels and split bars
// ---------------------------------------------------------------------------

export function firstPanelImage(): StoredImage | null {
  const frame = leaves(store.layout).find((l) => l.frame)?.frame
  return (frame && getImage(frame.imageId)) ?? null
}

/** Loads a photo into a panel, fitted to cover the panel's bounding box. */
export async function setPanelImage(leafId: number, image: StoredImage): Promise<void> {
  const panel = layout.value.panels.find((p) => p.leaf.id === leafId)
  if (!panel) return
  const { x, y, w, h } = panel.bbox
  const frame = await coverFrame(image, w, h)
  frame.tx += x
  frame.ty += y
  panel.leaf.frame = frame
}

/** The chord a split at `point` would use: across the panel's longer side. */
export function splitChordAt(point: Point) {
  const panel = layout.value.panels.find((p) => pointInPoly(p.poly, point))
  if (!panel) return null
  const vertical = panel.bbox.w > panel.bbox.h
  const chord = lineChord(panel.poly, point, vertical ? [0, 1] : [1, 0])
  return chord && { panel, chord, vertical }
}

/** Splits the panel under `point` in two with a new bar through it. */
export function splitPanelAt(point: Point): boolean {
  const found = splitChordAt(point)
  if (!found) return false
  const { panel, chord, vertical } = found
  const segs = barSegments(layout.value)
  const size = stageSize.value
  const bar = {
    id: nextId++,
    a: anchorAt(chord.a.host, chord.a.point, segs, size),
    b: anchorAt(chord.b.host, chord.b.point, segs, size),
  }
  // the existing photo stays in the left (vertical bar) or top (horizontal bar) half
  const kept = panel.leaf
  const fresh = newLeaf()
  store.layout = replaceNode(store.layout, kept, {
    kind: 'split',
    bar,
    front: vertical ? kept : fresh,
    back: vertical ? fresh : kept,
  })
  selectBar(bar.id)
  return true
}

/**
 * Removes a bar, merging its two sides into one panel. Any bars inside
 * those sides go too, since they were hooked into the removed bar's regions.
 */
export function removeBar(barId: number): void {
  const split = findSplit(store.layout, barId)
  if (!split) return
  const extra = countBars(split) - 1
  if (extra > 0 && !confirm(`This also removes ${extra} bar${extra > 1 ? 's' : ''} inside the merged panel.`)) return
  const all = leaves(split)
  const keep = all.find((l) => l.frame) ?? all[0]!
  store.layout = replaceNode(store.layout, split, keep)
  if (store.selectedBarId === barId) store.selectedBarId = null
}

/** Slides one end of a bar to the region-boundary point closest to `pointer`. */
export function moveBarEnd(barId: number, end: 'a' | 'b', pointer: Point): void {
  const geom = layout.value.bars.find((g) => g.bar.id === barId)
  if (!geom) return
  const hit = closestOnBoundary(geom.region, pointer)
  const other = end === 'a' ? geom.b : geom.a
  const dx = hit.point[0] - other[0]
  const dy = hit.point[1] - other[1]
  if (Math.hypot(dx, dy) < MIN_BAR_LEN || shareEdge(geom.region, hit.point, other)) return
  geom.bar[end] = anchorAt(hit.host, hit.point, barSegments(layout.value), stageSize.value)
}

/** Moves a bar so it passes through `through`, keeping its angle, re-hooking both ends. */
export function translateBar(barId: number, through: Point, dir: Point): void {
  const geom = layout.value.bars.find((g) => g.bar.id === barId)
  if (!geom) return
  const chord = lineChord(geom.region, through, dir)
  if (!chord) return
  const segs = barSegments(layout.value)
  geom.bar.a = anchorAt(chord.a.host, chord.a.point, segs, stageSize.value)
  geom.bar.b = anchorAt(chord.b.host, chord.b.point, segs, stageSize.value)
}

export function addCircle(image: StoredImage | null, opts: Partial<CircleElement> = {}): CircleElement {
  const d = opts.d ?? 220
  store.elements.push({
    id: nextId++,
    kind: 'circle',
    x: stageSize.value.w / 2 - d / 2,
    y: stageSize.value.h / 2 - d / 2,
    z: 0,
    d,
    frame: null,
    ...opts,
  })
  // re-read through the reactive array so later mutations are tracked
  const el = store.elements[store.elements.length - 1] as CircleElement
  selectElement(el.id)
  if (image) setCircleImage(el, image)
  return el
}

export async function setCircleImage(el: CircleElement, image: StoredImage): Promise<void> {
  el.frame = await coverFrame(image, el.d, el.d)
}

export function addText(kind: TextElement['kind'], text: string, opts: Partial<TextElement> = {}): TextElement {
  store.elements.push({
    id: nextId++,
    kind,
    x: stageSize.value.w / 2 - 130,
    y: 60,
    z: 0,
    w: 260,
    h: 90,
    rot: kind === 'bubble' ? -2 : 0.6,
    text,
    fontSize: 20,
    color: '#241b30',
    ...opts,
  })
  const el = store.elements[store.elements.length - 1] as TextElement
  selectElement(el.id)
  return el
}

/** The starting page: placeholder panels and a single close-up. */
export function loadStarterPage(): void {
  addCircle(null, { d: 180, x: stageSize.value.w / 2 - 260, y: stageSize.value.h * 0.34 - 90 })
  deselectAll()
}
