// Minimal typings for the File System Access save picker (Chromium only).
interface SaveFilePickerOptions {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}
interface WritableFileStream {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}
interface SaveFileHandle {
  createWritable(): Promise<WritableFileStream>
}
declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFileHandle>
  }
}

export interface SaveTarget {
  name: string
  description: string
  mime: string
  extension: string
}

/**
 * The browser refused to open the save picker because the user's click was
 * too long ago (e.g. a slow export). Ask for another click and try again.
 */
export class NeedsUserGesture extends Error {}

/**
 * Saves a blob through the browser's "Save as" picker where supported, and
 * as a regular download elsewhere (Firefox, Safari), which asks where to
 * save or not according to the browser's own download settings.
 * Resolves false if the user cancelled the picker.
 */
export async function saveFile(blob: Blob, target: SaveTarget): Promise<boolean> {
  if (!window.showSaveFilePicker) {
    downloadFile(blob, target.name)
    return true
  }
  let handle: SaveFileHandle
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: target.name,
      types: [{ description: target.description, accept: { [target.mime]: [`.${target.extension}`] } }],
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return false
    if (err instanceof DOMException && (err.name === 'SecurityError' || err.name === 'NotAllowedError')) {
      throw new NeedsUserGesture()
    }
    throw err
  }
  const stream = await handle.createWritable()
  await stream.write(blob)
  await stream.close()
  return true
}

function downloadFile(blob: Blob, name: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  // some browsers only honor `download` on a link that's in the document
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
