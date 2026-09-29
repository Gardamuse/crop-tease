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

// a mirrored image is flipped about its own middle: x becomes natW - x
export function frameTransform(f: ImageFrame): string {
  const flip = f.mirror ? ` translate(${f.natW}px, 0) scale(-1, 1)` : ''
  return `translate(${f.tx}px, ${f.ty}px) scale(${f.scale})${flip}`
}

/**
 * The photo's transform inside a box of width boxW that is itself flipped
 * left to right (scaleX(-1)): unflipped, and placed so that, with the box's
 * flip, it shows exactly where frameTransform would put the mirrored photo.
 * Flipping the clipping box instead of the photo inside it keeps browsers
 * from dropping the clip (Firefox did, at some zoom levels).
 */
export function frameTransformInFlippedBox(f: ImageFrame, boxW: number): string {
  return `translate(${boxW - f.tx - f.natW * f.scale}px, ${f.ty}px) scale(${f.scale})`
}

/** The same as an SVG transform attribute, moved by (dx, dy) (e.g. a close-up's position). */
export function frameSvgTransform(f: ImageFrame, dx = 0, dy = 0): string {
  const flip = f.mirror ? ` translate(${f.natW} 0) scale(-1 1)` : ''
  return `translate(${dx + f.tx} ${dy + f.ty}) scale(${f.scale})${flip}`
}

export function firstDroppedFile(e: DragEvent): File | undefined {
  return e.dataTransfer?.files?.[0]
}
