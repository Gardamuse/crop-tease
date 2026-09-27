// A minimal PDF writer: one full-page JPEG image per page. PDF readers
// decode JPEG natively (the DCTDecode filter), so the image bytes are
// embedded unchanged and no PDF library is needed.

export interface PdfPage {
  /** JPEG file bytes */
  jpeg: Uint8Array
  /** image size in pixels */
  width: number
  height: number
  /** pixels per inch; sets the page's physical size (72 pt per inch) */
  dpi: number
}

const encoder = new TextEncoder()

/** A PDF text string: UTF-16BE with a byte-order mark, as hex, so any characters work. */
function pdfText(text: string): string {
  let hex = 'FEFF'
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()
  return `<${hex}>`
}

export function buildPdf(pages: PdfPage[], title: string): Blob {
  const chunks: Uint8Array[] = []
  const offsets: number[] = [] // byte offset of each object, by object number - 1
  let length = 0
  const write = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data
    chunks.push(bytes)
    length += bytes.length
  }
  const object = (num: number, body: () => void) => {
    offsets[num - 1] = length
    write(`${num} 0 obj\n`)
    body()
    write('\nendobj\n')
  }

  // objects: 1 catalog, 2 page tree, 3 info, then 3 per page (page, image, content)
  const pageObj = (i: number) => 4 + i * 3
  // header; the second line's high bytes mark the file as binary
  write('%PDF-1.4\n%âãÏÓ\n')
  object(1, () => write('<< /Type /Catalog /Pages 2 0 R >>'))
  object(2, () =>
    write(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`),
  )
  object(3, () => write(`<< /Title ${pdfText(title)} /Producer (Crop Tease) >>`))
  pages.forEach((page, i) => {
    const w = ((page.width * 72) / page.dpi).toFixed(2)
    const h = ((page.height * 72) / page.dpi).toFixed(2)
    const [pageNum, imageNum, contentNum] = [pageObj(i), pageObj(i) + 1, pageObj(i) + 2]
    object(pageNum, () =>
      write(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
          `/Resources << /XObject << /Im0 ${imageNum} 0 R >> >> /Contents ${contentNum} 0 R >>`,
      ),
    )
    object(imageNum, () => {
      write(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      )
      write(page.jpeg)
      write('\nendstream')
    })
    // draw the image scaled to fill the page
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`
    object(contentNum, () => write(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`))
  })

  const xrefAt = length
  const count = offsets.length + 1
  write(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (const offset of offsets) write(`${String(offset).padStart(10, '0')} 00000 n \n`)
  write(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' })
}
