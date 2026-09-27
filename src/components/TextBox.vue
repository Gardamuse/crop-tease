<script setup lang="ts">
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'

import {
  FONT_SIZE_STEPS,
  MAX_TYPED_FONT_PX,
  MIN_TYPED_FONT_PX,
  TAIL_POSITIONS,
  TEXT_PALETTE,
  TEXT_STYLES,
  type TailPosition,
} from '@/lib/constants'
import { openContextMenu, type MenuEntry } from '@/lib/contextMenu'
import { NO_EXPORT_ATTR } from '@/lib/exportImage'
import { screenCenter, trackPointer } from '@/lib/pointer'
import { clamp } from '@/lib/math'
import { removeElement, selectElement, stageSize, store, type TextElement } from '@/lib/store'

const MIN_W = 60
const MIN_H = 30
// arrows for the tail compass in the menu
const TAIL_ARROWS: Record<TailPosition, string> = {
  'top-left': '↖',
  top: '↑',
  'top-right': '↗',
  left: '←',
  right: '→',
  'bottom-left': '↙',
  bottom: '↓',
  'bottom-right': '↘',
}
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

// The face is contenteditable, so its text is written once here and read
// back on blur rather than rendered by Vue (which would fight the caret).
onMounted(() => {
  faceEl.value!.textContent = el.text
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

// rotates by how far the pointer turns around the box's center
function rotate(e: PointerEvent) {
  const { cx, cy } = screenCenter(rootEl.value!)
  const angle = (ev: PointerEvent) => (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI
  const startAngle = angle(e)
  const startRot = el.rot
  trackPointer(e, (_dx, _dy, ev) => {
    el.rot = startRot + angle(ev) - startAngle
  })
}

async function startEdit() {
  editing.value = true
  cursor.value = undefined
  await nextTick()
  const face = faceEl.value!
  face.focus()
  const range = document.createRange()
  range.selectNodeContents(face)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function stopEdit() {
  editing.value = false
  el.text = faceEl.value!.innerText
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
      columns: 3,
      // compass layout with an empty middle
      options: [...TAIL_POSITIONS.slice(0, 4), null, ...TAIL_POSITIONS.slice(4)].map(
        (pos) =>
          pos && {
            label: TAIL_ARROWS[pos],
            title: `Tail ${pos.replace('-', ' ')}`,
            active: () => el.tail === pos,
            pick: () => (el.tail = pos),
          },
      ),
    },
    {
      // shown in output pixels, like the border and divider widths; the
      // slider snaps to steps, the box takes any value
      kind: 'slider',
      label: 'Size',
      min: MIN_TYPED_FONT_PX,
      max: MAX_TYPED_FONT_PX,
      steps: FONT_SIZE_STEPS,
      value: () => Math.round(el.fontSize * stageSize.value.exportScale),
      set: (px) => (el.fontSize = clamp(px, MIN_TYPED_FONT_PX, MAX_TYPED_FONT_PX) / stageSize.value.exportScale),
    },
    {
      kind: 'choices',
      label: 'Color',
      options: TEXT_PALETTE.map((c) => ({
        label: c,
        swatch: c,
        active: () => el.color.toLowerCase() === c,
        pick: () => (el.color = c),
      })),
    },
    { kind: 'separator' },
    { label: 'Edit text', icon: '✎', action: startEdit },
  ]
  if (Math.abs(el.rot) > 0.01) entries.push({ label: 'Reset rotation', icon: '⟲', action: () => (el.rot = 0) })
  entries.push({ label: 'Delete text', icon: '🗑', danger: true, action: () => removeElement(el.id) })
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
    <div
      ref="face"
      class="face"
      :class="`style-${el.style}`"
      :contenteditable="editing"
      :style="{ fontSize: `${el.fontSize}px`, color: el.color }"
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

.face {
  position: absolute;
  inset: 0;
  outline: none;
  overflow: hidden;
  padding: 14px 18px;
  font-family: $ui-font;
  font-weight: 800;
  line-height: 1.25;
  text-align: center;

  &[contenteditable='true'] {
    cursor: text;
    box-shadow: 0 0 0 3px $teal inset;
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
    font-family: $caption-font;
    font-style: italic;
    font-weight: 700;
    line-height: 1.3;
    text-align: left;
  }

  // a rounded bubble (its tail is the separate .tail element)
  &.style-speech {
    padding: 16px 20px;
    background: $paper;
    border: 4px solid $ink;
    border-radius: 26px;
  }
}

$bubble-border: 4px;
$tail-inset: 26px; // distance of a corner tail from the bubble's side

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
}

.tail-ink {
  fill: $ink;
}

.tail-paper {
  fill: $paper;
}
</style>
