import { computed, reactive } from 'vue'

import {
  DEFAULT_BORDER,
  DEFAULT_CLOSE_UPS,
  DEFAULT_PAGE,
  MAX_BORDER_WIDTH,
  MAX_DIVIDER_WIDTH,
  MAX_OUTLINE_WIDTH,
  MAX_PAGE_SIDE,
  MIN_OUTLINE_WIDTH,
  MIN_PAGE_SIDE,
  STAGE_SHORT,
  type TailPosition,
  type TextStyle,
} from './constants'
import type { ExportFormat } from './exportImage'
import { coverFrame, type ImageFrame } from './imageFrame'
import { getImage, type StoredImage } from './images'
import {
  anchorAt,
  barSegments,
  clipPoly,
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
  kind: 'text'
  /** the frame around the text: none, a speech bubble, or a square caption box */
  style: TextStyle
  /** where a speech bubble's tail sits */
  tail: TailPosition
  w: number
  h: number
  rot: number
  text: string
  fontSize: number
  color: string
}

export type ComicElement = CircleElement | TextElement

/** One page of the comic: its panels and dividers, plus close-ups and text. */
export interface ComicPage {
  id: number
  layout: Region
  elements: ComicElement[]
}

let nextId = 1
let zTop = 10

function barIds(node: Region): number[] {
  return node.kind === 'leaf' ? [] : [node.bar.id, ...barIds(node.front), ...barIds(node.back)]
}

/** Moves the id and z-order counters past everything in the project (ids are unique across pages). */
export function syncCounters(): void {
  const ids = store.pages.flatMap((p) => [
    p.id,
    ...leaves(p.layout).map((l) => l.id),
    ...barIds(p.layout),
    ...p.elements.map((e) => e.id),
  ])
  nextId = Math.max(0, ...ids) + 1
  zTop = Math.max(10, ...store.pages.flatMap((p) => p.elements.map((e) => e.z)))
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

/** An empty page: one full-page panel, nothing on it. */
function newPage(layout: Region = newLeaf()): ComicPage {
  return { id: nextId++, layout, elements: [] }
}

export const store = reactive({
  /** Output size in pixels. */
  pageSize: { ...DEFAULT_PAGE },
  /**
   * page border: width in output pixels (0 = none); color also used for bars
   * and close-up rings; the outline runs along all of those
   */
  border: { ...DEFAULT_BORDER },
  closeUps: { ...DEFAULT_CLOSE_UPS },
  exportFormat: 'webp' as ExportFormat,
  /** Current render scale of the stage (screen px per stage unit). */
  displayScale: 1,
  pages: [newPage(starterLayout())] as ComicPage[],
  /** index into pages of the page being edited */
  pageIndex: 0,
  /** the current page's panels and dividers */
  get layout(): Region {
    return this.pages[this.pageIndex]!.layout
  },
  set layout(value: Region) {
    this.pages[this.pageIndex]!.layout = value
  },
  /** the current page's close-ups and text */
  get elements(): ComicElement[] {
    return this.pages[this.pageIndex]!.elements
  },
  set elements(value: ComicElement[]) {
    this.pages[this.pageIndex]!.elements = value
  },
  selectedId: null as number | null,
  selectedBarId: null as number | null,
  /** true while waiting for a click on the panel to split */
  splitMode: false,
  /** bumped whenever a different project is loaded, to remount the stage's components */
  generation: 0,
})

function resetEditing(): void {
  store.selectedId = null
  store.selectedBarId = null
  store.splitMode = false
  store.generation++
}

/**
 * Clears the content (all pages, photos, dividers, close-ups, text) for a new
 * project, keeping the settings: page size, lines, close-up options and export format.
 */
export function clearContent(): void {
  store.pages = [newPage()]
  store.pageIndex = 0
  resetEditing()
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export function switchPage(index: number): void {
  if (index === store.pageIndex || index < 0 || index >= store.pages.length) return
  store.pageIndex = index
  resetEditing()
}

/** Adds an empty page after the current one and switches to it. */
export function addPage(): void {
  store.pages.splice(store.pageIndex + 1, 0, newPage())
  store.pageIndex++
  resetEditing()
}

/** Removes a page (never the last one left), staying on a neighbouring page. */
export function removePage(index: number): void {
  if (store.pages.length <= 1 || index < 0 || index >= store.pages.length) return
  store.pages.splice(index, 1)
  if (store.pageIndex > index || store.pageIndex >= store.pages.length) store.pageIndex--
  resetEditing()
}

/** The page in stage units (see STAGE_SHORT), and the factor that scales it to output pixels. */
export const stageSize = computed(() => {
  const exportScale = Math.min(store.pageSize.width, store.pageSize.height) / STAGE_SHORT
  return { w: store.pageSize.width / exportScale, h: store.pageSize.height / exportScale, exportScale }
})

export const layout = computed(() => computeLayout(store.layout, stageSize.value))

/** The page border's width in stage units (it's set in output pixels). */
export const borderStageWidth = computed(() => store.border.width / stageSize.value.exportScale)

/** The split bars' and close-up rings' width in stage units. */
export const dividerStageWidth = computed(() => store.border.dividerWidth / stageSize.value.exportScale)

/** The border outline's color and width in stage units, or null for none. */
export const outlineStyle = computed(() => {
  const color = store.border.outlineColor
  return color ? { color, width: store.border.outlineWidth / stageSize.value.exportScale } : null
})

/**
 * The area close-ups may draw in when kept inside the border: the page minus
 * the border and its outline, in stage units. Null when they aren't clipped.
 */
export const closeUpBounds = computed(() => {
  if (!store.closeUps.withinBorder || store.border.width <= 0) return null
  const inset = borderStageWidth.value + (outlineStyle.value?.width ?? 0)
  const { w, h } = stageSize.value
  return { left: inset, top: inset, right: w - inset, bottom: h - inset }
})

export async function setPageSize(width: number, height: number): Promise<void> {
  store.pageSize.width = Math.round(clamp(width, MIN_PAGE_SIDE, MAX_PAGE_SIDE))
  store.pageSize.height = Math.round(clamp(height, MIN_PAGE_SIDE, MAX_PAGE_SIDE))
  // re-fit panel photos on every page so they still cover their reshaped panels
  for (const page of store.pages) {
    for (const panel of computeLayout(page.layout, stageSize.value).panels) {
      const image = panel.leaf.frame && getImage(panel.leaf.frame.imageId)
      if (image) panel.leaf.frame = await coverPanel(image, panel.bbox)
    }
  }
}

/** A frame fitting an image to cover a panel's bounding box. */
async function coverPanel(image: StoredImage, box: { x: number; y: number; w: number; h: number }) {
  const frame = await coverFrame(image, box.w, box.h)
  frame.tx += box.x
  frame.ty += box.y
  return frame
}

export function setBorderWidth(width: number): void {
  store.border.width = Math.round(clamp(width, 0, MAX_BORDER_WIDTH))
}

export function setOutlineWidth(width: number): void {
  store.border.outlineWidth = Math.round(clamp(width, MIN_OUTLINE_WIDTH, MAX_OUTLINE_WIDTH))
}

export function setDividerWidth(width: number): void {
  store.border.dividerWidth = Math.round(clamp(width, 0, MAX_DIVIDER_WIDTH))
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
  if (panel) panel.leaf.frame = await coverPanel(image, panel.bbox)
}

export function clearPanelImage(leafId: number): void {
  const leaf = leaves(store.layout).find((l) => l.id === leafId)
  if (leaf) leaf.frame = null
}

/** The chord a split at `point` would use: across the panel's longer side. */
export function splitChordAt(point: Point) {
  const panel = layout.value.panels.find((p) => pointInPoly(p.poly, point))
  if (!panel) return null
  const vertical = panel.bbox.w > panel.bbox.h
  const chord = lineChord(panel.poly, point, vertical ? [0, 1] : [1, 0])
  return chord && { panel, chord, vertical }
}

/** Which side of a new bar gets the new, empty panel (see Split for front/back). */
export type SplitSide = 'front' | 'back'

// how far (stage units) the pointer must be from the cut to pick a side
const SIDE_DEADZONE = 6

/**
 * A split at `point`, with the side that gets the new empty panel: by
 * default the right (vertical cut) or bottom (horizontal cut) side, or
 * whichever side `toward` is on when it's clear of the cut.
 */
export function planSplit(point: Point, toward?: Point) {
  const found = splitChordAt(point)
  if (!found) return null
  const { panel, chord, vertical } = found
  const a = chord.a.point
  const b = chord.b.point
  let freshSide: SplitSide = vertical ? 'back' : 'front'
  if (toward) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const side = ((b[0] - a[0]) * (toward[1] - a[1]) - (b[1] - a[1]) * (toward[0] - a[0])) / len
    if (Math.abs(side) > SIDE_DEADZONE) freshSide = side > 0 ? 'front' : 'back'
  }
  const freshPoly = (freshSide === 'front' ? clipPoly(panel.poly, a, b, 0) : clipPoly(panel.poly, b, a, 0)).pts
  return { ...found, freshSide, freshPoly }
}

/** Splits the panel under `point` in two with a new bar through it; `freshSide` gets the new empty panel. */
export function splitPanelAt(point: Point, freshSide?: SplitSide): boolean {
  const plan = planSplit(point)
  if (!plan) return false
  const { panel, chord } = plan
  const freshOn = freshSide ?? plan.freshSide
  const segs = barSegments(layout.value)
  const size = stageSize.value
  const bar = {
    id: nextId++,
    a: anchorAt(chord.a.host, chord.a.point, segs, size),
    b: anchorAt(chord.b.host, chord.b.point, segs, size),
  }
  // the existing photo stays on the other side
  const kept = panel.leaf
  const fresh = newLeaf()
  store.layout = replaceNode(store.layout, kept, {
    kind: 'split',
    bar,
    front: freshOn === 'front' ? fresh : kept,
    back: freshOn === 'front' ? kept : fresh,
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

export function addText(opts: Partial<TextElement> = {}): TextElement {
  store.elements.push({
    id: nextId++,
    kind: 'text',
    style: 'speech',
    tail: 'bottom-left',
    x: stageSize.value.w / 2 - 130,
    y: 60,
    z: 0,
    w: 260,
    h: 90,
    rot: 0,
    text: 'Text…',
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
