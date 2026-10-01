// A small picture of the project's first page for the Recent projects list,
// drawn from the page bar's sketch of it (see PageThumb). The sketch's photos
// are swapped for shrunken copies, so the picture stays small and can be
// rasterized (an SVG drawn as an image can't load blob: URLs).

/** height of the picture in pixels; its width follows the page */
const THUMB_HEIGHT = 240
/** longest side of the photo copies drawn into it */
const PHOTO_SIDE = 600

// shrunken copies by source URL, kept while the project is open
const photoCache = new Map<string, Promise<string>>()

async function shrunkenPhoto(src: string): Promise<string> {
  let copy = photoCache.get(src)
  if (!copy) {
    copy = (async () => {
      const bitmap = await createImageBitmap(await (await fetch(src)).blob())
      const k = Math.min(1, PHOTO_SIDE / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * k))
      canvas.height = Math.max(1, Math.round(bitmap.height * k))
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      return canvas.toDataURL('image/jpeg', 0.85)
    })()
    photoCache.set(src, copy)
    copy.catch(() => photoCache.delete(src))
  }
  return copy
}

/** Forgets the photo copies (when a different project is opened). */
export function clearThumbnailCache(): void {
  photoCache.clear()
}

// the text styles the sketch gets from its stylesheet, which a lone SVG doesn't have
const TEXT_STYLES = ['font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'paint-order'] as const

/** Draws the first page's sketch as a small image, or null if it isn't on screen. */
export async function captureThumbnail(): Promise<Blob | null> {
  const sketch = document.querySelector<SVGSVGElement>('svg.thumb')
  if (!sketch) return null
  const [, , vw, vh] = (sketch.getAttribute('viewBox') ?? '').split(' ').map(Number)
  if (!vw || !vh) return null
  const height = THUMB_HEIGHT
  const width = Math.round((THUMB_HEIGHT * vw) / vh)

  const clone = sketch.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  const texts = sketch.querySelectorAll('text')
  clone.querySelectorAll('text').forEach((t, i) => {
    const style = getComputedStyle(texts[i]!)
    for (const prop of TEXT_STYLES) t.style.setProperty(prop, style.getPropertyValue(prop))
  })
  await Promise.all(
    [...clone.querySelectorAll('image')].map(async (img) => {
      const src = img.getAttribute('href')
      if (!src) return
      try {
        img.setAttribute('href', await shrunkenPhoto(src))
      } catch {
        img.remove() // unreadable: the panel shows black
      }
    }),
  )

  const svg = new XMLSerializer().serializeToString(clone)
  const image = new Image()
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(image, 0, 0, width, height)
  // browsers that can't encode WebP hand back a PNG, which is fine here
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
}
