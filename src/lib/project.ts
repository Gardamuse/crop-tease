import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { del, get, set, update } from 'idb-keyval'
import { nextTick, reactive, ref, toRaw, watch } from 'vue'
import { z } from 'zod'

import {
  DEFAULT_TEXT_SIZE,
  MAX_BORDER_WIDTH,
  MAX_DIVIDER_WIDTH,
  MAX_OUTLINE_WIDTH,
  MAX_PAGE_SIDE,
  MIN_OUTLINE_WIDTH,
  MIN_PAGE_SIDE,
  TAIL_POSITIONS,
  type TailPosition,
} from './constants'
import type { ImageFrame } from './imageFrame'
import {
  addImage,
  clearImages,
  extensionFor,
  getImage,
  pruneStoredImages,
  storedImageKey,
  typeForExtension,
} from './images'
import { resetHistory } from './history'
import {
  DEFAULT_OVERLAY,
  MAX_BALANCE,
  MAX_BLUR,
  MAX_OVERLAY_ANGLE,
  MAX_SPLASH_WIDTH,
  MIN_SPLASH_WIDTH,
  NONE,
} from './photoEffects'
import type { Region } from './layout'
import { clamp, turnDegrees } from './math'
import { store, syncCounters, usedFonts, type ComicElement, type TextElement } from './store'
import { customFontFile, installProjectFont } from './textFonts'
import { captureThumbnail, clearThumbnailCache } from './thumbnail'

// ---------------------------------------------------------------------------
// Save format
//
// A project is saved as a JSON document plus its images. The same document
// is used for the browser autosave (IndexedDB) and as project.json inside a
// saved .ct file (a zip archive), next to images/<id>.<ext> and the user's
// fonts it uses, fonts/<n>.<ext>.
//
// VERSIONING: every document carries `version`. When the format changes:
//   1. bump PROJECT_VERSION,
//   2. add MIGRATIONS[old] that turns an old-version document into the new shape,
//   3. update ProjectSchema (and serialize/apply) to the new shape.
// Old documents are upgraded one version at a time on load, so every file
// ever saved stays openable.
// ---------------------------------------------------------------------------

export const PROJECT_FORMAT = 'crop-tease'

/**
 * Saved project files use their own extension. Inside they're ordinary zip
 * archives (rename to .zip to look inside).
 */
export const PROJECT_EXTENSION = 'ct'
export const PROJECT_MIME = 'application/x-crop-tease'
export const PROJECT_VERSION = 1

/** Upgrades a document from version N (the key) to N+1. */
type Migration = (doc: Record<string, unknown>) => Record<string, unknown>
const MIGRATIONS: Record<number, Migration> = {}

const FrameSchema = z.object({
  imageId: z.string(),
  natW: z.number().positive(),
  natH: z.number().positive(),
  baseScale: z.number().positive(),
  scale: z.number().positive(),
  tx: z.number(),
  ty: z.number(),
  mirror: z.boolean().default(false), // added later
  rotation: z.number().transform(turnDegrees).default(0), // added later
})
type SavedFrame = z.infer<typeof FrameSchema>

const AnchorSchema = z.object({
  host: z.union([z.literal('border'), z.number().int()]),
  t: z.number(),
})

// a color over a photo (added later)
const OverlaySchema = z.object({
  from: z.enum(['top', 'bottom']),
  angle: z.number().transform((a) => clamp(a, -MAX_OVERLAY_ANGLE, MAX_OVERLAY_ANGLE)),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  size: z.number().min(0).max(100).default(DEFAULT_OVERLAY.size),
  strength: z.number().min(0).max(100).default(DEFAULT_OVERLAY.strength),
})

const Level = z.number().int().min(0).max(255)
const Balance = z.number().transform((v) => Math.round(clamp(v, -MAX_BALANCE, MAX_BALANCE)))
const BalanceRange = z.tuple([Balance, Balance, Balance])

// a photo's effects (added later, so all optional)
const LevelsSchema = z.object({ inLow: Level, inHigh: Level, outLow: Level, outHigh: Level })
const ColorBalanceSchema = z.object({
  shadows: BalanceRange,
  midtones: BalanceRange,
  highlights: BalanceRange,
  preserveLuminosity: z.boolean(),
})

const ColorSplashSchema = z.object({
  hue: z.number().transform((h) => ((Math.round(h) % 360) + 360) % 360),
  width: z.number().transform((w) => clamp(w, MIN_SPLASH_WIDTH, MAX_SPLASH_WIDTH)),
  softness: z.number().min(0).max(100),
  desaturate: z.number().min(0).max(100),
})

const PhotoEffectsSchema = {
  overlay: OverlaySchema.nullable().default(null),
  blur: z.number().min(0).max(MAX_BLUR).default(0),
  // NONE (a photo's switched off) added later
  levels: z.union([LevelsSchema, z.literal(NONE)]).nullable().default(null),
  colorBalance: z.union([ColorBalanceSchema, z.literal(NONE)]).nullable().default(null),
  colorSplash: z.union([ColorSplashSchema, z.literal(NONE)]).nullable().default(null), // added later
}

const LeafSchema = z.object({
  kind: z.literal('leaf'),
  id: z.number().int(),
  frame: FrameSchema.nullable(),
  // added later
  fill: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().default(null),
  ...PhotoEffectsSchema,
})

type SavedRegion =
  | z.infer<typeof LeafSchema>
  | {
      kind: 'split'
      bar: { id: number; a: z.infer<typeof AnchorSchema>; b: z.infer<typeof AnchorSchema>; width: number | null }
      front: SavedRegion
      back: SavedRegion
    }

const RegionSchema: z.ZodType<SavedRegion> = z.lazy(() =>
  z.union([
    LeafSchema,
    z.object({
      kind: z.literal('split'),
      bar: z.object({
        id: z.number().int(),
        a: AnchorSchema,
        b: AnchorSchema,
        width: z.number().min(0).max(MAX_DIVIDER_WIDTH).nullable().default(null), // added later
      }),
      front: RegionSchema,
      back: RegionSchema,
    }),
  ]),
)

const ElementBase = {
  id: z.number().int(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
}

const TextSchema = z.object({
  ...ElementBase,
  kind: z.literal('text'),
  style: z.enum(['none', 'speech', 'square']),
  tail: z.enum(TAIL_POSITIONS as [TailPosition, ...TailPosition[]]),
  w: z.number().positive(),
  h: z.number().positive(),
  rot: z.number(),
  text: z.string(),
  // null follows the project's size (textSize); older projects always gave a number
  fontSize: z.number().positive().nullable(),
  color: z.string(),
  outline: z.boolean().default(true), // added later; older projects had outlines on
  // added later; kept even if that font isn't available here (it's then drawn in the default)
  font: z.string().nullable().default(null),
})

const ElementSchema = z.discriminatedUnion('kind', [
  z.object({
    ...ElementBase,
    kind: z.literal('circle'),
    d: z.number().positive(),
    frame: FrameSchema.nullable(),
    ...PhotoEffectsSchema,
  }),
  TextSchema,
])

const ProjectSchema = z.object({
  format: z.literal(PROJECT_FORMAT),
  version: z.literal(PROJECT_VERSION),
  name: z.string(),
  pageSize: z.object({
    width: z.number().int().min(MIN_PAGE_SIDE).max(MAX_PAGE_SIDE),
    height: z.number().int().min(MIN_PAGE_SIDE).max(MAX_PAGE_SIDE),
  }),
  exportFormat: z.enum(['webp', 'jpg']),
  border: z.object({
    width: z.number().min(0).max(MAX_BORDER_WIDTH),
    dividerWidth: z.number().min(0).max(MAX_DIVIDER_WIDTH),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    outlineColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
    outlineWidth: z.number().min(MIN_OUTLINE_WIDTH).max(MAX_OUTLINE_WIDTH),
  }),
  closeUps: z.object({
    shadow: z.boolean(),
    withinBorder: z.boolean(),
  }),
  pages: z
    .array(
      z.object({
        id: z.number().int(),
        layout: RegionSchema,
        elements: z.array(ElementSchema),
        /** whether the page border is drawn on this page (added later) */
        border: z.boolean().default(true),
      }),
    )
    .min(1),
  /** the page that was open when saved */
  currentPage: z.number().int().min(0),
  /** text on every page with {n} / {total} filled in, or null */
  pageNumber: TextSchema.nullable(),
  // added later; kept even if that font isn't available here (it's then drawn in the default)
  textFont: z.string().default('classic'),
  /**
   * the size of text without its own, in stage units (added later; missing
   * in older projects, whose texts at the old default size then follow it)
   */
  textSize: z.number().positive().optional(),
  /** levels, color balance and color splash for every photo without its own (added later) */
  photoFilters: z
    .object({
      levels: LevelsSchema.nullable(),
      colorBalance: ColorBalanceSchema.nullable(),
      colorSplash: ColorSplashSchema.nullable().default(null), // added later
    })
    .default({ levels: null, colorBalance: null, colorSplash: null }),
  /** every image the project uses, with its MIME type */
  images: z.array(z.object({ id: z.string(), type: z.string() })),
  /**
   * the user's own fonts the project uses, packed in a .ct file as
   * fonts/<file> so they can be added when it's opened elsewhere (added
   * later; the autosave leaves this empty, as the browser has the fonts)
   */
  fonts: z.array(z.object({ name: z.string(), file: z.string() })).default([]),
})

export type ProjectDoc = z.infer<typeof ProjectSchema>

export class ProjectFileError extends Error {}

/** Upgrades any saved document to the current version and validates it. */
export function upgradeProject(raw: unknown): ProjectDoc {
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== PROJECT_FORMAT) {
    throw new ProjectFileError("This isn't a Crop Tease project.")
  }
  let doc = raw as Record<string, unknown>
  const version = doc.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ProjectFileError('This project file has no valid version number.')
  }
  if (version > PROJECT_VERSION) {
    throw new ProjectFileError(
      `This project was saved by a newer version of Crop Tease (format v${version}; this app reads up to v${PROJECT_VERSION}).`,
    )
  }
  for (let v = version; v < PROJECT_VERSION; v++) {
    const migrate = MIGRATIONS[v]
    if (!migrate) throw new ProjectFileError(`Don't know how to upgrade project format v${v}.`)
    doc = migrate(doc)
  }
  const parsed = ProjectSchema.safeParse(doc)
  if (!parsed.success) {
    throw new ProjectFileError(`This project file is damaged: ${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

// ---------------------------------------------------------------------------
// Converting between the store and a document
// ---------------------------------------------------------------------------

function saveFrame(f: ImageFrame | null): SavedFrame | null {
  return f && { imageId: f.imageId, natW: f.natW, natH: f.natH, baseScale: f.baseScale, scale: f.scale, tx: f.tx, ty: f.ty, mirror: f.mirror, rotation: f.rotation }
}

function saveRegion(node: Region): SavedRegion {
  if (node.kind === 'leaf') {
    const { id, frame, fill, overlay, blur, levels, colorBalance, colorSplash } = toRaw(node)
    return { kind: 'leaf', id, frame: saveFrame(frame), fill, overlay, blur, levels, colorBalance, colorSplash }
  }
  return {
    kind: 'split',
    bar: { id: node.bar.id, a: { ...node.bar.a }, b: { ...node.bar.b }, width: node.bar.width },
    front: saveRegion(node.front),
    back: saveRegion(node.back),
  }
}

type SavedPage = ProjectDoc['pages'][number]

function usedImageIds(doc: Pick<ProjectDoc, 'pages'>): Set<string> {
  const ids = new Set<string>()
  const walk = (node: SavedRegion) => {
    if (node.kind === 'leaf') {
      if (node.frame) ids.add(node.frame.imageId)
    } else {
      walk(node.front)
      walk(node.back)
    }
  }
  for (const page of doc.pages) {
    walk(page.layout)
    for (const el of page.elements) if (el.kind === 'circle' && el.frame) ids.add(el.frame.imageId)
  }
  return ids
}

export function serializeProject(): ProjectDoc {
  const pages = store.pages.map(
    (page): SavedPage => ({
      id: page.id,
      layout: saveRegion(page.layout),
      elements: page.elements.map((el): SavedPage['elements'][number] =>
        el.kind === 'circle' ? { ...toRaw(el), frame: saveFrame(el.frame) } : { ...toRaw(el) },
      ),
      border: page.border,
    }),
  )
  const images = [...usedImageIds({ pages })].map((id) => ({
    id,
    type: getImage(id)?.blob.type || 'application/octet-stream',
  }))
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    name: store.name,
    pageSize: { ...store.pageSize },
    exportFormat: store.exportFormat,
    border: { ...store.border },
    closeUps: { ...store.closeUps },
    textFont: store.textFont,
    textSize: store.textSize,
    photoFilters: toRaw(store.photoFilters),
    pages,
    currentPage: store.pageIndex,
    pageNumber: store.pageNumber && { ...toRaw(store.pageNumber) },
    images,
    fonts: [],
  }
}

/**
 * Loads a validated document into the store. Its images must already be
 * added (see addImage); a reference to a missing image leaves a placeholder.
 */
function applyProject(doc: ProjectDoc): void {
  const loadFrame = (f: SavedFrame | null): ImageFrame | null => {
    const image = f && getImage(f.imageId)
    return image ? { ...f, src: image.url } : null
  }
  const loadRegion = (node: SavedRegion): Region =>
    node.kind === 'leaf'
      ? { ...node, frame: loadFrame(node.frame) }
      : { kind: 'split', bar: node.bar, front: loadRegion(node.front), back: loadRegion(node.back) }

  store.name = doc.name
  store.pageSize = { ...doc.pageSize }
  store.exportFormat = doc.exportFormat
  store.border = { ...doc.border }
  store.closeUps = { ...doc.closeUps }
  store.textFont = doc.textFont
  store.textSize = doc.textSize ?? DEFAULT_TEXT_SIZE
  Object.assign(store.photoFilters, doc.photoFilters) // the same object: the sidebar's controls hold it
  // before the project had a text size, a text at the default size hadn't been resized
  const loadText = (el: z.infer<typeof TextSchema>): TextElement =>
    doc.textSize === undefined && el.fontSize === DEFAULT_TEXT_SIZE ? { ...el, fontSize: null } : { ...el }
  store.pages = doc.pages.map((page) => ({
    id: page.id,
    layout: loadRegion(page.layout),
    elements: page.elements.map(
      (el): ComicElement => (el.kind === 'circle' ? { ...el, frame: loadFrame(el.frame) } : loadText(el)),
    ),
    border: page.border,
  }))
  store.pageIndex = Math.min(doc.currentPage, doc.pages.length - 1)
  store.pageNumber = doc.pageNumber && loadText(doc.pageNumber)
  store.selectedId = null
  store.selectedBarId = null
  store.splitMode = false
  store.generation++
  syncCounters()
}

// ---------------------------------------------------------------------------
// Projects kept in the browser
//
// Every project the user works on is kept in IndexedDB: its document under
// project:<id> and a picture of its first page under thumb:<id>, listed in
// PROJECTS_KEY (newest first) for the Recent projects view. The open one is
// saved shortly after every change. Images are shared: each is stored once
// (see images.ts) and deleted once no project uses it.
// ---------------------------------------------------------------------------

/** A project in the Recent projects list. */
export interface ProjectEntry {
  id: string
  name: string
  /** when it was last changed (ms since 1970) */
  updated: number
  pages: number
  /** the images it uses, so unused ones can be deleted without reading every project */
  images: string[]
  /** identifies its content, so opening a file of an identical project goes to that one (see fingerprint) */
  fingerprint: string
}

const PROJECTS_KEY = 'projects'
const CURRENT_KEY = 'current-project'
/** where the single autosaved project lived before there were several */
const LEGACY_KEY = 'project'
const AUTOSAVE_DELAY = 600
/** how long after a change the first page's picture is redrawn */
const THUMB_DELAY = 2000

const docKey = (id: string) => `project:${id}`
const thumbKey = (id: string) => `thumb:${id}`

/** the open project's id */
export const currentProjectId = ref('')
/** the projects in this browser, newest first; filled by loadRecentProjects */
export const recentProjects = ref<ProjectEntry[]>([])
/** object URLs of their pictures, by project id */
export const projectThumbs = reactive(new Map<string, string>())

let suspendAutosave = false
let saveTimer: ReturnType<typeof setTimeout> | undefined
let thumbTimer: ReturnType<typeof setTimeout> | undefined

function newProjectId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// JSON with every object's keys sorted, so equal documents give equal text
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  )
}

// cyrb53, a quick 53-bit string hash
function hashText(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * Identifies a project's content: equal for the same project whether it was
 * just saved to a file, opened from one or kept here. Leaves out the page it
 * was left on and the packed fonts, which only a .ct file carries.
 */
function fingerprint(doc: ProjectDoc): string {
  // through the schema, so both sides have the same defaults and no extra fields
  const parsed = ProjectSchema.safeParse(doc)
  const { currentPage: _page, fonts: _fonts, ...content } = parsed.success ? parsed.data : doc
  return hashText(stableJson(content))
}

function entryFor(id: string, doc: ProjectDoc): ProjectEntry {
  return {
    id,
    name: doc.name,
    updated: Date.now(),
    pages: doc.pages.length,
    images: doc.images.map((i) => i.id),
    fingerprint: fingerprint(doc),
  }
}

async function readEntries(): Promise<ProjectEntry[]> {
  return (await get<ProjectEntry[]>(PROJECTS_KEY)) ?? []
}

/** Writes a project and puts it at the top of the list. */
async function storeProject(id: string, doc: ProjectDoc): Promise<void> {
  const entry = entryFor(id, doc)
  await set(docKey(id), doc)
  await update<ProjectEntry[]>(PROJECTS_KEY, (list = []) => [entry, ...list.filter((e) => e.id !== id)])
  const i = recentProjects.value.findIndex((e) => e.id === id)
  if (i >= 0) recentProjects.value.splice(i, 1)
  recentProjects.value.unshift(entry)
}

/** Saves the open project now, with its picture if `withThumb`. */
async function saveCurrent(withThumb = false): Promise<void> {
  clearTimeout(saveTimer)
  saveTimer = undefined
  await storeProject(currentProjectId.value, serializeProject())
  if (withThumb) await saveThumbnail()
  else scheduleThumbnail()
}

function scheduleThumbnail(): void {
  clearTimeout(thumbTimer)
  thumbTimer = setTimeout(() => void saveThumbnail(), THUMB_DELAY)
}

async function saveThumbnail(): Promise<void> {
  clearTimeout(thumbTimer)
  thumbTimer = undefined
  const id = currentProjectId.value
  try {
    const blob = await captureThumbnail()
    if (!blob || id !== currentProjectId.value) return
    await set(thumbKey(id), blob)
    showThumb(id, blob)
  } catch (err) {
    console.error('Could not draw the project picture', err) // the list shows a blank instead
  }
}

function showThumb(id: string, blob: Blob | undefined): void {
  const old = projectThumbs.get(id)
  if (old) URL.revokeObjectURL(old)
  if (blob) projectThumbs.set(id, URL.createObjectURL(blob))
  else projectThumbs.delete(id)
}

/** Saves whatever is waiting to be saved (the open project and its picture) straight away. */
export async function flushProject(): Promise<void> {
  if (saveTimer !== undefined) await saveCurrent(true)
  else if (thumbTimer !== undefined) await saveThumbnail()
}

/** Reads the list of projects and their pictures for the Recent projects view. */
export async function loadRecentProjects(): Promise<void> {
  const entries = await readEntries()
  recentProjects.value = entries
  for (const { id } of entries) {
    if (!projectThumbs.has(id)) showThumb(id, await get<Blob>(thumbKey(id)))
  }
}

/** Deletes stored images no project uses any more. */
async function pruneImages(): Promise<void> {
  const used = new Set((await readEntries()).flatMap((e) => e.images))
  for (const id of usedImageIds(serializeProject())) used.add(id)
  await pruneStoredImages(used)
}

/** Moves the single project saved before there were several into the list. */
async function migrateLegacyProject(): Promise<void> {
  const raw = await get(LEGACY_KEY)
  if (raw === undefined) return
  try {
    const id = newProjectId()
    await storeProject(id, upgradeProject(raw))
    await set(CURRENT_KEY, id)
  } catch (err) {
    console.error('Could not move the autosaved project into the list', err)
  }
  await del(LEGACY_KEY)
}

/** Reads a stored project and makes it the open one. */
async function loadStoredProject(id: string): Promise<void> {
  const raw = await get(docKey(id))
  if (raw === undefined) throw new ProjectFileError("This project isn't in the browser any more.")
  const doc = upgradeProject(raw)
  clearImages()
  for (const { id: imageId } of doc.images) {
    const blob = await get<Blob>(storedImageKey(imageId))
    if (blob) await addImage(blob, imageId, false)
  }
  applyProject(doc)
  currentProjectId.value = id
}

/**
 * Opens the project that was open last. Returns false when there is none (or
 * it can't be read); the caller then sets up a starter page, which becomes a
 * new project.
 */
export async function restoreLastProject(): Promise<boolean> {
  try {
    await migrateLegacyProject()
    const id = await get<string>(CURRENT_KEY)
    if (id !== undefined) {
      await loadStoredProject(id)
      await pruneImages()
      scheduleThumbnail() // one drawn by an older version, or none
      return true
    }
  } catch (err) {
    console.error('Could not restore the last project', err)
  }
  currentProjectId.value = newProjectId()
  await set(CURRENT_KEY, currentProjectId.value)
  return false
}

/** Saves the open project straight away, e.g. a new starter page nobody has changed yet. */
export async function saveOpenProject(): Promise<void> {
  await nextTick() // the page bar draws the first page for its picture
  await saveCurrent(true)
}

/** Saves the project to the browser shortly after every change. */
export function startAutosave(onStatus: (status: 'saving' | 'saved' | 'error') => void): void {
  watch(
    () => [store.name, store.pageSize, store.exportFormat, store.border, store.closeUps, store.textFont, store.textSize, store.photoFilters, store.pages, store.pageIndex, store.pageNumber],
    () => {
      if (suspendAutosave) return
      onStatus('saving')
      clearTimeout(saveTimer)
      saveTimer = setTimeout(async () => {
        try {
          await saveCurrent()
          onStatus('saved')
        } catch (err) {
          console.error('Autosave failed', err)
          onStatus('error')
        }
      }, AUTOSAVE_DELAY)
    },
    { deep: true },
  )
  // leaving the tab: save what's pending while there's still time
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushProject()
  })
}

/**
 * Makes a different project the open one: saves the one open now, runs
 * `load` (which fills the store and sets currentProjectId), then saves the
 * new one straight away.
 */
async function switchProject(load: () => Promise<void>): Promise<void> {
  await flushProject()
  suspendAutosave = true
  try {
    await load()
    resetHistory() // undo can't reach back into the previous project
    clearThumbnailCache()
    await set(CURRENT_KEY, currentProjectId.value)
    await nextTick() // let the page bar draw the new first page for its picture
    await saveCurrent(true)
    await pruneImages()
  } finally {
    suspendAutosave = false
  }
}

/** Starts a new project, keeping the open one in the list. `reset` empties the store. */
export async function newProject(reset: () => void): Promise<void> {
  await switchProject(async () => {
    clearImages()
    reset()
    currentProjectId.value = newProjectId()
  })
}

/** Opens a project from the Recent projects list. */
export async function openStoredProject(id: string): Promise<void> {
  if (id === currentProjectId.value) return
  await switchProject(() => loadStoredProject(id))
}

/**
 * Deletes a project from the browser. Deleting the open one opens the next
 * most recent instead, or a new project made with `reset` if it was the last.
 */
export async function deleteStoredProject(id: string, reset: () => void): Promise<void> {
  if (id === currentProjectId.value) {
    clearTimeout(saveTimer) // its pending changes go with it
    saveTimer = undefined
    clearTimeout(thumbTimer)
    thumbTimer = undefined
    const next = (await readEntries()).find((e) => e.id !== id)
    // still listed while switching, so switching doesn't save it again
    if (next) await switchProject(() => loadStoredProject(next.id))
    else await newProject(reset)
  }
  await del(docKey(id))
  await del(thumbKey(id))
  await update<ProjectEntry[]>(PROJECTS_KEY, (list = []) => list.filter((e) => e.id !== id))
  recentProjects.value = recentProjects.value.filter((e) => e.id !== id)
  showThumb(id, undefined)
  await pruneImages()
}

// ---------------------------------------------------------------------------
// Project files (.ct, a zip archive inside)
// ---------------------------------------------------------------------------

const PROJECT_JSON = 'project.json'

function imagePath(id: string, type: string): string {
  return `images/${id}.${extensionFor(type)}`
}

/** Packs the project into a .ct file: a zip of project.json, images/<id>.<ext> and fonts/<n>.<ext>. */
export async function buildProjectZip(onProgress?: (fraction: number) => void): Promise<Blob> {
  const doc = serializeProject()
  const files: Zippable = {}
  for (const id of usedFonts.value) {
    const font = customFontFile(id)
    if (!font) continue // bundled, classic, or missing here
    const file = `fonts/${doc.fonts.length + 1}.${font.extension}`
    files[file] = [new Uint8Array(await font.blob.arrayBuffer()), { level: 6 }]
    doc.fonts.push({ name: font.name, file })
  }
  files[PROJECT_JSON] = [strToU8(JSON.stringify(doc, null, 2)), { level: 6 }]
  for (const [i, { id, type }] of doc.images.entries()) {
    const image = getImage(id)
    // images are already compressed, so store them as-is
    if (image) files[imagePath(id, type)] = [new Uint8Array(await image.blob.arrayBuffer()), { level: 0 }]
    onProgress?.((i + 1) / (doc.images.length + 1))
  }
  const zipped = zipSync(files)
  onProgress?.(1)
  return new Blob([zipped as BlobPart], { type: 'application/zip' })
}

/**
 * Opens a saved .ct file, upgrading it if it's from an older version, and
 * makes it the open project: a new one in the list, or the listed project
 * with identical content if there is one.
 */
export async function openProjectZip(file: Blob): Promise<void> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new ProjectFileError(`This isn't a Crop Tease project file (.${PROJECT_EXTENSION}).`)
  }
  const json = entries[PROJECT_JSON]
  if (!json) throw new ProjectFileError(`This file has no ${PROJECT_JSON}, so it isn't a Crop Tease project.`)
  let raw: unknown
  try {
    raw = JSON.parse(strFromU8(json))
  } catch {
    throw new ProjectFileError(`${PROJECT_JSON} isn't valid JSON.`)
  }
  const doc = upgradeProject(raw)

  // find each image by id, whatever extension it was saved with
  const byId = new Map<string, { data: Uint8Array; ext: string }>()
  for (const [path, data] of Object.entries(entries)) {
    const m = /^images\/([^/]+)\.([^./]+)$/.exec(path)
    if (m) byId.set(m[1]!, { data, ext: m[2]! })
  }

  // the user's fonts that came with it, unless this browser has them already
  for (const { name, file } of doc.fonts) {
    const data = entries[file]
    if (data) await installProjectFont(name, data.slice().buffer)
  }

  const fp = fingerprint(doc)
  const same = (await readEntries()).find((e) => e.fingerprint === fp)
  if (same) {
    await openStoredProject(same.id)
    return
  }

  await switchProject(async () => {
    clearImages()
    for (const { id, type } of doc.images) {
      const found = byId.get(id)
      if (!found) continue // its frames fall back to placeholders
      const blobType = type.startsWith('image/') ? type : typeForExtension(found.ext)
      await addImage(new Blob([found.data as BlobPart], { type: blobType }), id)
    }
    applyProject(doc)
    currentProjectId.value = newProjectId()
  })
}
