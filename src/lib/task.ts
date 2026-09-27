import { reactive } from 'vue'

import { NeedsUserGesture, saveFile, type SaveTarget } from './saveFile'

/** State of the progress dialog shown during slow work (export, save, open). */
export const task = reactive({
  visible: false,
  title: '',
  label: '',
  /** 0-1 */
  progress: 0,
  /** the file is ready but the browser needs a fresh click to show the save picker */
  awaitingClick: false,
})

export type Report = (fraction: number, label?: string) => void

let pendingSave: { blob: Blob; target: SaveTarget; resolve: (saved: boolean) => void; reject: (err: unknown) => void } | null =
  null

/** Runs `work` with the progress dialog open. */
export async function runWithProgress<T>(title: string, work: (report: Report) => Promise<T>): Promise<T> {
  Object.assign(task, { visible: true, title, label: '', progress: 0, awaitingClick: false })
  try {
    return await work((fraction, label) => {
      task.progress = fraction
      if (label) task.label = label
    })
  } finally {
    task.visible = false
    task.awaitingClick = false
  }
}

/**
 * Offers a finished file through the save picker. If the browser won't open
 * the picker any more (the original click has expired), the dialog shows a
 * Save button and this waits for it. Resolves false if the user cancels.
 */
export async function offerFile(blob: Blob, target: SaveTarget): Promise<boolean> {
  try {
    return await saveFile(blob, target)
  } catch (err) {
    if (!(err instanceof NeedsUserGesture)) throw err
    task.label = 'Ready to save'
    task.awaitingClick = true
    return new Promise((resolve, reject) => {
      pendingSave = { blob, target, resolve, reject }
    })
  }
}

/** Called from the dialog's Save button, so the picker opens with a fresh user gesture. */
export function confirmPendingSave(): void {
  const pending = pendingSave
  if (!pending) return
  pendingSave = null
  task.awaitingClick = false
  task.label = 'Choosing where to save'
  saveFile(pending.blob, pending.target).then(pending.resolve, pending.reject)
}

export function cancelPendingSave(): void {
  pendingSave?.resolve(false)
  pendingSave = null
}
