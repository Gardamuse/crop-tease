import { EXPORT_QUALITY } from './constants'

export type ExportFormat = 'webp' | 'jpg'

const MIME: Record<ExportFormat, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
}

export const EXPORT_MIME = MIME

export type ExportProgress = (fraction: number, label: string) => void

export interface ExportOptions {
  /** output size in pixels */
  width: number
  height: number
  /** stage units -> output pixels */
  scale: number
  format: ExportFormat
}

/** Marks editor-only chrome that must not appear in the flattened export. */
export const NO_EXPORT_ATTR = 'data-no-export'

function collectCss(): string {
  let css = ''
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + '\n'
    } catch {
      // cross-origin stylesheet; nothing we can inline
    }
  }
  return css
}

async function toDataUrl(src: string): Promise<string> {
  const blob = await (await fetch(src)).blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// An SVG rendered as an <img> can't load external resources, so every
// image in the clone has to be inlined as a data URL first.
async function inlineImages(root: Element, onProgress: (fraction: number) => void): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img')).filter((i) => !i.getAttribute('src')?.startsWith('data:'))
  const cache = new Map<string, Promise<string>>()
  let done = 0
  await Promise.all(
    imgs.map(async (img) => {
      if (!cache.has(img.src)) cache.set(img.src, toDataUrl(img.src))
      img.setAttribute('src', await cache.get(img.src)!)
      onProgress(++done / imgs.length)
    }),
  )
}

/** Lets the browser paint (e.g. the progress bar) before the next heavy step. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
}

// Loaded as a data: URL rather than a blob: URL, since Chromium taints the
// canvas when a foreignObject SVG comes from a blob.
function rasterize(svg: string, { width, height, format }: ExportOptions, onProgress: ExportProgress): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = async () => {
      onProgress(0.75, 'Drawing')
      await nextFrame()
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0)
      onProgress(0.85, `Encoding ${format.toUpperCase()}`)
      await nextFrame()
      try {
        canvas.toBlob(
          (b) => {
            if (!b) reject(new Error('Canvas produced no image'))
            // browsers silently fall back to PNG for formats they can't encode
            else if (b.type !== MIME[format]) reject(new Error(`This browser can't encode ${format.toUpperCase()} images`))
            else resolve(b)
          },
          MIME[format],
          EXPORT_QUALITY,
        )
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Failed to rasterize the page'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

/**
 * Renders the stage to an image at export resolution. The clone is scaled
 * up before rasterizing, so text and vector shapes are drawn fresh at the
 * higher size rather than stretched afterwards.
 */
export async function renderStageImage(
  stage: HTMLElement,
  opts: ExportOptions,
  onProgress: ExportProgress = () => {},
): Promise<Blob> {
  onProgress(0, 'Preparing images')
  await nextFrame()
  const clone = stage.cloneNode(true) as HTMLElement
  clone.querySelectorAll(`[${NO_EXPORT_ATTR}]`).forEach((n) => n.remove())
  clone.style.transform = `scale(${opts.scale})`
  clone.style.transformOrigin = 'top left'
  await inlineImages(clone, (f) => onProgress(f * 0.5, 'Preparing images'))
  onProgress(0.55, 'Rendering page')
  await nextFrame()

  const xml = new XMLSerializer().serializeToString(clone)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${opts.width}px;height:${opts.height}px;">
          <style><![CDATA[${collectCss()}]]></style>
          ${xml}
        </div>
      </foreignObject>
    </svg>`

  const image = await rasterize(svg, opts, onProgress)
  onProgress(1, 'Done')
  return image
}
