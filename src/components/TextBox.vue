<script lang="ts">
/** texts' own colors put aside by linking them to the project's, by text id; kept while the app runs */
const setAsideColors = new Map<number, string>()
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import {
  FONT_SIZE_STEPS,
  BLACK,
  MAX_TYPED_FONT_PX,
  MIN_TYPED_FONT_PX,
  TEXT_STYLES,
  type TailPosition,
} from '@/lib/constants'
import { openContextMenu, type MenuEntry } from '@/lib/contextMenu'
import { NO_EXPORT_ATTR } from '@/lib/exportImage'
import UiIcon from './UiIcon.vue'
import { screenCenter, trackPointer } from '@/lib/pointer'
import { clamp, ROTATE_SNAP, turnDegrees } from '@/lib/math'
import { fontChoices, fontVars, isMissing, previewFamily, resolveFont } from '@/lib/textFonts'
import {
  pageNumberText,
  duplicateElement,
  removeElement,
  selectElement,
  stageSize,
  store,
  textColor,
  textFontSize,
  textOutline,
  type TextElement,
} from '@/lib/store'

const MIN_W = 60
const MIN_H = 30
// arrows for the tail picker in the menu, the way each tail points
const TAIL_ARROWS: Record<TailPosition, string> = {
  'top-left': '↑',
  top: '↑',
  'top-right': '↑',
  'right-top': '→',
  right: '→',
  'right-bottom': '→',
  'bottom-right': '↓',
  bottom: '↓',
  'bottom-left': '↓',
  'left-bottom': '←',
  left: '←',
  'left-top': '←',
}
// the tail picker, laid out like the bubble: the side edges' spots in the
// outer columns, the top and bottom edges' spots in the rows between
const TAIL_GRID: (TailPosition | null)[] = [
  'left-top', 'top-left', 'top', 'top-right', 'right-top',
  'left', null, null, null, 'right',
  'left-bottom', 'bottom-left', 'bottom', 'bottom-right', 'right-bottom',
]
// how far (screen px) inside and outside the box edge a press grabs the edge
const EDGE_SLOP = 7
// resize cursors by direction, starting east, going clockwise (y down)
const EDGE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']

const { element: el } = defineProps<{
  element: TextElement
}>()

const rootEl = useTemplateRef('root')
const faceEl = useTemplateRef('face')
const editing = ref(false)
const cursor = ref<string>()

// Unframed text gets a thin black or white outline (whichever contrasts
// with its color), stroked around the letters. The stroke is painted
// behind the fill, so only its outer half shows: doubling the width gives
// an outline of the intended thickness.
const faceStyle = computed(() => {
  const outline = el.style === 'none' && el.outline ? textOutline(textColor(el)) : null
  return {
    ...(el.font && fontVars(el.font)), // its own font if available, else the project's (set on the page)
    fontSize: `${textFontSize(el)}px`, // its own size if set, else the project's
    color: textColor(el),
    ...(outline && { WebkitTextStroke: `${outline.width * 2}px ${outline.color}`, paintOrder: 'stroke fill' }),
  }
})

// The face is contenteditable, so its text is written once here and read
// back on blur rather than rendered by Vue (which would fight the caret).
// The page-number text stores a template ({n}, {total}) and shows it filled
// in for the current page; while being edited it shows the template itself.
const isPageNumber = computed(() => store.pageNumber?.id === el.id)
// while selected (and not being edited), a dashed line marks the text: on
// the box's edges for unframed text, which has no visible edge, and just
// outside the frame otherwise
const showBounds = computed(() => store.selectedId === el.id && !editing.value)
const shownText = computed(() => (isPageNumber.value ? pageNumberText(el.text, store.pageIndex) : el.text))

onMounted(() => {
  faceEl.value!.textContent = shownText.value
})

// e.g. the page number changes when pages are reordered
watch(shownText, (text) => {
  if (!editing.value) faceEl.value!.textContent = text
})

/**
 * Which edge(s) the pointer is on, as (hx, hy) in the box's own unrotated
 * frame: -1 left/top, 1 right/bottom, 0 neither. Null when not on an edge.
 */
function edgeAt(e: PointerEvent): { hx: number; hy: number } | null {
  const { cx, cy } = screenCenter(rootEl.value!)
  const s = store.displayScale
  const rad = (-el.rot * Math.PI) / 180
  // pointer relative to the center, rotated into the box's frame, in screen px
  const px = e.clientX - cx
  const py = e.clientY - cy
  const lx = px * Math.cos(rad) - py * Math.sin(rad)
  const ly = px * Math.sin(rad) + py * Math.cos(rad)
  const halfW = (el.w * s) / 2
  const halfH = (el.h * s) / 2
  if (Math.abs(lx) > halfW + EDGE_SLOP || Math.abs(ly) > halfH + EDGE_SLOP) return null
  const hx = Math.abs(lx) >= halfW - EDGE_SLOP ? Math.sign(lx) : 0
  const hy = Math.abs(ly) >= halfH - EDGE_SLOP ? Math.sign(ly) : 0
  return hx || hy ? { hx, hy } : null
}

function edgeCursor(edge: { hx: number; hy: number }): string {
  const angle = Math.atan2(edge.hy, edge.hx) + (el.rot * Math.PI) / 180
  const octant = Math.round(angle / (Math.PI / 4))
  return EDGE_CURSORS[((octant % 4) + 4) % 4]!
}

function onHover(e: PointerEvent) {
  if (editing.value || e.ctrlKey) {
    cursor.value = undefined
    return
  }
  const edge = edgeAt(e)
  cursor.value = edge ? edgeCursor(edge) : undefined
}

// Dragging the edge resizes; elsewhere a plain drag moves the text and
// Ctrl+drag rotates it. Double-click edits the text.
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return // right-click opens the menu instead
  selectElement(el.id)
  if (editing.value) return // let text selection / caret placement happen instead
  if (e.ctrlKey) return rotate(e)
  const edge = edgeAt(e)
  if (edge) return resize(e, edge)
  trackPointer(e, (dx, dy) => {
    el.x += dx / store.displayScale
    el.y += dy / store.displayScale
  })
}

// Resizes from the grabbed edge(s), keeping the opposite edge fixed on the
// page even when the box is rotated.
function resize(e: PointerEvent, { hx, hy }: { hx: number; hy: number }) {
  const rad = (el.rot * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  trackPointer(e, (dx, dy) => {
    dx /= store.displayScale
    dy /= store.displayScale
    // the drag in the box's own frame
    const ldx = dx * cos + dy * sin
    const ldy = -dx * sin + dy * cos
    const w = Math.max(MIN_W, el.w + hx * ldx)
    const h = Math.max(MIN_H, el.h + hy * ldy)
    // the center moves half the growth toward the grabbed edge, rotated back onto the page
    const sx = (hx * (w - el.w)) / 2
    const sy = (hy * (h - el.h)) / 2
    const cx = el.x + el.w / 2 + sx * cos - sy * sin
    const cy = el.y + el.h / 2 + sx * sin + sy * cos
    el.w = w
    el.h = h
    el.x = cx - w / 2
    el.y = cy - h / 2
  })
}

// rotates by how far the pointer turns around the box's center; with Shift
// held it snaps to steps of ROTATE_SNAP degrees
function rotate(e: PointerEvent) {
  const { cx, cy } = screenCenter(rootEl.value!)
  const angle = (ev: PointerEvent) => (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI
  const startAngle = angle(e)
  const startRot = el.rot
  trackPointer(e, (_dx, _dy, ev) => {
    const rot = startRot + angle(ev) - startAngle
    const snapped = ev.shiftKey ? Math.round(rot / ROTATE_SNAP) * ROTATE_SNAP : rot
    el.rot = turnDegrees(snapped)
  })
}

function onRotateHandle(e: PointerEvent) {
  if (e.button !== 0) return
  selectElement(el.id)
  rotate(e)
}

async function startEdit() {
  editing.value = true
  cursor.value = undefined
  await nextTick()
  const face = faceEl.value!
  if (isPageNumber.value) face.textContent = el.text
  face.focus()
  const range = document.createRange()
  range.selectNodeContents(face)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/**
 * The typed text, with \n line breaks. Pressing Enter makes the browser
 * wrap the new line in a <div> (Chrome) or add a <br> (Firefox), with a
 * placeholder <br> keeping an empty line open; innerText counts both the
 * line and its placeholder, adding a newline each time. Here each block
 * starts one line, and a <br> that ends its block is only a placeholder.
 */
function editedText(root: HTMLElement): string {
  let text = ''
  let started = false // anything seen yet, even an empty line
  let breakBefore = false // the last thing was a block, so what follows starts a line
  const isBlock = (n: Node) => n instanceof HTMLElement && getComputedStyle(n).display !== 'inline'
  const walk = (node: Node) => {
    node.childNodes.forEach((child, i) => {
      if (child.nodeType === Node.TEXT_NODE || child.nodeName === 'BR') {
        const isBr = child.nodeName === 'BR'
        if (!isBr && !child.nodeValue) return
        if (breakBefore) text += '\n'
        breakBefore = false
        started = true
        if (!isBr) text += child.nodeValue
        else if (i < node.childNodes.length - 1) text += '\n'
      } else if (isBlock(child)) {
        if (started && (breakBefore || !text.endsWith('\n'))) text += '\n'
        started = true
        breakBefore = false
        walk(child)
        breakBefore = true
      } else {
        walk(child)
      }
    })
  }
  walk(root)
  return text
}

function stopEdit() {
  editing.value = false
  const face = faceEl.value!
  el.text = editedText(face)
  face.textContent = shownText.value
  // while typing, the box may scroll to keep the caret in view; put it back
  // so the text always renders (and exports) from its normal position
  face.scrollTop = 0
  face.scrollLeft = 0
}

function onContextMenu(e: MouseEvent) {
  selectElement(el.id)
  const entries: MenuEntry[] = [
    {
      kind: 'choices',
      label: 'Style',
      options: TEXT_STYLES.map((s) => ({
        label: s.label,
        active: () => el.style === s.value,
        pick: () => (el.style = s.value),
      })),
    },
    {
      kind: 'choices',
      label: 'Tail',
      visible: () => el.style === 'speech',
      columns: 5,
      options: TAIL_GRID.map((pos) => {
        if (!pos) return null
        const [edge, end] = pos.split('-')
        return {
          label: TAIL_ARROWS[pos],
          title: end ? `Tail on the ${edge} edge, near the ${end}` : `Tail on the ${edge} edge`,
          active: () => el.tail === pos,
          pick: () => (el.tail = pos),
        }
      }),
    },
    {
      // shown in output pixels, like the border and divider widths; the
      // slider snaps to steps, the box takes any value; setting it gives the
      // text its own size, unlinking it from the project's
      kind: 'slider',
      label: 'Size',
      min: MIN_TYPED_FONT_PX,
      max: MAX_TYPED_FONT_PX,
      steps: FONT_SIZE_STEPS,
      value: () => Math.round(textFontSize(el) * stageSize.value.exportScale),
      set: (px) => (el.fontSize = clamp(px, MIN_TYPED_FONT_PX, MAX_TYPED_FONT_PX) / stageSize.value.exportScale),
      link: {
        linked: () => el.fontSize === null,
        // unlinking keeps the size it has now, as its own
        toggle: () => (el.fontSize = el.fontSize === null ? textFontSize(el) : null),
        linkedTitle: "Follows the project's text size (in the sidebar); move the slider to give this text its own",
        unlinkedTitle: "Has its own size; click to follow the project's text size again",
      },
    },
    {
      kind: 'slider',
      label: 'Rotation',
      title: `Turn the text (or drag the knob above it); Shift snaps to ${ROTATE_SNAP}°, double-click for 0`,
      min: -180,
      max: 180,
      unit: '°',
      resetValue: 0,
      resetTitle: 'Reset rotation',
      shiftSnap: ROTATE_SNAP,
      value: () => Math.round(el.rot),
      set: (deg) => (el.rot = turnDegrees(deg)),
    },
    {
      // picking a color gives the text its own, unlinking it from the project's
      kind: 'color',
      label: 'Color',
      ownKey: `text:${el.id}`,
      value: () => textColor(el),
      set: (color) => (el.color = color ?? BLACK),
      link: {
        linked: () => el.color === null,
        // linking puts its own color aside; unlinking brings that back, else keeps the color it shows now
        toggle: () => {
          if (el.color === null) el.color = setAsideColors.get(el.id) ?? textColor(el)
          else {
            setAsideColors.set(el.id, el.color)
            el.color = null
          }
        },
        linkedTitle: "Follows the project's text color (in the sidebar); pick a color to give this text its own",
        unlinkedTitle: "Has its own color; click to follow the project's text color again",
      },
    },
    {
      kind: 'select',
      label: 'Font',
      options: [
        { value: '', label: `Default (${resolveFont(store.textFont).label})`, fontFamily: previewFamily(store.textFont) },
        ...fontChoices.value.map((f) => ({ value: f.id, label: f.label, fontFamily: previewFamily(f.id) })),
        // a font this browser doesn't have stays listed, so the setting isn't lost
        ...(el.font && isMissing(el.font) ? [{ value: el.font, label: `${resolveFont(el.font).label} (missing)` }] : []),
      ],
      value: () => el.font ?? '',
      set: (v) => (el.font = v || null),
    },
    {
      kind: 'choices',
      label: 'Outline',
      visible: () => el.style === 'none',
      options: [
        {
          label: 'On',
          title: 'A black or white outline, whichever contrasts with the text',
          active: () => el.outline,
          pick: () => (el.outline = true),
        },
        { label: 'Off', active: () => !el.outline, pick: () => (el.outline = false) },
      ],
    },
    { kind: 'separator' },
    {
      label: isPageNumber.value ? 'Edit text ({n} = page number)' : 'Edit text',
      icon: 'edit',
      action: startEdit,
    },
  ]
  if (!isPageNumber.value) entries.push({ label: 'Duplicate', icon: 'duplicate', action: () => duplicateElement(el.id) })
  entries.push({
    label: isPageNumber.value ? 'Remove page numbers' : 'Delete text',
    icon: 'trash',
    danger: true,
    action: () => removeElement(el.id),
  })
  openContextMenu(e, entries)
}
</script>

<template>
  <div
    ref="root"
    class="text-box"
    :style="{
      left: `${el.x}px`,
      top: `${el.y}px`,
      width: `${el.w}px`,
      height: `${el.h}px`,
      transform: `rotate(${el.rot}deg)`,
      zIndex: el.z,
      cursor,
    }"
    @pointerdown.stop="onPointerDown"
    @pointermove="onHover"
    @pointerleave="cursor = undefined"
    @contextmenu="onContextMenu"
  >
    <!-- invisible grab zone reaching a little past the edge, so it's easy to catch -->
    <div class="edge-hit" :style="{ inset: `${-EDGE_SLOP / store.displayScale}px` }" v-bind="{ [NO_EXPORT_ATTR]: '' }" />
    <div v-if="showBounds" class="bounds" :class="{ framed: el.style !== 'none' }" v-bind="{ [NO_EXPORT_ATTR]: '' }" />
    <!-- drag to rotate; above the top edge, turning with the box -->
    <div
      v-if="showBounds"
      class="rotate-handle"
      :class="{ framed: el.style !== 'none' }"
      title="Drag to rotate (Shift snaps to 15°)"
      v-bind="{ [NO_EXPORT_ATTR]: '' }"
      @pointerdown.stop.prevent="onRotateHandle"
      @dblclick.stop="el.rot = 0"
    >
      <UiIcon name="rotate" />
    </div>
    <div
      ref="face"
      class="face"
      :class="`style-${el.style}`"
      :contenteditable="editing"
      :style="faceStyle"
      @dblclick.stop="startEdit"
      @blur="stopEdit"
    />
    <!-- The tail is drawn for the bottom-left spot and flipped/rotated into
         place. Its base sits on the inner edge of the bubble's border; the
         paper triangle covers that stretch of border so the tail opens into
         the bubble, leaving a 4px ink outline to match. -->
    <svg
      v-if="el.style === 'speech'"
      class="tail"
      :class="`tail-${el.tail}`"
      width="22"
      height="28"
      viewBox="0 0 22 28"
      aria-hidden="true"
    >
      <polygon class="tail-ink" points="0,0 22,0 2,28" />
      <!-- starts 1 unit inside the bubble so no anti-aliased seam shows where they meet -->
      <polygon class="tail-paper" points="3.94,-1 17.79,-1 5.2,16.64" />
    </svg>
  </div>
</template>

<style scoped lang="scss">
.text-box {
  position: absolute;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.edge-hit {
  position: absolute;
}

// A small round button above the top edge, joined to the selection mark by
// a slim line: white with an accent arrow, filling with the accent and
// glowing on hover, like the app's accent buttons.
.rotate-handle {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: -34px;
  width: 20px;
  height: 20px;
  margin-left: -10px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #fff;
  color: $accent-ink;
  font-size: 11px;
  box-shadow:
    0 0 0 1.5px $accent,
    0 2px 6px rgba($shade, 0.35);
  cursor: grab;
  animation: rotate-handle-in 0.15s ease-out;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;

  :deep(.ui-icon) {
    stroke-width: 2.6;
  }

  &:hover,
  &:active {
    background: $accent;
    color: #fff;
    box-shadow:
      0 0 0 1.5px $accent,
      0 0 12px $accent-dim;
  }

  &:active {
    cursor: grabbing;
  }

  // the line down to the selection mark
  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 100%;
    width: 1.5px;
    height: 14px;
    margin-left: -0.75px;
    background: linear-gradient($accent, rgba($accent, 0.4));
  }

  &.framed {
    top: -39px; // the mark sits 5px out from a frame
  }
}

@keyframes rotate-handle-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

// marks the selected text, on top of it
.bounds {
  position: absolute;
  inset: 0;
  z-index: 1;
  @include selection-mark;

  &.framed {
    inset: -5px; // a 3px gap outside the frame
  }
}

.face {
  position: absolute;
  inset: 0;
  outline: none;
  overflow: hidden;
  // the text is restored as plain text with \n line breaks; show them as breaks
  white-space: pre-wrap;
  padding: 14px 18px;
  // the project's text font (store.textFontVars), else the classic look
  font-family: var(--text-font, #{$ui-font});
  font-weight: var(--text-weight, 800);
  line-height: 1.25;
  text-align: center;

  // while editing, a dashed line shows the box's bounds (useful when unframed)
  &[contenteditable='true'] {
    cursor: text;
    outline: 2px dashed $teal;
    outline-offset: 3px;
  }

  // just the text
  &.style-none {
    padding: 4px 6px;
  }

  // a square caption box
  &.style-square {
    background: $paper;
    border: 4px solid $ink;
    border-radius: 4px;
    font-family: var(--caption-font, #{$caption-font});
    font-style: var(--caption-style, italic);
    font-weight: var(--caption-weight, 700);
    line-height: 1.3;
    text-align: left;
  }

  // a rounded bubble (its tail is the separate .tail element)
  &.style-speech {
    padding: 16px 20px;
    background: $paper;
    border: 4px solid $ink;
    border-radius: 26px;
    // centered vertically too; "safe" falls back to top-aligned when the
    // text overflows, so the first lines aren't cut off
    display: flex;
    flex-direction: column;
    justify-content: safe center;
  }
}

$bubble-border: 4px;
$tail-inset: 26px; // distance of a corner tail from the edge it's near

// Anchored at a point on the inner edge of the border, then flipped or
// rotated about that point (transform-origin 0 0) so it points outward.
.tail {
  position: absolute;
  overflow: visible;
  transform-origin: 0 0;

  &.tail-bottom-left {
    left: $tail-inset;
    top: calc(100% - #{$bubble-border});
  }
  &.tail-bottom {
    left: calc(50% - 11px);
    top: calc(100% - #{$bubble-border});
  }
  &.tail-bottom-right {
    left: calc(100% - #{$tail-inset});
    top: calc(100% - #{$bubble-border});
    transform: scaleX(-1);
  }
  &.tail-top-left {
    left: $tail-inset;
    top: $bubble-border;
    transform: scaleY(-1);
  }
  &.tail-top {
    left: calc(50% - 11px);
    top: $bubble-border;
    transform: scaleY(-1);
  }
  &.tail-top-right {
    left: calc(100% - #{$tail-inset});
    top: $bubble-border;
    transform: scale(-1, -1);
  }
  &.tail-left {
    left: $bubble-border;
    top: calc(50% - 11px);
    transform: rotate(90deg);
  }
  &.tail-right {
    left: calc(100% - #{$bubble-border});
    top: calc(50% + 11px);
    transform: rotate(-90deg);
  }
  // near a corner on the sides, leaning toward that corner
  &.tail-left-top {
    left: $bubble-border;
    top: $tail-inset;
    transform: rotate(90deg);
  }
  &.tail-left-bottom {
    left: $bubble-border;
    top: calc(100% - #{$tail-inset});
    transform: scaleY(-1) rotate(90deg);
  }
  &.tail-right-top {
    left: calc(100% - #{$bubble-border});
    top: $tail-inset;
    transform: scaleY(-1) rotate(-90deg);
  }
  &.tail-right-bottom {
    left: calc(100% - #{$bubble-border});
    top: calc(100% - #{$tail-inset});
    transform: rotate(-90deg);
  }
}

.tail-ink {
  fill: $ink;
}

.tail-paper {
  fill: $paper;
}
</style>
