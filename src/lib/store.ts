import { reactive } from 'vue'

import demoLeft from '@/assets/demo/left.jpg'
import demoRight from '@/assets/demo/right.jpg'
import demoFaceLeft from '@/assets/demo/face-left.jpg'
import demoFaceRight from '@/assets/demo/face-right.jpg'

import { STAGE_H, STAGE_W } from './constants'
import { coverFrame, type ImageFrame } from './imageFrame'
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

export const DEMO = {
  left: demoLeft,
  right: demoRight,
  faceLeft: demoFaceLeft,
  faceRight: demoFaceRight,
}

let nextId = 1
let zTop = 10

export const store = reactive({
  /** Current render scale of the stage (screen px per stage px). */
  displayScale: 1,
  // default: a vertical split through the middle (top-mid to bottom-mid)
  seam: { a: 0.5, b: 2.5 } as Seam,
  panels: { left: null, right: null } as Record<PanelSide, ImageFrame | null>,
  elements: [] as ComicElement[],
  selectedId: null as number | null,
})

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
  store.panels[side] = await coverFrame(src, STAGE_W, STAGE_H)
}

export function addCircle(src: string, opts: Partial<CircleElement> = {}): CircleElement {
  const d = opts.d ?? 220
  store.elements.push({
    id: nextId++,
    kind: 'circle',
    x: STAGE_W / 2 - d / 2,
    y: STAGE_H / 2 - d / 2,
    z: 0,
    d,
    ring: 'ink',
    frame: null,
    ...opts,
  })
  // re-read through the reactive array so later mutations are tracked
  const el = store.elements[store.elements.length - 1] as CircleElement
  selectElement(el.id)
  setCircleImage(el, src)
  return el
}

export async function setCircleImage(el: CircleElement, src: string): Promise<void> {
  el.frame = await coverFrame(src, el.d, el.d)
}

export function addText(kind: TextElement['kind'], text: string, opts: Partial<TextElement> = {}): TextElement {
  store.elements.push({
    id: nextId++,
    kind,
    x: STAGE_W / 2 - 130,
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

/** Seeds demo panels, close-ups and captions so the page opens showing what the tool can do. */
export function loadDemo(): void {
  setPanelImage('left', DEMO.left)
  setPanelImage('right', DEMO.right)

  const seamTopX = perimPoint(store.seam.a)[0]
  const seamBottomX = perimPoint(store.seam.b)[0]
  addCircle(DEMO.faceLeft, { d: 180, x: seamTopX - 260, y: STAGE_H * 0.34 - 90 })
  addCircle(DEMO.faceRight, { d: 180, x: seamBottomX + 90, y: STAGE_H * 0.6 - 90, ring: 'pink' })
  addText('bubble', 'Free IQ scan, they said.', { x: 40, y: STAGE_H - 170 })
  addText('caption', 'She stepped out lighter, pinker, and considerably less bothered.', {
    x: STAGE_W / 2 - 260,
    y: STAGE_H - 100,
    w: 520,
    h: 80,
  })
  deselectAll()
}
