import { reactive } from 'vue'

import type { IconName } from '@/components/UiIcon.vue'

interface MenuEntryBase {
  /** shown only while this returns true; re-checked live while the menu is open */
  visible?: () => boolean
}

/** A plain entry: runs its action and closes the menu. */
export interface MenuItem extends MenuEntryBase {
  kind?: 'item'
  label: string
  icon?: IconName
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
  /** a function to keep it up to date while the menu is open */
  label: string | (() => string)
  /** a color square instead of (or with) the label */
  swatch?: string
  title?: string
  active?: () => boolean
  pick: () => void
  /** makes this a custom-color swatch that opens the color picker */
  pickColor?: { value: () => string; set: (color: string) => void }
}

/** A labeled slider + number box (in px, or `unit`) that stays open while used. */
export interface MenuSlider extends MenuEntryBase {
  kind: 'slider'
  label: string
  /** shown after the number (default px) */
  unit?: string
  title?: string
  /** a CSS background for the track (e.g. a color gradient) */
  track?: string
  /** if given, double-clicking the slider sets this value */
  resetValue?: number
  /** with resetValue: a button beside the slider that sets it, with this hover text */
  resetTitle?: string
  /** if given, sliding with Shift held snaps to multiples of this */
  shiftSnap?: number
  /** range for typed values */
  min: number
  max: number
  /** if given, the slider snaps to these values */
  steps?: number[]
  value: () => number
  set: (value: number) => void
  /**
   * a link toggle beside the slider, for a value that can follow a shared
   * one: while linked the slider is faded; setting a value should unlink it
   * (that's up to `set`)
   */
  link?: {
    linked: () => boolean
    toggle: () => void
    /** hover text for each state */
    linkedTitle: string
    unlinkedTitle: string
  }
}

/**
 * A labeled pair of values on one track (a low and a high handle), each also
 * in a number box, like the level sliders in image editors.
 */
export interface MenuRange extends MenuEntryBase {
  kind: 'range'
  label: string
  title?: string
  min: number
  max: number
  /** the least the high value must be above the low one */
  minGap: number
  value: () => [number, number]
  set: (value: [number, number]) => void
}

/** A labeled dropdown, for picking one of many options; stays open while used. */
export interface MenuSelect extends MenuEntryBase {
  kind: 'select'
  label: string
  options: { value: string; label: string; /** e.g. a font family to show the option in */ fontFamily?: string }[]
  value: () => string
  set: (value: string) => void
}

export interface MenuSeparator extends MenuEntryBase {
  kind: 'separator'
}

/** Plain entries side by side on one row, e.g. Change image and Remove image. */
export interface MenuActions extends MenuEntryBase {
  kind: 'actions'
  items: MenuItem[]
}

/**
 * A titled group of rows, indented under its heading, e.g. an effect with
 * its settings. The heading can carry the group's switch (e.g. None / Local
 * / Global); its rows show only while it's on. A folding group's rows show
 * only while it's open: one folding group in a menu is open at a time,
 * opened by clicking its heading or switching it on, and the others, if on,
 * show their summary instead.
 */
export interface MenuGroup extends MenuEntryBase {
  kind: 'group'
  label: string
  /** the group's switch, on the right of its heading */
  options?: MenuChoice[]
  /** whether its rows apply (e.g. the effect is on); always if not given */
  on?: () => boolean
  fold?: boolean
  /** a folded group's settings on one line */
  summary?: () => string
  entries: MenuEntry[]
}

export type MenuEntry =
  | MenuItem
  | MenuActions
  | MenuGroup
  | MenuChoices
  | MenuSlider
  | MenuRange
  | MenuSelect
  | MenuSeparator

/**
 * Marks a card a menu control opens on the page itself (a color picker, a
 * dropdown's list), so the menu it belongs to treats presses and scrolling
 * in it as its own.
 */
export const POPOVER_ATTR = 'data-menu-popover'

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
