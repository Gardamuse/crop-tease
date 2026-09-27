// The stage is laid out at a fixed STAGE_W x STAGE_H internally (element
// positions, the seam and the export are all computed in that space) and is
// only visually scaled to fit the window. 4:5 scales exactly onto 1600x2000.
export const STAGE_W = 700
export const STAGE_H = 875

export const EXPORT_W = 1600
export const EXPORT_H = Math.round((EXPORT_W * STAGE_H) / STAGE_W)
export const EXPORT_SCALE = EXPORT_W / STAGE_W

export const TEXT_PALETTE = ['#241b30', '#ffffff', '#ff6fb0', '#78d2d2', '#de3c8d']
