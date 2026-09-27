import { clamp } from './math'

/** An image placed inside a fixed-size box, with its own pan and zoom. */
export interface ImageFrame {
  src: string
  natW: number
  natH: number
  /** The "cover" scale; zooming is limited to baseScale..baseScale*MAX_ZOOM. */
  baseScale: number
  scale: number
  tx: number
  ty: number
}

const MAX_ZOOM = 5

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Loads `src` and fits it to cover a boxW x boxH box, centered. */
export async function coverFrame(src: string, boxW: number, boxH: number): Promise<ImageFrame> {
  const img = await loadImage(src)
  const natW = img.naturalWidth
  const natH = img.naturalHeight
  const base = Math.max(boxW / natW, boxH / natH)
  return {
    src,
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
  const newScale = clamp(f.scale * factor, f.baseScale, f.baseScale * MAX_ZOOM)
  f.tx = cx - (cx - f.tx) * (newScale / f.scale)
  f.ty = cy - (cy - f.ty) * (newScale / f.scale)
  f.scale = newScale
}

export function frameTransform(f: ImageFrame): string {
  return `translate(${f.tx}px, ${f.ty}px) scale(${f.scale})`
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function firstDroppedFile(e: DragEvent): File | undefined {
  return e.dataTransfer?.files?.[0]
}
