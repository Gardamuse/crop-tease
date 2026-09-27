// The page is edited in "stage units": its shorter side is always
// STAGE_SHORT units long, whatever the output size. Element sizes, borders
// and fonts are all in stage units, so a layout keeps its proportions when
// the page size changes, and the export just scales the stage up.
export const STAGE_SHORT = 700

export const DEFAULT_PAGE = { width: 1600, height: 2000 }
export const MIN_PAGE_SIDE = 200
// comfortably inside every browser's canvas size limit
export const MAX_PAGE_SIDE = 8000

export const PAGE_PRESETS = [
  { label: '4:5 portrait', width: 1600, height: 2000 },
  { label: '2:3 portrait', width: 1600, height: 2400 },
  { label: '1:1 square', width: 2000, height: 2000 },
  { label: '3:2 landscape', width: 2400, height: 1600 },
  { label: '16:9 landscape', width: 1920, height: 1080 },
]

export const EXPORT_QUALITY = 0.92

// The page border's width is in output pixels, so it stays the same when the
// page size changes. Its color is shared by the border, the split bars and
// the close-up rings.
export const DEFAULT_BORDER = { width: 0, color: '#000000', outline: 'none' as BorderOutline }
export const MAX_BORDER_WIDTH = 200
/** A 1px line along both sides of every border, bar and close-up ring. */
export type BorderOutline = 'none' | 'black' | 'white'
export const BORDER_OUTLINES: { value: BorderOutline; label: string; color: string | null }[] = [
  { value: 'none', label: 'None', color: null },
  { value: 'black', label: 'Black', color: '#000000' },
  { value: 'white', label: 'White', color: '#ffffff' },
]
export const OUTLINE_WIDTH = 1 // output pixels

/** Split bar thickness, in stage units. */
export const BAR_WIDTH = 9

export const BORDER_COLOR_PRESETS = [
  { label: 'Black', color: '#000000' },
  { label: 'White', color: '#ffffff' },
]

// flat fills shown where no image has been set yet; panels cycle through the list
export const PANEL_PLACEHOLDER_COLORS = ['#f4b6d2', '#a9dede', '#cbbcf2', '#fbeaa0', '#b9e5bf', '#f7c3a3']
export const CLOSE_UP_PLACEHOLDER_COLOR = '#ffd9a8'

export const TEXT_PALETTE = ['#241b30', '#ffffff', '#ff6fb0', '#78d2d2', '#de3c8d']
