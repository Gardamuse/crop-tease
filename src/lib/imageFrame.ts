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

export function frameTransform(f: ImageFrame): string {
  return `translate(${f.tx}px, ${f.ty}px) scale(${f.scale})`
}

export function firstDroppedFile(e: DragEvent): File | undefined {
  return e.dataTransfer?.files?.[0]
}
