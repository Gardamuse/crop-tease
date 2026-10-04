import type { StoredImage } from './images'
import { clamp } from './math'

/** An image placed inside a fixed-size box, with its own pan and zoom. */
export interface ImageFrame {
  imageId: string
  /** the image's object URL; not saved, rebuilt from imageId on load */
  src: string
  natW: number
  natH: number
  /** The "cover" scale; zooming is limited to baseScale*MIN_ZOOM..baseScale*MAX_ZOOM. */
  baseScale: number
  scale: number
  tx: number
  ty: number
  /** flipped left to right, within the same spot (so pan and zoom work as before) */
  mirror: boolean
  /** degrees clockwise the photo is turned about its own middle, -180..180 (tx, ty place it unturned) */
  rotation: number
}

// Zoom range relative to the cover scale. Below 1 the photo no longer fills
// its area and the background shows around it.
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Fits an image to cover a boxW x boxH box, centered. */
export async function coverFrame(image: StoredImage, boxW: number, boxH: number): Promise<ImageFrame> {
  const img = await loadImage(image.url)
  const natW = img.naturalWidth
  const natH = img.naturalHeight
  const base = Math.max(boxW / natW, boxH / natH)
  return {
    imageId: image.id,
    src: image.url,
    natW,
    natH,
    baseScale: base,
    scale: base,
    tx: (boxW - natW * base) / 2,
    ty: (boxH - natH * base) / 2,
    mirror: false,
    rotation: 0,
  }
}

/** Zooms one wheel step in or out, keeping (cx, cy) fixed. */
export function zoomFrame(f: ImageFrame, deltaY: number, cx: number, cy: number): void {
  const factor = deltaY < 0 ? 1.08 : 0.93
  const newScale = clamp(f.scale * factor, f.baseScale * MIN_ZOOM, f.baseScale * MAX_ZOOM)
  f.tx = cx - (cx - f.tx) * (newScale / f.scale)
  f.ty = cy - (cy - f.ty) * (newScale / f.scale)
  f.scale = newScale
}

/**
 * Turns the photo to `deg` degrees, keeping the spot (cx, cy) of the stage
 * (e.g. its box's middle) on the same part of the photo.
 */
export function rotateFrame(f: ImageFrame, deg: number, cx: number, cy: number): void {
  const turn = ((deg - f.rotation) * Math.PI) / 180
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  // from the photo's middle, where it's turned about, to (cx, cy)
  const dx = cx - (f.tx + (f.natW * f.scale) / 2)
  const dy = cy - (f.ty + (f.natH * f.scale) / 2)
  f.tx += dx - (dx * cos - dy * sin)
  f.ty += dy - (dx * sin + dy * cos)
  f.rotation = deg
}

/** turning the image about its own middle, in its own pixels */
function turnCss(f: ImageFrame): string {
  const deg = f.rotation
  if (!deg) return ''
  const [mx, my] = [f.natW / 2, f.natH / 2]
  return ` translate(${mx}px, ${my}px) rotate(${deg}deg) translate(${-mx}px, ${-my}px)`
}

// a mirrored image is flipped about its own middle: x becomes natW - x
export function frameTransform(f: ImageFrame): string {
  const flip = f.mirror ? ` translate(${f.natW}px, 0) scale(-1, 1)` : ''
  return `translate(${f.tx}px, ${f.ty}px) scale(${f.scale})${turnCss(f)}${flip}`
}

/**
 * For a photo in a round box (a close-up): the box's own transform, turned
 * and flipped about its middle as the photo is, which leaves the circle as
 * it was. Turning and flipping the clipping box instead of the photo inside
 * it keeps browsers from dropping the clip (Firefox did around a mirrored
 * photo at some zoom levels, and others around a turned one).
 */
export function roundBoxTransform(f: ImageFrame): string {
  return `rotate(${f.rotation}deg)${f.mirror ? ' scaleX(-1)' : ''}`
}

/** roundBoxTransform undone, for what in the box should stay as it is (e.g. an overlay) */
export function roundBoxUndo(f: ImageFrame): string {
  return `${f.mirror ? 'scaleX(-1) ' : ''}rotate(${-f.rotation}deg)`
}

/**
 * The photo's transform inside a boxW x boxH box with roundBoxTransform:
 * neither turned nor flipped, and placed so that, with the box's turn and
 * flip, it shows exactly where frameTransform would put it. (The photo's
 * middle, from the box's, is turned back and flipped; the rest cancels.)
 */
export function frameTransformInRoundBox(f: ImageFrame, boxW: number, boxH: number): string {
  const turn = (-f.rotation * Math.PI) / 180
  const dx = f.tx + (f.natW * f.scale) / 2 - boxW / 2
  const dy = f.ty + (f.natH * f.scale) / 2 - boxH / 2
  const x = dx * Math.cos(turn) - dy * Math.sin(turn)
  const y = dx * Math.sin(turn) + dy * Math.cos(turn)
  const left = boxW / 2 + (f.mirror ? -x : x) - (f.natW * f.scale) / 2
  const top = boxH / 2 + y - (f.natH * f.scale) / 2
  return `translate(${left}px, ${top}px) scale(${f.scale})`
}

/** The same as an SVG transform attribute, moved by (dx, dy) (e.g. a close-up's position). */
export function frameSvgTransform(f: ImageFrame, dx = 0, dy = 0): string {
  const flip = f.mirror ? ` translate(${f.natW} 0) scale(-1 1)` : ''
  const turn = f.rotation ? ` rotate(${f.rotation} ${f.natW / 2} ${f.natH / 2})` : ''
  return `translate(${dx + f.tx} ${dy + f.ty}) scale(${f.scale})${turn}${flip}`
}

export function firstDroppedFile(e: DragEvent): File | undefined {
  return e.dataTransfer?.files?.[0]
}
