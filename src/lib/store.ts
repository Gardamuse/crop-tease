import { computed, reactive } from 'vue'

import { DEFAULT_PAGE, MAX_PAGE_SIDE, MIN_PAGE_SIDE, STAGE_SHORT } from './constants'
import type { ExportFormat } from './exportImage'
import { coverFrame, type ImageFrame } from './imageFrame'
import { clamp } from './math'
import { perimPoint, type Seam } from './seam'

export type PanelSide = 'left' | 'right'

interface ElementBase {
  id: number
  x: number
  y: number
  z: number
}

export interface CircleElement extends ElementBase {
  kind: 'circle'
  d: number
  ring: 'ink' | 'pink'
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

export const store = reactive({
  /** Output size in pixels. */
  page: { ...DEFAULT_PAGE },
  exportFormat: 'webp' as ExportFormat,
  /** Current render scale of the stage (screen px per stage unit). */
  displayScale: 1,
  // default: a vertical split through the middle (top-mid to bottom-mid)
  seam: { a: 0.5, b: 2.5 } as Seam,
  panels: { left: null, right: null } as Record<PanelSide, ImageFrame | null>,
  elements: [] as ComicElement[],
  selectedId: null as number | null,
})

/** The page in stage units (see STAGE_SHORT), and the factor that scales it to output pixels. */
export const stageSize = computed(() => {
  const exportScale = Math.min(store.page.width, store.page.height) / STAGE_SHORT
  return { w: store.page.width / exportScale, h: store.page.height / exportScale, exportScale }
})

export async function setPageSize(width: number, height: number): Promise<void> {
  store.page.width = Math.round(clamp(width, MIN_PAGE_SIDE, MAX_PAGE_SIDE))
  store.page.height = Math.round(clamp(height, MIN_PAGE_SIDE, MAX_PAGE_SIDE))
  // re-fit panel photos so they still cover the reshaped page
  for (const side of ['left', 'right'] as const) {
    const frame = store.panels[side]
    if (frame) await setPanelImage(side, frame.src)
  }
}

export function selectElement(id: number): void {
  store.selectedId = id
  const el = findElement(id)
  if (el) el.z = ++zTop
}

export function deselectAll(): void {
  store.selectedId = null
}

export function findElement(id: number): ComicElement | undefined {
  return store.elements.find((e) => e.id === id)
}

export function removeElement(id: number): void {
  store.elements = store.elements.filter((e) => e.id !== id)
  if (store.selectedId === id) store.selectedId = null
}

export function clearElements(): void {
  store.elements = []
  store.selectedId = null
}

export async function setPanelImage(side: PanelSide, src: string): Promise<void> {
  store.panels[side] = await coverFrame(src, stageSize.value.w, stageSize.value.h)
}

export function addCircle(src: string | null, opts: Partial<CircleElement> = {}): CircleElement {
  const d = opts.d ?? 220
  store.elements.push({
    id: nextId++,
    kind: 'circle',
    x: stageSize.value.w / 2 - d / 2,
    y: stageSize.value.h / 2 - d / 2,
    z: 0,
    d,
    ring: 'ink',
    frame: null,
    ...opts,
  })
  // re-read through the reactive array so later mutations are tracked
  const el = store.elements[store.elements.length - 1] as CircleElement
  selectElement(el.id)
  if (src) setCircleImage(el, src)
  return el
}

export async function setCircleImage(el: CircleElement, src: string): Promise<void> {
  el.frame = await coverFrame(src, el.d, el.d)
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
  const seamTopX = perimPoint(store.seam.a, stageSize.value)[0]
  addCircle(null, { d: 180, x: seamTopX - 260, y: stageSize.value.h * 0.34 - 90 })
  deselectAll()
}
