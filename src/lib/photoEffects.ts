import { ref } from 'vue'

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
  /** null when levels are off (its sliders hidden); FULL_LEVELS while on but untouched */
  levels: Levels | null
  /** null when color balance is off (its sliders hidden) */
  colorBalance: ColorBalance | null
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

function changesTones(l: Levels | null): boolean {
  return !!l && (Object.keys(FULL_LEVELS) as (keyof Levels)[]).some((k) => l[k] !== FULL_LEVELS[k])
}

export type ToneRange = 'shadows' | 'midtones' | 'highlights'

/**
 * Color balance, as in Krita (and GIMP): for each tone range, how far the
 * photo leans from cyan to red, magenta to green and yellow to blue, in
 * -MAX_BALANCE..MAX_BALANCE (Krita's sliders run to 100), optionally keeping
 * each pixel's lightness.
 */
export type ColorBalance = Record<ToneRange, [number, number, number]> & { preserveLuminosity: boolean }

export const MAX_BALANCE = 40 // also in the skill doc (public/crop-tease-skill.md)

export const TONE_RANGES: { value: ToneRange; label: string }[] = [
  { value: 'shadows', label: 'Shadows' },
  { value: 'midtones', label: 'Midtones' },
  { value: 'highlights', label: 'Highlights' },
]

/** each slider: its label (the color it leans to), and the track from its opposite to it */
export const BALANCE_AXES = [
  { label: 'Red', title: 'Cyan (left) to red (right)', track: 'linear-gradient(to right, #00c8d7, #e2404a)' },
  { label: 'Green', title: 'Magenta (left) to green (right)', track: 'linear-gradient(to right, #d23cc8, #3cb44a)' },
  { label: 'Blue', title: 'Yellow (left) to blue (right)', track: 'linear-gradient(to right, #e8c800, #3c64dc)' },
]

export function neutralBalance(): ColorBalance {
  return { shadows: [0, 0, 0], midtones: [0, 0, 0], highlights: [0, 0, 0], preserveLuminosity: true }
}

function changesColor(b: ColorBalance | null): boolean {
  return !!b && TONE_RANGES.some((r) => b[r.value].some((v) => v !== 0))
}

/**
 * How much of each range's correction a pixel of lightness l (0-1) gets:
 * Krita's (and GIMP's) masks, which hand over between the ranges around a
 * third and two thirds of the way up, scaled by 0.7.
 */
function toneWeights(l: number): Record<ToneRange, number> {
  const a = 0.25
  const b = 0.333
  const ramp = (x: number) => Math.min(1, Math.max(0, x))
  return {
    shadows: ramp((l - b) / -a + 0.5) * 0.7,
    midtones: ramp((l - b) / a + 0.5) * ramp((l + b - 1) / -a + 0.5) * 0.7,
    highlights: ramp((l + b - 1) / a + 0.5) * 0.7,
  }
}

/** how finely the shift is sampled over lightness for the filter's lookup tables */
const BALANCE_TABLE_SIZE = 256

/**
 * The color balance as lookup tables for an SVG filter, one per channel: by
 * a pixel's lightness, the shift to add to that channel, stored as
 * 0.5 + shift / 2 since filter results can't go below 0. (The filter
 * measures lightness as the channels' average; Krita uses the average of
 * the brightest and darkest channel, which no filter step can compute. The
 * two agree on greys and differ a little on strong colors.)
 */
export function balanceTables(b: ColorBalance): [string, string, string] {
  const tables: [number[], number[], number[]] = [[], [], []]
  for (let i = 0; i < BALANCE_TABLE_SIZE; i++) {
    const w = toneWeights(i / (BALANCE_TABLE_SIZE - 1))
    for (const ch of [0, 1, 2] as const) {
      const shift = TONE_RANGES.reduce((sum, r) => sum + (w[r.value] * b[r.value][ch]) / 100, 0)
      tables[ch].push(0.5 + shift / 2)
    }
  }
  return tables.map((t) => t.map((v) => v.toFixed(4)).join(' ')) as [string, string, string]
}

/** Whether the photo needs its filter (blur, or levels or color balance that change something). */
export function hasPhotoFilter(e: PhotoEffects): boolean {
  return e.blur > 0 || changesTones(e.levels) || changesColor(e.colorBalance)
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

/** which tone range the color balance sliders show, shared by all photo menus while the app runs */
const balanceRange = ref<ToneRange>('midtones')

/** The right-click menu entries for a photo's effects, shown while it has a photo. */
export function photoMenuEntries(target: PhotoEffects, hasPhoto: () => boolean): MenuEntry[] {
  const on = () => hasPhoto() && target.overlay !== null
  const set = (change: Partial<ImageOverlay>) => {
    const fresh: ImageOverlay = { from: 'top', angle: 0, color: OVERLAY_COLORS[0]!.color, ...DEFAULT_OVERLAY }
    target.overlay = { ...(target.overlay ?? fresh), ...change }
  }
  const isPreset = () => OVERLAY_COLORS.some((c) => c.color === target.overlay?.color.toLowerCase())
  const levels = () => target.levels ?? FULL_LEVELS
  const setLevels = (change: Partial<Levels>) => (target.levels = { ...levels(), ...change })
  const levelsOn = () => hasPhoto() && target.levels !== null
  const balanceOn = () => hasPhoto() && target.colorBalance !== null
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
      kind: 'choices',
      label: 'Levels',
      visible: hasPhoto,
      options: [
        { label: 'Off', active: () => target.levels === null, pick: () => (target.levels = null) },
        {
          label: 'On',
          title: "Set the photo's black and white points, as in Krita",
          active: () => target.levels !== null,
          pick: () => (target.levels ??= { ...FULL_LEVELS }),
        },
      ],
    },
    {
      kind: 'range',
      label: 'Input',
      title: 'The tones that become black and white; those beyond are clipped',
      visible: levelsOn,
      min: 0,
      max: 255,
      minGap: 1,
      value: () => [levels().inLow, levels().inHigh],
      set: ([inLow, inHigh]) => setLevels({ inLow, inHigh }),
    },
    {
      kind: 'range',
      label: 'Output',
      title: 'The darkest and lightest tones the photo is fitted into',
      visible: levelsOn,
      min: 0,
      max: 255,
      minGap: 0,
      value: () => [levels().outLow, levels().outHigh],
      set: ([outLow, outHigh]) => setLevels({ outLow, outHigh }),
    },
    {
      kind: 'choices',
      label: 'Color balance',
      visible: hasPhoto,
      options: [
        { label: 'Off', active: () => target.colorBalance === null, pick: () => (target.colorBalance = null) },
        {
          label: 'On',
          title: "Shift the photo's shadows, midtones and highlights toward colors, as in Krita",
          active: () => target.colorBalance !== null,
          pick: () => (target.colorBalance ??= neutralBalance()),
        },
      ],
    },
    {
      kind: 'choices',
      label: 'Tones',
      visible: balanceOn,
      options: TONE_RANGES.map((r) => ({
        // a dot marks the ranges that have been shifted
        label: () => (target.colorBalance?.[r.value].some((v) => v !== 0) ? `${r.label}•` : r.label),
        title: r.label,
        active: () => balanceRange.value === r.value,
        pick: () => (balanceRange.value = r.value),
      })),
    },
    ...BALANCE_AXES.map(
      (axis, ch): MenuEntry => ({
        kind: 'slider',
        label: axis.label,
        title: `${axis.title}; double-click for 0`,
        visible: balanceOn,
        min: -MAX_BALANCE,
        max: MAX_BALANCE,
        unit: '',
        track: axis.track,
        resetValue: 0,
        value: () => target.colorBalance?.[balanceRange.value][ch] ?? 0,
        set: (v) => {
          const b = target.colorBalance
          if (b) b[balanceRange.value][ch] = Math.round(clamp(v, -MAX_BALANCE, MAX_BALANCE))
        },
      }),
    ),
    {
      kind: 'choices',
      label: 'Luminosity',
      visible: balanceOn,
      options: [
        {
          label: 'Keep',
          title: "Keep each pixel's lightness, only its color shifts (Krita's Preserve Luminosity)",
          active: () => !!target.colorBalance?.preserveLuminosity,
          pick: () => target.colorBalance && (target.colorBalance.preserveLuminosity = true),
        },
        {
          label: 'Let change',
          title: 'The shift can also lighten or darken the photo',
          active: () => target.colorBalance?.preserveLuminosity === false,
          pick: () => target.colorBalance && (target.colorBalance.preserveLuminosity = false),
        },
      ],
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
