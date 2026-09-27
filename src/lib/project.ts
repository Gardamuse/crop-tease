import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { get, set } from 'idb-keyval'
import { toRaw, watch } from 'vue'
import { z } from 'zod'

import { MAX_BORDER_WIDTH, MAX_PAGE_SIDE, MIN_PAGE_SIDE } from './constants'
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
import type { Region } from './layout'
import { store, syncCounters, type ComicElement } from './store'

// ---------------------------------------------------------------------------
// Save format
//
// A project is saved as a JSON document plus its images. The same document
// is used for the browser autosave (IndexedDB) and as project.json inside a
// saved zip, next to images/<id>.<ext>.
//
// VERSIONING: every document carries `version`. When the format changes:
//   1. bump PROJECT_VERSION,
//   2. add MIGRATIONS[old] that turns an old-version document into the new shape,
//   3. update ProjectSchema (and serialize/apply) to the new shape.
// Old documents are upgraded one version at a time on load, so every file
// ever saved stays openable.
// ---------------------------------------------------------------------------

export const PROJECT_FORMAT = 'comic-maker'
export const PROJECT_VERSION = 3

/** Upgrades a document from version N (the key) to N+1. */
type Migration = (doc: Record<string, unknown>) => Record<string, unknown>
const MIGRATIONS: Record<number, Migration> = {
  // v2 added the page border. v1 drew bars and close-up rings in the dark
  // ink color, so keep that look; per-close-up ring colors were dropped in
  // favor of the shared border color.
  1: (doc) => ({
    ...doc,
    version: 2,
    border: { width: 0, color: '#241b30' },
    elements: Array.isArray(doc.elements)
      ? doc.elements.map((el: Record<string, unknown>) => {
          const { ring: _ring, ...rest } = el
          return rest
        })
      : doc.elements,
  }),
  // v3 added the border outline
  2: (doc) => ({
    ...doc,
    version: 3,
    border: { ...(doc.border as object), outline: 'none' },
  }),
}

const FrameSchema = z.object({
  imageId: z.string(),
  natW: z.number().positive(),
  natH: z.number().positive(),
  baseScale: z.number().positive(),
  scale: z.number().positive(),
  tx: z.number(),
  ty: z.number(),
})
type SavedFrame = z.infer<typeof FrameSchema>

const AnchorSchema = z.object({
  host: z.union([z.literal('border'), z.number().int()]),
  t: z.number(),
})

const LeafSchema = z.object({
  kind: z.literal('leaf'),
  id: z.number().int(),
  frame: FrameSchema.nullable(),
})

type SavedRegion =
  | z.infer<typeof LeafSchema>
  | {
      kind: 'split'
      bar: { id: number; a: z.infer<typeof AnchorSchema>; b: z.infer<typeof AnchorSchema> }
      front: SavedRegion
      back: SavedRegion
    }

const RegionSchema: z.ZodType<SavedRegion> = z.lazy(() =>
  z.union([
    LeafSchema,
    z.object({
      kind: z.literal('split'),
      bar: z.object({ id: z.number().int(), a: AnchorSchema, b: AnchorSchema }),
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

const ElementSchema = z.discriminatedUnion('kind', [
  z.object({
    ...ElementBase,
    kind: z.literal('circle'),
    d: z.number().positive(),
    frame: FrameSchema.nullable(),
  }),
  z.object({
    ...ElementBase,
    kind: z.enum(['caption', 'bubble']),
    w: z.number().positive(),
    h: z.number().positive(),
    rot: z.number(),
    text: z.string(),
    fontSize: z.number().positive(),
    color: z.string(),
  }),
])

const ProjectSchema = z.object({
  format: z.literal(PROJECT_FORMAT),
  version: z.literal(PROJECT_VERSION),
  page: z.object({
    width: z.number().int().min(MIN_PAGE_SIDE).max(MAX_PAGE_SIDE),
    height: z.number().int().min(MIN_PAGE_SIDE).max(MAX_PAGE_SIDE),
  }),
  exportFormat: z.enum(['webp', 'jpg']),
  border: z.object({
    width: z.number().min(0).max(MAX_BORDER_WIDTH),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    outline: z.enum(['none', 'black', 'white']),
  }),
  layout: RegionSchema,
  elements: z.array(ElementSchema),
  /** every image the project uses, with its MIME type */
  images: z.array(z.object({ id: z.string(), type: z.string() })),
})

export type ProjectDoc = z.infer<typeof ProjectSchema>

export class ProjectFileError extends Error {}

/** Upgrades any saved document to the current version and validates it. */
export function upgradeProject(raw: unknown): ProjectDoc {
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== PROJECT_FORMAT) {
    throw new ProjectFileError("This isn't a Comic Maker project.")
  }
  let doc = raw as Record<string, unknown>
  const version = doc.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ProjectFileError('This project file has no valid version number.')
  }
  if (version > PROJECT_VERSION) {
    throw new ProjectFileError(
      `This project was saved by a newer version of Comic Maker (format v${version}; this app reads up to v${PROJECT_VERSION}).`,
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
  return f && { imageId: f.imageId, natW: f.natW, natH: f.natH, baseScale: f.baseScale, scale: f.scale, tx: f.tx, ty: f.ty }
}

function saveRegion(node: Region): SavedRegion {
  if (node.kind === 'leaf') return { kind: 'leaf', id: node.id, frame: saveFrame(node.frame) }
  return {
    kind: 'split',
    bar: { id: node.bar.id, a: { ...node.bar.a }, b: { ...node.bar.b } },
    front: saveRegion(node.front),
    back: saveRegion(node.back),
  }
}

function usedImageIds(doc: Pick<ProjectDoc, 'layout' | 'elements'>): Set<string> {
  const ids = new Set<string>()
  const walk = (node: SavedRegion) => {
    if (node.kind === 'leaf') {
      if (node.frame) ids.add(node.frame.imageId)
    } else {
      walk(node.front)
      walk(node.back)
    }
  }
  walk(doc.layout)
  for (const el of doc.elements) if (el.kind === 'circle' && el.frame) ids.add(el.frame.imageId)
  return ids
}

export function serializeProject(): ProjectDoc {
  const layout = saveRegion(store.layout)
  const elements = store.elements.map((el): ProjectDoc['elements'][number] =>
    el.kind === 'circle' ? { ...toRaw(el), frame: saveFrame(el.frame) } : { ...toRaw(el) },
  )
  const images = [...usedImageIds({ layout, elements })].map((id) => ({
    id,
    type: getImage(id)?.blob.type || 'application/octet-stream',
  }))
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    page: { ...store.page },
    exportFormat: store.exportFormat,
    border: { ...store.border },
    layout,
    elements,
    images,
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
      ? { kind: 'leaf', id: node.id, frame: loadFrame(node.frame) }
      : { kind: 'split', bar: node.bar, front: loadRegion(node.front), back: loadRegion(node.back) }

  store.page = { ...doc.page }
  store.exportFormat = doc.exportFormat
  store.border = { ...doc.border }
  store.layout = loadRegion(doc.layout)
  store.elements = doc.elements.map(
    (el): ComicElement => (el.kind === 'circle' ? { ...el, frame: loadFrame(el.frame) } : { ...el }),
  )
  store.selectedId = null
  store.selectedBarId = null
  store.splitMode = false
  store.generation++
  syncCounters()
}

// ---------------------------------------------------------------------------
// Browser autosave
// ---------------------------------------------------------------------------

const AUTOSAVE_KEY = 'project'
const AUTOSAVE_DELAY = 600

let suspendAutosave = false

async function writeAutosave(): Promise<void> {
  await set(AUTOSAVE_KEY, serializeProject())
}

/**
 * Restores the last autosaved project. Returns false when there is none (or
 * it can't be read), so the caller can set up a starter page instead.
 */
export async function restoreAutosave(): Promise<boolean> {
  try {
    const raw = await get(AUTOSAVE_KEY)
    if (raw === undefined) return false
    const doc = upgradeProject(raw)
    for (const { id } of doc.images) {
      const blob = await get<Blob>(storedImageKey(id))
      if (blob) await addImage(blob, id, false)
    }
    applyProject(doc)
    await pruneStoredImages(usedImageIds(doc))
    return true
  } catch (err) {
    console.error('Could not restore the autosaved project', err)
    return false
  }
}

/** Saves the project to the browser shortly after every change. */
export function startAutosave(onStatus: (status: 'saving' | 'saved' | 'error') => void): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => [store.page, store.exportFormat, store.border, store.layout, store.elements],
    () => {
      if (suspendAutosave) return
      onStatus('saving')
      clearTimeout(timer)
      timer = setTimeout(async () => {
        try {
          await writeAutosave()
          onStatus('saved')
        } catch (err) {
          console.error('Autosave failed', err)
          onStatus('error')
        }
      }, AUTOSAVE_DELAY)
    },
    { deep: true },
  )
}

/** Swaps in a different project and saves it straight away, dropping the old one's images. */
async function replaceProject(load: () => void | Promise<void>): Promise<void> {
  suspendAutosave = true
  try {
    await load()
    await writeAutosave()
    await pruneStoredImages(usedImageIds(serializeProject()))
  } finally {
    suspendAutosave = false
  }
}

export async function newProject(reset: () => void): Promise<void> {
  await replaceProject(() => {
    clearImages()
    reset()
  })
}

// ---------------------------------------------------------------------------
// Zip files
// ---------------------------------------------------------------------------

const PROJECT_JSON = 'project.json'

function imagePath(id: string, type: string): string {
  return `images/${id}.${extensionFor(type)}`
}

/** Packs the project into a zip: project.json plus images/<id>.<ext>. */
export async function buildProjectZip(onProgress?: (fraction: number) => void): Promise<Blob> {
  const doc = serializeProject()
  const files: Zippable = {
    [PROJECT_JSON]: [strToU8(JSON.stringify(doc, null, 2)), { level: 6 }],
  }
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

/** Opens a saved zip, upgrading it if it's from an older version, and makes it the current project. */
export async function openProjectZip(file: Blob): Promise<void> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new ProjectFileError("This file isn't a zip archive.")
  }
  const json = entries[PROJECT_JSON]
  if (!json) throw new ProjectFileError(`This zip has no ${PROJECT_JSON}, so it isn't a Comic Maker project.`)
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

  await replaceProject(async () => {
    clearImages()
    for (const { id, type } of doc.images) {
      const found = byId.get(id)
      if (!found) continue // its frames fall back to placeholders
      const blobType = type.startsWith('image/') ? type : typeForExtension(found.ext)
      await addImage(new Blob([found.data as BlobPart], { type: blobType }), id)
    }
    applyProject(doc)
  })
}
