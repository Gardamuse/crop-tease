import { watch } from 'vue'

import { findElement, store } from './store'

// Undo and redo, kept in memory for this session only (never saved): each
// step is a snapshot of the project as it was. Changes are gathered into a
// step once they settle, so a drag, a slider slide or a burst of typing in a
// field undoes in one go rather than a frame or a key at a time.

/** how long changes must pause before they become one undo step (ms) */
const SETTLE_DELAY = 400
/** the most undo steps kept; the oldest are dropped past this */
const HISTORY_LIMIT = 100

interface Step {
  /** the project, as a snapshot (see snapshot()) */
  state: string
  /** the page the change was made on, shown again when it's undone or redone */
  page: number
}

const undoStack: Step[] = []
const redoStack: Step[] = []
/** the project as of the latest step: what an undo steps back from */
let committed = ''
/** the page the changes not yet in a step began on; null when there are none */
let pendingPage: number | null = null
let timer: ReturnType<typeof setTimeout> | undefined
/** a mouse button or finger is down: a drag may be in progress, so don't cut it into steps */
let pointerHeld = false

/** Everything an undo restores: the project's content and settings, not what's shown or selected. */
function projectState() {
  return {
    name: store.name,
    pageSize: store.pageSize,
    exportFormat: store.exportFormat,
    border: store.border,
    closeUps: store.closeUps,
    textFont: store.textFont,
    textSize: store.textSize,
    textColor: store.textColor,
    photoFilters: store.photoFilters,
    pages: store.pages,
    pageNumber: store.pageNumber,
  }
}

function snapshot(): string {
  return JSON.stringify(projectState())
}

// The snapshot without the stacking order. Clicking an item brings it to the
// front (see selectElement), which shouldn't count as a change of its own.
function withoutStacking(state: string): string {
  return JSON.stringify(JSON.parse(state), (key, value) => (key === 'z' ? undefined : value))
}

function restore(step: Step): void {
  const s = JSON.parse(step.state) as ReturnType<typeof projectState>
  store.name = s.name
  store.pageSize = s.pageSize
  store.exportFormat = s.exportFormat
  store.border = s.border
  store.closeUps = s.closeUps
  store.textFont = s.textFont
  store.textSize = s.textSize
  store.textColor = s.textColor
  Object.assign(store.photoFilters, s.photoFilters) // the same object: the sidebar's controls hold it
  store.pages = s.pages
  store.pageNumber = s.pageNumber
  store.pageIndex = Math.min(step.page, store.pages.length - 1)
  // keep the selection if it's still there
  if (store.selectedId !== null && !findElement(store.selectedId)) store.selectedId = null
  store.selectedBarId = null
  store.splitMode = false
  store.generation++ // remount the stage so e.g. text boxes show their restored text
  committed = step.state
  pendingPage = null
}

/** Makes the changes since the latest step into a new step (if anything really changed). */
function commit(): void {
  clearTimeout(timer)
  const state = snapshot()
  if (state !== committed && withoutStacking(state) !== withoutStacking(committed)) {
    undoStack.push({ state: committed, page: pendingPage ?? store.pageIndex })
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift()
    redoStack.length = 0
  }
  // a stacking-only change joins the latest step quietly
  committed = state
  pendingPage = null
}

function scheduleCommit(): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (!pointerHeld) commit() // otherwise the release schedules it again
  }, SETTLE_DELAY)
}

/** Starts keeping history, from the project as it is now. Call once, after the project has loaded. */
export function startHistory(): void {
  committed = snapshot()
  watch(
    projectState,
    () => {
      pendingPage ??= store.pageIndex
      scheduleCommit()
    },
    { deep: true },
  )
  window.addEventListener('pointerdown', () => (pointerHeld = true), true)
  const release = () => {
    pointerHeld = false
    if (pendingPage !== null) scheduleCommit()
  }
  window.addEventListener('pointerup', release, true)
  window.addEventListener('pointercancel', release, true)
}

/** Forgets all history, starting afresh from the project as it is now (e.g. after opening another). */
export function resetHistory(): void {
  clearTimeout(timer)
  undoStack.length = 0
  redoStack.length = 0
  committed = snapshot()
  pendingPage = null
}

export function undo(): boolean {
  commit() // changes not yet in a step are undone first
  const step = undoStack.pop()
  if (!step) return false
  redoStack.push({ state: committed, page: step.page })
  restore(step)
  return true
}

export function redo(): boolean {
  commit()
  const step = redoStack.pop()
  if (!step) return false
  undoStack.push({ state: committed, page: step.page })
  restore(step)
  return true
}
