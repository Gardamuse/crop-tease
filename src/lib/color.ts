import { clamp } from './math'

/** hue 0-360, saturation and value 0-1 */
export interface Hsv {
  h: number
  s: number
  v: number
}

/** #rrggbb from a #rgb or #rrggbb (with or without the #), or null if it isn't one. */
export function normalizeHex(text: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())
  if (!m) return null
  const hex = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!
  return `#${hex.toLowerCase()}`
}

/** Whether light text reads better than dark on this #rrggbb color (by its luminance). */
export function isDark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return l < 0.18
}

export function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (k: number) => {
    const n = (k + h / 60) % 6
    return v - v * s * clamp(Math.min(n, 4 - n), 0, 1)
  }
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`
}

/**
 * HSL's saturation and lightness (0-1) for a color given as HSV; the hue is
 * the same in both. At black or white HSL's saturation is undefined: 0.
 */
export function hsvToHsl({ s, v }: Hsv): { s: number; l: number } {
  const l = v * (1 - s / 2)
  const m = Math.min(l, 1 - l)
  return { s: m > 0 ? (v - l) / m : 0, l }
}

/** The HSV saturation and value of a color given as HSL's saturation and lightness (0-1). */
export function hslToHsv(s: number, l: number): { s: number; v: number } {
  const v = l + s * Math.min(l, 1 - l)
  return { s: v > 0 ? 2 * (1 - l / v) : 0, v }
}
