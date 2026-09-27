import { reactive } from 'vue'

interface MenuEntryBase {
  /** shown only while this returns true; re-checked live while the menu is open */
  visible?: () => boolean
}

/** A plain entry: runs its action and closes the menu. */
export interface MenuItem extends MenuEntryBase {
  kind?: 'item'
  label: string
  icon?: string
  /** styled as destructive */
  danger?: boolean
  action: () => void
}

/**
 * A labeled row of small buttons that stays open while clicked, e.g. a
 * style picker or size +/-. `active` is a function so the highlight follows
 * the current value live.
 */
export interface MenuChoices extends MenuEntryBase {
  kind: 'choices'
  label: string
  /** lay the options out in a grid of this many columns instead of a row */
  columns?: number
  /** null leaves an empty cell (e.g. the middle of a compass grid) */
  options: (MenuChoice | null)[]
}

export interface MenuChoice {
  label: string
  /** a color square instead of (or with) the label */
  swatch?: string
  title?: string
  active?: () => boolean
  pick: () => void
}

/** A labeled slider + number box (in px) that stays open while used. */
export interface MenuSlider extends MenuEntryBase {
  kind: 'slider'
  label: string
  /** range for typed values */
  min: number
  max: number
  /** if given, the slider snaps to these values */
  steps?: number[]
  value: () => number
  set: (value: number) => void
}

export interface MenuSeparator extends MenuEntryBase {
  kind: 'separator'
}

export type MenuEntry = MenuItem | MenuChoices | MenuSlider | MenuSeparator

/** The single right-click menu shared by the whole app. */
export const contextMenu = reactive({
  open: false,
  /** viewport position the menu was opened at */
  x: 0,
  y: 0,
  items: [] as MenuEntry[],
})

export function openContextMenu(e: MouseEvent, items: MenuEntry[]): void {
  e.preventDefault()
  e.stopPropagation()
  Object.assign(contextMenu, { open: true, x: e.clientX, y: e.clientY, items })
}

export function closeContextMenu(): void {
  contextMenu.open = false
}
