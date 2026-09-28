import type { MenuEntry } from './contextMenu'
import type { ImageFrame } from './imageFrame'
import { clamp } from './math'
import { stageSize } from './store'

// Effects on a panel's or close-up's photo: a blur, levels, and a color
// laid over it fading out from the top or bottom, turned by `angle`. They
// belong to the panel or close-up, so they stay when the photo is changed.

/** the strongest blur, in output pixels */
export const MAX_BLUR = 50 // also in the skill doc (public/crop-tease-skill.md)

/** What carries the effects: a panel (layout leaf) or a close-up. */
export interface PhotoEffects {
  overlay: ImageOverlay | null
  /** blur radius in output pixels; 0 for none */
  blur: number
  /** null leaves the photo's tones as they are */
  levels: Levels | null
}

/**
 * Levels, as in Krita but without the midtone: the input range (inLow to
 * inHigh) is stretched to full black to full white, anything outside it
 * clipped, and that is then fitted into the output range (outLow to
 * outHigh). All 0-255, applied to each color channel alike.
 */
export interface Levels {
  inLow: number
  inHigh: number
  outLow: number
  outHigh: number
}

export const FULL_LEVELS: Levels = { inLow: 0, inHigh: 255, outLow: 0, outHigh: 255 }

/** The levels as two linear steps of an SVG filter; its results are clamped to 0-1 after each. */
export function levelsTransfers(l: Levels): { slope: number; intercept: number }[] {
  const stretch = 255 / Math.max(1, l.inHigh - l.inLow)
  return [
    { slope: stretch, intercept: (-l.inLow / 255) * stretch },
    { slope: (l.outHigh - l.outLow) / 255, intercept: l.outLow / 255 },
  ]
}

/** Whether the photo needs its filter (blur or levels). */
export function hasPhotoFilter(e: PhotoEffects): boolean {
  return e.blur > 0 || e.levels !== null
}

export type OverlayFrom = 'top' | 'bottom'

export interface ImageOverlay {
  from: OverlayFrom
  /** degrees clockwise the fade is turned from its side, -MAX_OVERLAY_ANGLE..MAX_OVERLAY_ANGLE */
  angle: number
  /** #rrggbb */
  color: string
  /** how far the fade reaches, in % of the photo's area */
  size: number
  /** the color's opacity where it's strongest, in % */
  strength: number
}

/** how far an overlay can be turned either way, in degrees (further would just be the opposite side) */
export const MAX_OVERLAY_ANGLE = 90
/**
 * the rotation slider's stops: every 2 degrees, 0 included (at 1 degree the
 * slider has more values than pixels, so some, 0 among them, can't be hit)
 */
const OVERLAY_ANGLE_STEPS = Array.from({ length: MAX_OVERLAY_ANGLE + 1 }, (_, i) => 2 * i - MAX_OVERLAY_ANGLE)
/** a new overlay's size and strength, in % */
export const DEFAULT_OVERLAY = { size: 100, strength: 100 }

export const OVERLAY_FROM: { value: OverlayFrom; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
]

export const OVERLAY_COLORS = [
  { label: 'Black', color: '#000000' },
  { label: 'White', color: '#ffffff' },
  { label: 'Wine', color: '#7b2649' },
  { label: 'Pink', color: '#ff6fb0' },
  { label: 'Teal', color: '#78d2d2' },
]

// the fade's direction as a CSS gradient angle: 0deg runs bottom to top, 180deg top to bottom
function cssAngle(o: ImageOverlay): number {
  return (o.from === 'bottom' ? 0 : 180) + o.angle
}

/** Where the fade runs along its line: offsets (0-1) with the color's opacity (0-1) at each. */
function overlayStops(o: ImageOverlay): { offset: number; opacity: number }[] {
  return [
    { offset: 0, opacity: o.strength / 100 },
    { offset: o.size / 100, opacity: 0 },
  ]
}

/** The overlay as a CSS background: the color fading to clear. */
export function overlayBackground(o: ImageOverlay): string {
  // the same color at the stop's opacity (#rrggbbaa), so the fade doesn't pass through grey
  const alpha = (opacity: number) =>
    Math.round(opacity * 255)
      .toString(16)
      .padStart(2, '0')
  const stops = overlayStops(o).map((s) => `${o.color}${alpha(s.opacity)} ${s.offset * 100}%`)
  return `linear-gradient(${cssAngle(o)}deg, ${stops.join(', ')})`
}

/**
 * The same fade for an SVG linearGradient over a box (user space): the
 * gradient line CSS would use (through the center, long enough that the
 * corners get the end colors) and its stops.
 */
export function overlayGradient(o: ImageOverlay, box: { x: number; y: number; w: number; h: number }) {
  const rad = (cssAngle(o) * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const half = (Math.abs(box.w * dx) + Math.abs(box.h * dy)) / 2
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  return {
    x1: cx - dx * half,
    y1: cy - dy * half,
    x2: cx + dx * half,
    y2: cy + dy * half,
    stops: overlayStops(o),
  }
}

/**
 * The blur's size in the photo's own units: the photo is drawn scaled by
 * its frame, which scales its blur too, and stage units are output pixels
 * divided by exportScale.
 */
export function blurRadius(blur: number, frame: ImageFrame): number {
  return blur / stageSize.value.exportScale / frame.scale
}

/** The right-click menu entries for a photo's blur and overlay, shown while it has a photo. */
export function photoMenuEntries(target: PhotoEffects, hasPhoto: () => boolean): MenuEntry[] {
  const on = () => hasPhoto() && target.overlay !== null
  const set = (change: Partial<ImageOverlay>) => {
    const fresh: ImageOverlay = { from: 'top', angle: 0, color: OVERLAY_COLORS[0]!.color, ...DEFAULT_OVERLAY }
    target.overlay = { ...(target.overlay ?? fresh), ...change }
  }
  const isPreset = () => OVERLAY_COLORS.some((c) => c.color === target.overlay?.color.toLowerCase())
  const levels = () => target.levels ?? FULL_LEVELS
  const setLevels = (change: Partial<Levels>) => {
    const l = { ...levels(), ...change }
    const full = (Object.keys(FULL_LEVELS) as (keyof Levels)[]).every((k) => l[k] === FULL_LEVELS[k])
    target.levels = full ? null : l
  }
  return [
    { kind: 'separator', visible: hasPhoto },
    {
      kind: 'slider',
      label: 'Blur',
      visible: hasPhoto,
      min: 0,
      max: MAX_BLUR,
      value: () => target.blur,
      set: (px) => (target.blur = Math.round(clamp(px, 0, MAX_BLUR))),
    },
    {
      kind: 'range',
      label: 'Levels in',
      title: 'Input levels: the tones that become black and white',
      visible: hasPhoto,
      min: 0,
      max: 255,
      minGap: 1,
      value: () => [levels().inLow, levels().inHigh],
      set: ([inLow, inHigh]) => setLevels({ inLow, inHigh }),
    },
    {
      kind: 'range',
      label: 'Levels out',
      title: 'Output levels: the darkest and lightest tones the photo keeps',
      visible: hasPhoto,
      min: 0,
      max: 255,
      minGap: 0,
      value: () => [levels().outLow, levels().outHigh],
      set: ([outLow, outHigh]) => setLevels({ outLow, outHigh }),
    },
    {
      kind: 'choices',
      label: 'Overlay',
      visible: hasPhoto,
      options: [
        { label: 'None', active: () => target.overlay === null, pick: () => (target.overlay = null) },
        ...OVERLAY_FROM.map((f) => ({
          label: f.label,
          title: `A color fading from the ${f.value}`,
          active: () => target.overlay?.from === f.value,
          pick: () => set({ from: f.value }),
        })),
      ],
    },
    {
      kind: 'slider',
      label: 'Rotate',
      visible: on,
      min: -MAX_OVERLAY_ANGLE,
      max: MAX_OVERLAY_ANGLE,
      steps: OVERLAY_ANGLE_STEPS,
      unit: '°',
      value: () => Math.round(target.overlay?.angle ?? 0),
      set: (deg) => set({ angle: clamp(deg, -MAX_OVERLAY_ANGLE, MAX_OVERLAY_ANGLE) }),
    },
    {
      kind: 'slider',
      label: 'Size',
      visible: on,
      min: 5,
      max: 100,
      unit: '%',
      value: () => Math.round(target.overlay?.size ?? DEFAULT_OVERLAY.size),
      set: (pct) => set({ size: clamp(pct, 5, 100) }),
    },
    {
      kind: 'slider',
      label: 'Strength',
      visible: on,
      min: 5,
      max: 100,
      unit: '%',
      value: () => Math.round(target.overlay?.strength ?? DEFAULT_OVERLAY.strength),
      set: (pct) => set({ strength: clamp(pct, 5, 100) }),
    },
    {
      kind: 'choices',
      label: 'Color',
      visible: on,
      options: [
        ...OVERLAY_COLORS.map((c) => ({
          label: c.label,
          swatch: c.color,
          active: () => target.overlay?.color.toLowerCase() === c.color,
          pick: () => set({ color: c.color }),
        })),
        {
          label: 'Custom color',
          active: () => on() && !isPreset(),
          pick: () => {},
          pickColor: { value: () => target.overlay?.color ?? '#000000', set: (color: string) => set({ color }) },
        },
      ],
    },
  ]
}
