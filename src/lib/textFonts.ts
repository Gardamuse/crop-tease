import { del, get, set } from 'idb-keyval'
import { computed, reactive, watch } from 'vue'

import { TEXT_FONTS, type BuiltinFontId } from './constants'

/**
 * A text font: 'classic', a bundled font's id (see TEXT_FONTS), or
 * 'custom:<name>' for one the user added in this browser. Projects keep
 * the id even when the font isn't available, so it comes back once added.
 */
export type FontId = string

const CUSTOM_PREFIX = 'custom:'

// The classic look: a heavy sans, with serif italics in square captions
// (the same stacks as $ui-font and $caption-font in variables.scss).
const CLASSIC_SANS = `'Segoe UI', system-ui, -apple-system, sans-serif`
const CLASSIC_SERIF = `Georgia, 'Times New Roman', serif`

export const CLASSIC_VARS: Record<string, string> = {
  '--text-font': CLASSIC_SANS,
  '--text-weight': '800',
  '--caption-font': CLASSIC_SERIF,
  '--caption-weight': '700',
  '--caption-style': 'italic',
}

interface CustomFont {
  /** the font's full name, read from the file; also its id's suffix */
  name: string
  blob: Blob
  /** object URL of the blob, for @font-face */
  url: string
  /** the CSS family it's declared under */
  family: string
}

/** Fonts the user added, kept in this browser. `ready` once they're loaded from storage. */
export const customFonts = reactive({ list: [] as CustomFont[], ready: false })

let nextFamily = 1

export interface ResolvedFont {
  id: FontId
  label: string
  /** CSS family (quoted), or null for the classic look */
  family: string | null
  /** the file for @font-face and export embedding, or null for the classic look */
  url: string | null
  custom: boolean
  /** not bundled and not added in this browser */
  missing: boolean
}

function isBuiltin(id: FontId): id is BuiltinFontId {
  return Object.prototype.hasOwnProperty.call(TEXT_FONTS, id)
}

export function customFontId(name: string): FontId {
  return CUSTOM_PREFIX + name
}

/** A readable name for a font id that can't be resolved, e.g. "boldly-missy" -> "Boldly Missy". */
function unknownLabel(id: FontId): string {
  if (id.startsWith(CUSTOM_PREFIX)) return id.slice(CUSTOM_PREFIX.length)
  return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function resolveFont(id: FontId): ResolvedFont {
  if (isBuiltin(id)) {
    const { label, file } = TEXT_FONTS[id]
    return { id, label, family: file && `'${label}'`, url: file && import.meta.env.BASE_URL + file, custom: false, missing: false }
  }
  const custom = id.startsWith(CUSTOM_PREFIX) && customFonts.list.find((f) => customFontId(f.name) === id)
  if (custom) return { id, label: custom.name, family: custom.family, url: custom.url, custom: true, missing: false }
  return { id, label: unknownLabel(id), family: null, url: null, custom: id.startsWith(CUSTOM_PREFIX), missing: true }
}

/** Every font that can be picked: the bundled ones, then the user's. */
export const fontChoices = computed(() => [
  ...(Object.keys(TEXT_FONTS) as BuiltinFontId[]).map(resolveFont),
  ...customFonts.list.map((f) => resolveFont(customFontId(f.name))),
])

/** Whether a font is known to be unavailable (false while the user's fonts are still loading). */
export function isMissing(id: FontId): boolean {
  return customFonts.ready && resolveFont(id).missing
}

/**
 * CSS variables that set a text box's font (read by TextBox and PageThumb),
 * or null for a font that isn't available. Any font but the classic one is
 * used as-is for every style, in its own weight and without slanting.
 */
export function fontVars(id: FontId): Record<string, string> | null {
  const { family, missing } = resolveFont(id)
  if (missing) return null
  if (!family) return CLASSIC_VARS
  const font = `${family}, ${CLASSIC_SANS}`
  return {
    '--text-font': font,
    '--text-weight': 'normal',
    '--caption-font': font,
    '--caption-weight': 'normal',
    '--caption-style': 'normal',
  }
}

/** A font's CSS family, for showing its name in itself. */
export function previewFamily(id: FontId): string | undefined {
  const { family } = resolveFont(id)
  return family ? `${family}, ${CLASSIC_SANS}` : undefined
}

/** Loads the available fonts among `ids` and returns their files, for embedding into an export. */
export async function prepareFonts(ids: Iterable<FontId>): Promise<string[]> {
  const urls: string[] = []
  for (const id of new Set(ids)) {
    const { family, url } = resolveFont(id)
    if (!family || !url) continue
    await document.fonts.load(`20px ${family}`)
    urls.push(url)
  }
  return urls
}

// ---------------------------------------------------------------------------
// @font-face rules, for the bundled fonts and the user's

let faceStyle: HTMLStyleElement | undefined

function writeFontFaces(): void {
  const face = (family: string, url: string, format?: string) =>
    `@font-face { font-family: ${family}; src: url('${url}')${format ? ` format('${format}')` : ''}; font-display: block; }\n`
  let css = ''
  for (const font of fontChoices.value) {
    if (font.family && font.url && !font.custom) css += face(font.family, font.url, font.url.endsWith('.otf') ? 'opentype' : 'truetype')
  }
  for (const font of customFonts.list) css += face(font.family, font.url)
  faceStyle!.textContent = css
}

/** Declares every text font (the browser only downloads those in use) and loads the user's fonts. */
export function installTextFonts(): void {
  faceStyle = document.createElement('style')
  faceStyle.dataset.textFonts = ''
  document.head.appendChild(faceStyle)
  writeFontFaces()
  watch(() => customFonts.list.length, writeFontFaces)
  fontsLoaded = loadCustomFonts()
}

// ---------------------------------------------------------------------------
// The user's fonts, saved in this browser

const STORAGE_KEY = 'custom-fonts'

/** Settles once the user's fonts have been read from storage. */
let fontsLoaded: Promise<void> = Promise.resolve()

interface StoredFont {
  name: string
  blob: Blob
}

function makeCustomFont({ name, blob }: StoredFont): CustomFont {
  return { name, blob, url: URL.createObjectURL(blob), family: `'crop-tease-custom-${nextFamily++}'` }
}

async function loadCustomFonts(): Promise<void> {
  try {
    const stored = ((await get(STORAGE_KEY)) ?? []) as StoredFont[]
    customFonts.list = stored.map(makeCustomFont)
  } catch (err) {
    console.error('Loading your fonts failed', err)
  } finally {
    customFonts.ready = true
  }
}

async function saveCustomFonts(): Promise<void> {
  const stored: StoredFont[] = customFonts.list.map(({ name, blob }) => ({ name, blob }))
  if (stored.length) await set(STORAGE_KEY, stored)
  else await del(STORAGE_KEY)
}

/** Whether the browser can use this font data. */
async function isUsableFont(data: ArrayBuffer): Promise<boolean> {
  try {
    await new FontFace('crop-tease-font-check', data).load()
    return true
  } catch {
    return false
  }
}

/** Adds a font to this browser's fonts under `name`, replacing one of the same name. */
async function storeCustomFont(name: string, data: ArrayBuffer): Promise<void> {
  const old = customFonts.list.find((f) => f.name === name)
  if (old) URL.revokeObjectURL(old.url)
  const font = makeCustomFont({ name, blob: new Blob([data], { type: fontMime(data) }) })
  customFonts.list = [...customFonts.list.filter((f) => f.name !== name), font]
  writeFontFaces() // the list may be the same length when a font is replaced
  await saveCustomFonts()
}

/**
 * Adds a font file (TTF, OTF, WOFF or WOFF2) to this browser's fonts, named
 * by the full name inside it (else the file name); a font of the same name
 * is replaced. Returns its id; throws if the browser can't use the file.
 */
export async function addCustomFont(file: File): Promise<FontId> {
  const data = await file.arrayBuffer()
  if (!(await isUsableFont(data))) throw new Error(`"${file.name}" isn't a font this browser can use.`)
  const name = fontFullName(data) ?? file.name.replace(/\.[^.]+$/, '')
  await storeCustomFont(name, data)
  return customFontId(name)
}

/** One of the user's fonts, for saving into a project file; null if it isn't one or isn't available. */
export function customFontFile(id: FontId): { name: string; blob: Blob; extension: string } | null {
  const font = id.startsWith(CUSTOM_PREFIX) && customFonts.list.find((f) => customFontId(f.name) === id)
  return font ? { name: font.name, blob: font.blob, extension: FONT_EXTENSIONS[font.blob.type] ?? 'ttf' } : null
}

/**
 * Adds a font that came with a project file, unless this browser already
 * has one of that name (the user's own copy wins). Unusable data is skipped.
 */
export async function installProjectFont(name: string, data: ArrayBuffer): Promise<void> {
  if (!customFonts.ready) await fontsLoaded
  if (customFonts.list.some((f) => f.name === name)) return
  if (await isUsableFont(data)) await storeCustomFont(name, data)
  else console.warn(`Skipping the unusable font "${name}" in this project`)
}

const FONT_EXTENSIONS: Record<string, string> = {
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
}

/** The MIME type of font data, from its first bytes. */
function fontMime(data: ArrayBuffer): string {
  const tag = data.byteLength >= 4 ? new DataView(data).getUint32(0) : 0
  if (tag === 0x4f54544f /* OTTO */) return 'font/otf'
  if (tag === 0x774f4646 /* wOFF */) return 'font/woff'
  if (tag === 0x774f4632 /* wOF2 */) return 'font/woff2'
  return 'font/ttf'
}

/** Removes one of the user's fonts; text using it falls back to the default font. */
export async function removeCustomFont(name: string): Promise<void> {
  const font = customFonts.list.find((f) => f.name === name)
  if (!font) return
  customFonts.list = customFonts.list.filter((f) => f !== font)
  URL.revokeObjectURL(font.url)
  await saveCustomFonts()
}

/**
 * The full name (e.g. "Komika Hand Bold") from a TrueType/OpenType file's
 * name table, falling back to its family name; null if it can't be read
 * (including compressed WOFF/WOFF2 files).
 */
function fontFullName(data: ArrayBuffer): string | null {
  try {
    const view = new DataView(data)
    const version = view.getUint32(0)
    if (version !== 0x00010000 && version !== 0x4f54544f /* OTTO */ && version !== 0x74727565 /* true */) return null
    let table = -1
    for (let i = 0; i < view.getUint16(4); i++) {
      const at = 12 + i * 16
      if (view.getUint32(at) === 0x6e616d65 /* name */) table = view.getUint32(at + 8)
    }
    if (table < 0) return null
    const strings = table + view.getUint16(table + 4)
    const found = new Map<number, string>() // nameID -> text, Windows Unicode preferred
    for (let i = 0; i < view.getUint16(table + 2); i++) {
      const at = table + 6 + i * 12
      const [platform, , , nameId, length, offset] = [0, 2, 4, 6, 8, 10].map((o) => view.getUint16(at + o)) as number[]
      if ((nameId !== 1 && nameId !== 4) || (platform !== 3 && platform !== 1)) continue
      if (platform === 1 && found.has(nameId!)) continue
      const bytes = new Uint8Array(data, strings + offset!, length)
      const text = platform === 3 ? new TextDecoder('utf-16be').decode(bytes) : new TextDecoder('latin1').decode(bytes)
      if (text.trim()) found.set(nameId!, text.trim())
    }
    return found.get(4) ?? found.get(1) ?? null
  } catch {
    return null
  }
}
