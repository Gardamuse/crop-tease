import { EXPORT_H, EXPORT_SCALE, EXPORT_W } from './constants'

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
async function inlineImages(root: Element): Promise<void> {
  await Promise.all(
    Array.from(root.querySelectorAll('img')).map(async (img) => {
      const src = img.getAttribute('src')
      if (src && !src.startsWith('data:')) img.setAttribute('src', await toDataUrl(img.src))
    }),
  )
}

// Loaded as a data: URL rather than a blob: URL, since Chromium taints the
// canvas when a foreignObject SVG comes from a blob.
function rasterize(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = EXPORT_W
      canvas.height = EXPORT_H
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H)
      ctx.drawImage(img, 0, 0)
      try {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas produced no image'))))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Failed to rasterize the page'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

/**
 * Renders the stage to a PNG at export resolution and downloads it. The
 * clone is scaled up before rasterizing, so text and vector shapes are drawn
 * fresh at the higher size rather than stretched afterwards.
 */
export async function exportStagePng(stage: HTMLElement): Promise<void> {
  const clone = stage.cloneNode(true) as HTMLElement
  clone.querySelectorAll(`[${NO_EXPORT_ATTR}]`).forEach((n) => n.remove())
  clone.style.transform = `scale(${EXPORT_SCALE})`
  clone.style.transformOrigin = 'top left'
  await inlineImages(clone)

  const xml = new XMLSerializer().serializeToString(clone)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${EXPORT_W}" height="${EXPORT_H}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${EXPORT_W}px;height:${EXPORT_H}px;">
          <style><![CDATA[${collectCss()}]]></style>
          ${xml}
        </div>
      </foreignObject>
    </svg>`

  const png = await rasterize(svg)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(png)
  a.download = `comic-page-${EXPORT_W}x${EXPORT_H}.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
