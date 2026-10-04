import { ref } from 'vue'

import type { MenuChoice, MenuEntry } from './contextMenu'
import { BLACK } from './constants'
import { rotateFrame, type ImageFrame } from './imageFrame'
import { clamp, ROTATE_SNAP, turnDegrees } from './math'
import { stageSize, store } from './store'

// Effects on a panel's or close-up's photo: a blur, levels, color balance,
// a color splash, and a color laid over it fading out from the top or
// bottom, turned by `angle`. They belong to the panel or close-up, so they
// stay when the photo is changed.

/** the strongest blur, in output pixels */
export const MAX_BLUR = 50 // also in the skill doc (public/crop-tease-skill.md)

/** What carries the effects: a panel (layout leaf) or a close-up. */
export interface PhotoEffects {
  overlay: ImageOverlay | null
  /** blur radius in output pixels; 0 for none */
  blur: number
  /** null to follow the project's (store.photoFilters), NONE for none; FULL_LEVELS while its own but untouched */
  levels: Levels | typeof NONE | null
  /** null to follow the project's (store.photoFilters), NONE for none */
  colorBalance: ColorBalance | typeof NONE | null
  /** null to follow the project's (store.photoFilters), NONE for none */
  colorSplash: ColorSplash | typeof NONE | null
}

/** a photo's levels, color balance or color splash switched off, whatever the project's */
export const NONE = 'none'

/** A photo's effects as drawn: the project's levels, color balance and color splash filled in. */
export interface DrawnEffects extends Omit<PhotoEffects, 'levels' | 'colorBalance' | 'colorSplash'> {
  levels: Levels | null
  colorBalance: ColorBalance | null
  colorSplash: ColorSplash | null
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

/**
 * Color splash: the photo turned gray (by `desaturate` %) except for the
 * colors within `width` degrees around `hue` on the color wheel, whose edges
 * fade over `softness` % of the range's half-width.
 */
export interface ColorSplash {
  /** the kept colors' hue, 0..359 degrees (0 red, 120 green, 240 blue) */
  hue: number
  /** how wide a range of hues is kept, MIN..MAX_SPLASH_WIDTH degrees */
  width: number
  /** how gradually the kept range fades into gray at its edges, 0..100 % */
  softness: number
  /** how gray the rest of the photo gets, 0..100 % */
  desaturate: number
}

export const MIN_SPLASH_WIDTH = 10
export const MAX_SPLASH_WIDTH = 300 // also in the skill doc (public/crop-tease-skill.md)

export function defaultSplash(): ColorSplash {
  return { hue: 0, width: 60, softness: 50, desaturate: 100 }
}

/** the slider track for picking the hue: the color wheel unrolled */
export const HUE_TRACK = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => `hsl(${h} 90% 50%)`).join(', ')})`

/** how colorful (0..1, a pure color being 1) a pixel must be to be kept fully; duller ones are kept less */
const SPLASH_FULL_CHROMA = 0.25

/**
 * The splash as two color matrices for an SVG filter. A pixel's color is
 * placed on a color wheel: a = r - (g + b) / 2 and b = (g - b) * sqrt(3) / 2,
 * which puts red at 0, green at 120 and blue at 240 degrees, its distance
 * from the center (its chroma) being how colorful it is. The first matrix
 * turns the wheel so the kept hue points along a, storing a (as 0.5 + a / 2,
 * as filter results can't go below 0) in red and b's positive and negative
 * parts in green and blue, so the second can use |b|. For a pixel of chroma
 * C at angle t from the kept hue, a sin(w) - |b| cos(w) = C sin(w - |t|),
 * positive within w degrees of the kept hue. The second matrix scales that
 * into the pixel's mask (alpha), which for a pixel of SPLASH_FULL_CHROMA
 * fades from 1 to 0 over the softness's worth of degrees centered on the
 * range's edge (half the width from the kept hue).
 */
export function splashMatrices(s: ColorSplash): { turn: string; mask: string } {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const h = rad(s.hue)
  const half = rad(clamp(s.width, MIN_SPLASH_WIDTH, MAX_SPLASH_WIDTH) / 2)
  const fade = clamp(rad((s.softness / 100) * (s.width / 2)), rad(0.5), Math.PI / 2)
  // the fade straddles the edge, so the range looks as wide at any softness
  const w = Math.min(half + fade / 2, Math.PI)
  const r3 = Math.sqrt(3) / 2
  const cos = Math.cos(h)
  const sin = Math.sin(h)
  // the wheel turned by -hue: along = a cos + b sin, across = -a sin + b cos
  const along = [cos, -cos / 2 + r3 * sin, -cos / 2 - r3 * sin]
  const across = [-sin, sin / 2 + r3 * cos, sin / 2 - r3 * cos]
  const turn = [
    [...along.map((k) => k / 2), 0, 0.5],
    [...across, 0, 0],
    [...across.map((k) => -k), 0, 0],
    [0, 0, 0, 1, 0],
  ]
  // alpha = gain (sin(w) (2R - 1) - cos(w) (G + B))
  const gain = 1 / (SPLASH_FULL_CHROMA * Math.sin(fade))
  const mask = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [2 * Math.sin(w) * gain, -Math.cos(w) * gain, -Math.cos(w) * gain, 0, -Math.sin(w) * gain],
  ]
  const values = (m: number[][]) => m.map((row) => row.map((v) => +v.toFixed(5)).join(' ')).join('  ')
  return { turn: values(turn), mask: values(mask) }
}

/** A photo's effects as drawn: its own levels, color balance and color splash, or else the project's. */
export function effectiveEffects(e: PhotoEffects): DrawnEffects {
  const own = <T>(value: T | typeof NONE | null, global: T | null) => (value === NONE ? null : (value ?? global))
  return {
    ...e,
    levels: own(e.levels, store.photoFilters.levels),
    colorBalance: own(e.colorBalance, store.photoFilters.colorBalance),
    colorSplash: own(e.colorSplash, store.photoFilters.colorSplash),
  }
}

/** Whether the photo needs its filter (blur, or levels, color balance or a color splash that change something). */
export function hasPhotoFilter(e: PhotoEffects): boolean {
  const { blur, levels, colorBalance, colorSplash } = effectiveEffects(e)
  return blur > 0 || changesTones(levels) || changesColor(colorBalance) || (colorSplash?.desaturate ?? 0) > 0
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

/** The settings levels, color balance and color splash can come from: a photo's own, or the project's (for all photos). */
export type ToneFilters = Pick<PhotoEffects, 'levels' | 'colorBalance' | 'colorSplash'>

/**
 * Levels, color balance and overlays that were switched off (to Off or
 * None, or a photo's to Global or None), by whose they were (memoryKey) and which:
 * switching back on brings them back. Kept only while the app runs, never
 * saved.
 */
const switchedOff = new Map<string, unknown>()

/** a deep copy, so settings put aside or copied don't change with the original */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/**
 * The menu entries for levels and color balance. The project's ('global')
 * switch each Off and On; a photo's ('local') switch between none at all
 * (None), having its own (Local) and following the project's (Global).
 * Switched back on, they're as they were when switched off this session,
 * else a photo's start from the project's. memoryKey tells whose they are ('global', or the photo's
 * panel or close-up id), as the settings objects change on undo.
 */
export function toneEntries(
  target: ToneFilters,
  mode: 'global' | 'local',
  shown: () => boolean,
  memoryKey: string,
): MenuEntry[] {
  // the settings set here, or null while off or following the project's
  const own = <K extends keyof ToneFilters>(field: K) => {
    const value = target[field]
    return value === NONE ? null : (value as Exclude<ToneFilters[K], typeof NONE>)
  }
  const levels = () => own('levels') ?? FULL_LEVELS
  const setLevels = (change: Partial<Levels>) => (target.levels = { ...levels(), ...change })
  const setSplash = (change: Partial<ColorSplash>) => {
    const splash = own('colorSplash')
    if (splash) Object.assign(splash, change)
  }
  // the row's choices: off (following the project's, or none, for a photo) or set here
  function switchOptions<K extends keyof ToneFilters>(
    field: K,
    start: () => NonNullable<Exclude<ToneFilters[K], typeof NONE>>,
    what: string,
  ) {
    const local = mode === 'local'
    const memory = `${memoryKey}:${field}`
    const What = `${what[0]!.toUpperCase()}${what.slice(1)}`
    // switching off to null or NONE puts the photo's own aside
    const switchOff = (value: null | typeof NONE) => {
      if (target[field] === value) return
      if (own(field) !== null) switchedOff.set(memory, copy(target[field]))
      target[field] = value as ToneFilters[K]
    }
    const off: MenuChoice = {
      label: local ? 'Global' : 'Off',
      title: local ? "Follow the project's (in the sidebar's Filters section)" : undefined,
      active: () => target[field] === null,
      pick: () => switchOff(null),
    }
    const on: MenuChoice = {
      label: local ? 'Local' : 'On',
      title: local ? `${What}, for this photo only` : `${What}, for all photos without a local one`,
      active: () => own(field) !== null,
      pick: () => {
        if (own(field) !== null) return
        target[field] = copy((switchedOff.get(memory) as ToneFilters[K] | undefined) ?? start())
      },
    }
    const none: MenuChoice = {
      label: 'None',
      title: "Off for this photo, whatever the project's",
      active: () => target[field] === NONE,
      pick: () => switchOff(NONE),
    }
    const options = local ? [none, on, off] : [off, on]
    return options
  }
  return [
    {
      kind: 'group',
      label: 'Levels',
      fold: true,
      visible: shown,
      on: () => own('levels') !== null,
      summary: () => {
        const l = levels()
        return `in ${l.inLow}–${l.inHigh} · out ${l.outLow}–${l.outHigh}`
      },
      options: switchOptions(
        'levels',
        () => store.photoFilters.levels ?? FULL_LEVELS,
        'black and white points, as in Krita',
      ),
      entries: [
        {
          kind: 'range',
          label: 'Input',
          title: 'The tones that become black and white; those beyond are clipped',
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
          min: 0,
          max: 255,
          minGap: 0,
          value: () => [levels().outLow, levels().outHigh],
          set: ([outLow, outHigh]) => setLevels({ outLow, outHigh }),
        },
      ],
    },
    {
      kind: 'group',
      label: 'Color balance',
      fold: true,
      visible: shown,
      on: () => own('colorBalance') !== null,
      summary: () => {
        const b = own('colorBalance')
        const signed = (v: number) => (v > 0 ? `+${v}` : String(v))
        const shifted = TONE_RANGES.filter((r) => b?.[r.value].some((v) => v !== 0))
        return shifted.map((r) => `${r.label.toLowerCase()} ${b![r.value].map(signed).join(' ')}`).join(' · ') || 'no shift yet'
      },
      options: switchOptions(
        'colorBalance',
        () => store.photoFilters.colorBalance ?? neutralBalance(),
        'color shifts for shadows, midtones and highlights, as in Krita',
      ),
      entries: [
        {
          kind: 'choices',
          label: 'Tones',
          options: TONE_RANGES.map((r) => ({
            // a dot marks the ranges that have been shifted
            label: () => (own('colorBalance')?.[r.value].some((v) => v !== 0) ? `${r.label}•` : r.label),
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
            min: -MAX_BALANCE,
            max: MAX_BALANCE,
            unit: '',
            track: axis.track,
            resetValue: 0,
            value: () => own('colorBalance')?.[balanceRange.value][ch] ?? 0,
            set: (v) => {
              const b = own('colorBalance')
              if (b) b[balanceRange.value][ch] = Math.round(clamp(v, -MAX_BALANCE, MAX_BALANCE))
            },
          }),
        ),
        {
          kind: 'choices',
          label: 'Luminosity',
          options: [
            {
              label: 'Keep',
              title: "Keep each pixel's lightness, only its color shifts (Krita's Preserve Luminosity)",
              active: () => !!own('colorBalance')?.preserveLuminosity,
              pick: () => {
                const b = own('colorBalance')
                if (b) b.preserveLuminosity = true
              },
            },
            {
              label: 'Let change',
              title: 'The shift can also lighten or darken the photo',
              active: () => own('colorBalance')?.preserveLuminosity === false,
              pick: () => {
                const b = own('colorBalance')
                if (b) b.preserveLuminosity = false
              },
            },
          ],
        },
      ],
    },
    {
      kind: 'group',
      label: 'Color splash',
      fold: true,
      visible: shown,
      on: () => own('colorSplash') !== null,
      summary: () => {
        const c = own('colorSplash')
        return c ? `hue ${c.hue}° · ${c.width}° wide · ${c.desaturate}% gray` : ''
      },
      options: switchOptions(
        'colorSplash',
        () => store.photoFilters.colorSplash ?? defaultSplash(),
        'gray except for one range of colors',
      ),
      entries: [
        {
          kind: 'slider',
          label: 'Hue',
          title: 'The color kept',
          min: 0,
          max: 359,
          unit: '°',
          track: HUE_TRACK,
          value: () => own('colorSplash')?.hue ?? 0,
          set: (deg) => setSplash({ hue: Math.round(((deg % 360) + 360) % 360) }),
        },
        {
          kind: 'slider',
          label: 'Width',
          title: 'How wide a range of hues around it is kept',
          min: MIN_SPLASH_WIDTH,
          max: MAX_SPLASH_WIDTH,
          unit: '°',
          value: () => own('colorSplash')?.width ?? 0,
          set: (deg) => setSplash({ width: Math.round(clamp(deg, MIN_SPLASH_WIDTH, MAX_SPLASH_WIDTH)) }),
        },
        {
          kind: 'slider',
          label: 'Softness',
          title: 'How gradually the kept colors fade into gray at the edges of the range',
          min: 0,
          max: 100,
          unit: '%',
          value: () => own('colorSplash')?.softness ?? 0,
          set: (pct) => setSplash({ softness: Math.round(clamp(pct, 0, 100)) }),
        },
        {
          kind: 'slider',
          label: 'Gray',
          title: 'How gray the other colors get',
          min: 0,
          max: 100,
          unit: '%',
          value: () => own('colorSplash')?.desaturate ?? 0,
          set: (pct) => setSplash({ desaturate: Math.round(clamp(pct, 0, 100)) }),
        },
      ],
    },
  ]
}

/**
 * The right-click menu entries for a photo's effects (and its mirroring and
 * rotation, about `middle`, its box's middle), shown while it has a photo.
 */
export function photoMenuEntries(
  target: PhotoEffects,
  frame: () => ImageFrame | null,
  middle: () => [number, number],
  /** the panel's or close-up's id */
  id: number,
): MenuEntry[] {
  const memoryKey = `photo-${id}`
  const hasPhoto = () => frame() !== null
  // like levels and color balance, an overlay set to None this session comes back as it was
  const memory = `${memoryKey}:overlay`
  const set = (change: Partial<ImageOverlay>) => {
    const fresh: ImageOverlay = { from: 'top', angle: 0, color: BLACK, ...DEFAULT_OVERLAY }
    const start = target.overlay ?? (switchedOff.get(memory) as ImageOverlay | undefined) ?? fresh
    target.overlay = { ...copy(start), ...change }
  }
  const setNone = () => {
    if (target.overlay === null) return
    switchedOff.set(memory, copy(target.overlay))
    target.overlay = null
  }
  return [
    { kind: 'separator', visible: hasPhoto },
    {
      kind: 'group',
      label: 'Photo',
      visible: hasPhoto,
      entries: [
        {
          kind: 'slider',
          label: 'Blur',
          min: 0,
          max: MAX_BLUR,
          value: () => target.blur,
          set: (px) => (target.blur = Math.round(clamp(px, 0, MAX_BLUR))),
        },
        {
          kind: 'slider',
          label: 'Rotation',
          title: `Turn the photo; Shift snaps to ${ROTATE_SNAP}°, double-click for 0`,
          min: -180,
          max: 180,
          unit: '°',
          resetValue: 0,
          resetTitle: 'Reset rotation',
          shiftSnap: ROTATE_SNAP,
          value: () => Math.round(frame()?.rotation ?? 0),
          set: (deg) => {
            const f = frame()
            if (f) rotateFrame(f, turnDegrees(Math.round(deg)), ...middle())
          },
        },
        {
          kind: 'choices',
          label: 'Mirror',
          options: [false, true].map((mirror) => ({
            label: mirror ? 'On' : 'Off',
            title: mirror ? 'Flip the photo left to right' : undefined,
            active: () => !!frame()?.mirror === mirror,
            pick: () => {
              const f = frame()
              if (f) f.mirror = mirror
            },
          })),
        },
      ],
    },
    {
      kind: 'group',
      label: 'Overlay',
      fold: true,
      visible: hasPhoto,
      on: () => target.overlay !== null,
      summary: () => {
        const o = target.overlay
        return o ? `${o.from} · ${Math.round(o.angle)}° · size ${o.size}% · strength ${o.strength}%` : ''
      },
      options: [
        { label: 'None', active: () => target.overlay === null, pick: setNone },
        ...OVERLAY_FROM.map((f) => ({
          label: f.label,
          title: `A color fading from the ${f.value}`,
          active: () => target.overlay?.from === f.value,
          pick: () => set({ from: f.value }),
        })),
      ],
      entries: [
        {
          kind: 'slider',
          label: 'Angle',
          title: 'Turn the fade',
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
          min: 5,
          max: 100,
          unit: '%',
          value: () => Math.round(target.overlay?.size ?? DEFAULT_OVERLAY.size),
          set: (pct) => set({ size: clamp(pct, 5, 100) }),
        },
        {
          kind: 'slider',
          label: 'Strength',
          min: 5,
          max: 100,
          unit: '%',
          value: () => Math.round(target.overlay?.strength ?? DEFAULT_OVERLAY.strength),
          set: (pct) => set({ strength: clamp(pct, 5, 100) }),
        },
        {
          kind: 'color',
          label: 'Color',
          ownKey: `overlay:${id}`,
          value: () => target.overlay?.color ?? BLACK,
          set: (color) => set({ color: color ?? BLACK }),
        },
      ],
    },
    // last, as they can come from the project's settings
    ...toneEntries(target, 'local', hasPhoto, memoryKey),
  ]
}
