import { del, keys, set } from 'idb-keyval'

// Every photo in the project lives here once, keyed by a hash of its bytes,
// so the same file dropped twice is stored once. Frames refer to images by
// id; the blob itself is mirrored into IndexedDB for the autosave and packed
// into the saved .ct file.

export interface StoredImage {
  id: string
  blob: Blob
  /** object URL for <img> tags */
  url: string
}

const IDB_PREFIX = 'image:'

const registry = new Map<string, StoredImage>()

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashId(blob: Blob): Promise<string> {
  // crypto.subtle only exists in secure contexts (https, localhost); elsewhere
  // fall back to a random id, which just loses de-duplication
  if (!crypto.subtle) return toHex(crypto.getRandomValues(new Uint8Array(16)))
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return toHex(new Uint8Array(digest).slice(0, 16))
}

/**
 * Adds an image to the project and stores it in the browser. Pass `id` when
 * restoring a saved project so its references keep working.
 */
export async function addImage(blob: Blob, id?: string, persist = true): Promise<StoredImage> {
  id ??= await hashId(blob)
  const existing = registry.get(id)
  if (existing) return existing
  const image = { id, blob, url: URL.createObjectURL(blob) }
  registry.set(id, image)
  if (persist) await set(IDB_PREFIX + id, blob)
  return image
}

/** Adds a user-chosen file, rejecting anything that isn't an image. */
export async function addImageFile(file: File): Promise<StoredImage> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" isn't an image.`)
  return addImage(file)
}

export function getImage(id: string): StoredImage | undefined {
  return registry.get(id)
}

/** Forgets every image in memory (the stored copies are left for pruneStoredImages). */
export function clearImages(): void {
  for (const image of registry.values()) URL.revokeObjectURL(image.url)
  registry.clear()
}

/** Deletes stored images that the project no longer uses. */
export async function pruneStoredImages(used: Set<string>): Promise<void> {
  for (const key of await keys()) {
    if (typeof key === 'string' && key.startsWith(IDB_PREFIX) && !used.has(key.slice(IDB_PREFIX.length))) {
      await del(key)
    }
  }
}

export function storedImageKey(id: string): string {
  return IDB_PREFIX + id
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
}

export function extensionFor(type: string): string {
  return EXTENSIONS[type] ?? 'bin'
}

export function typeForExtension(ext: string): string {
  return Object.entries(EXTENSIONS).find(([, e]) => e === ext.toLowerCase())?.[0] ?? 'application/octet-stream'
}
