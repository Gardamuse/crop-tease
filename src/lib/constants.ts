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

// The page border, divider and outline widths are in output pixels, so they
// stay the same when the page size changes. The divider width covers the
// split bars and the close-up rings; the color is shared by all three. The
// outline (null color = none) runs along both sides of all of them.
export const DEFAULT_BORDER = {
  width: 40,
  dividerWidth: 20,
  color: '#ffffff',
  outlineColor: '#000000' as string | null,
  outlineWidth: 2,
}
export const MAX_BORDER_WIDTH = 200
export const MAX_DIVIDER_WIDTH = 100
export const MIN_OUTLINE_WIDTH = 1
export const MAX_OUTLINE_WIDTH = 10

export const DEFAULT_CLOSE_UPS = {
  shadow: true,
  /** clip close-ups at the inner edge of the page border instead of drawing over it */
  withinBorder: false,
}
export const COLOR_PRESETS = [
  { label: 'Black', color: '#000000' },
  { label: 'White', color: '#ffffff' },
]

// flat fills shown where no image has been set yet; panels cycle through the list
export const PANEL_PLACEHOLDER_COLORS = ['#f4b6d2', '#a9dede', '#cbbcf2', '#fbeaa0', '#b9e5bf', '#f7c3a3']
export const CLOSE_UP_PLACEHOLDER_COLOR = '#ffd9a8'

export type TextStyle = 'none' | 'speech' | 'square'
export const TEXT_STYLES: { value: TextStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'speech', label: 'Speech' },
  { value: 'square', label: 'Square' },
]

/** Where a speech bubble's tail sits, as a compass position around the bubble. */
export type TailPosition = 'top-left' | 'top' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right'
export const TAIL_POSITIONS: TailPosition[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
]

// Text size limits in output pixels: the slider snaps to these steps (fine
// at small sizes, coarser at big ones); the number box accepts anything in
// the typed range.
export const FONT_SIZE_STEPS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 90, 100,
  110, 120, 135, 150, 165, 180, 200, 225, 250, 275, 300, 350, 400, 450, 500,
]
export const MIN_TYPED_FONT_PX = 1
export const MAX_TYPED_FONT_PX = 1000

export const TEXT_PALETTE = ['#241b30', '#ffffff', '#ff6fb0', '#78d2d2', '#de3c8d']
