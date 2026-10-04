export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** Shift snaps rotating (text by its knob, text and photos by their sliders) to steps of this many degrees */
export const ROTATE_SNAP = 15

/** an angle in degrees brought into -180..180 (180 stays 180) */
export function turnDegrees(deg: number): number {
  return deg - 360 * Math.ceil((deg - 180) / 360)
}
