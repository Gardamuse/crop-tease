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

// shown where no image has been set yet
export const PLACEHOLDER_COLORS = {
  left: '#f4b6d2',
  right: '#a9dede',
  closeUp: '#ffd9a8',
}

export const TEXT_PALETTE = ['#241b30', '#ffffff', '#ff6fb0', '#78d2d2', '#de3c8d']
