<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import PhotoFilter from './PhotoFilter.vue'
import { CLOSE_UP_PLACEHOLDER_COLOR } from '@/lib/constants'
import { openContextMenu } from '@/lib/contextMenu'
import { hasPhotoFilter, overlayBackground, photoMenuEntries } from '@/lib/photoEffects'
import { NO_EXPORT_ATTR } from '@/lib/exportImage'
import { firstDroppedFile, frameTransformInRoundBox, roundBoxTransform, roundBoxUndo, zoomFrame } from '@/lib/imageFrame'
import { addImageFile } from '@/lib/images'
import { clamp } from '@/lib/math'
import { screenCenter, trackPointer } from '@/lib/pointer'
import {
  closeUpBounds,
  dividerStageWidth,
  duplicateElement,
  outlineStyle,
  removeElement,
  selectElement,
  setCircleImage,
  store,
  type CircleElement,
} from '@/lib/store'

const MIN_D = 60
const MAX_D = 700
// pointer travel (screen px) below which a press counts as a click, not a drag
const CLICK_SLOP = 4
// how far (screen px) inside and outside the ring a press still grabs the border,
// so even a thin or zero-width ring is easy to catch
const EDGE_SLOP = 7
// resize cursors for the eight compass directions, starting east, clockwise (y down)
const EDGE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']

const { element: el } = defineProps<{
  element: CircleElement
}>()

const rootEl = useTemplateRef('root')
const fileInput = useTemplateRef('fileInput')
let dragged = false
const selected = computed(() => store.selectedId === el.id)
const cursor = ref<string>()

// Kept inside the border: clip to the page's inner area, expressed in this
// element's own coordinates (the polygon may extend past the element's box,
// which is fine; only the part over the border gets cut).
const clipPath = computed(() => {
  const b = closeUpBounds.value
  if (!b) return undefined
  const l = b.left - el.x
  const t = b.top - el.y
  const r = b.right - el.x
  const btm = b.bottom - el.y
  return `polygon(${l}px ${t}px, ${r}px ${t}px, ${r}px ${btm}px, ${l}px ${btm}px)`
})

/** The resize cursor if the pointer is on the border band, else undefined. */
function edgeCursor(e: PointerEvent): string | undefined {
  const rect = rootEl.value!.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
  const photoR = rect.width / 2
  const ringR = photoR + dividerStageWidth.value * store.displayScale
  if (dist < photoR - EDGE_SLOP || dist > ringR + EDGE_SLOP) return undefined
  const octant = Math.round(Math.atan2(e.clientY - cy, e.clientX - cx) / (Math.PI / 4))
  return EDGE_CURSORS[((octant % 4) + 4) % 4]
}

function onHover(e: PointerEvent) {
  cursor.value = e.ctrlKey ? undefined : edgeCursor(e)
}

// Dragging the border resizes; elsewhere a plain drag moves the circle and
// Ctrl+drag pans the photo inside it.
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return // right-click opens the menu instead
  selectElement(el.id)
  if (!e.ctrlKey && edgeCursor(e)) {
    dragged = true // a border press never counts as a click on the photo
    onResize(e)
    return
  }
  const panPhoto = e.ctrlKey
  dragged = false
  let travel = 0
  trackPointer(e, (dx, dy) => {
    travel += Math.hypot(dx, dy)
    if (travel > CLICK_SLOP) dragged = true
    const s = store.displayScale
    if (panPhoto) {
      if (el.frame) {
        el.frame.tx += dx / s
        el.frame.ty += dy / s
      }
    } else {
      el.x += dx / s
      el.y += dy / s
    }
  })
}

// Resizes around the circle's center, proportional to the pointer's distance
// from it. The photo scales along with the circle, so the close-up keeps the
// same framing and just gets bigger or smaller.
function onResize(e: PointerEvent) {
  const { cx, cy } = screenCenter(rootEl.value!)
  const centerX = el.x + el.d / 2
  const centerY = el.y + el.d / 2
  const startD = el.d
  const startDist = Math.hypot(e.clientX - cx, e.clientY - cy)
  // scale from the values at the start of the drag, so repeated moves don't drift
  const startFrame = el.frame && { ...el.frame }
  trackPointer(e, (_dx, _dy, ev) => {
    const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy)
    el.d = clamp(startD * (dist / startDist), MIN_D, MAX_D)
    el.x = centerX - el.d / 2
    el.y = centerY - el.d / 2
    // frame offsets are relative to the circle's top-left, so scaling them
    // with the zoom keeps every point of the photo at the same relative spot
    if (el.frame && startFrame && el.frame.imageId === startFrame.imageId) {
      const k = el.d / startD
      el.frame.scale = startFrame.scale * k
      el.frame.baseScale = startFrame.baseScale * k
      el.frame.tx = startFrame.tx * k
      el.frame.ty = startFrame.ty * k
    }
  })
}

function onWheel(e: WheelEvent) {
  if (el.frame) zoomFrame(el.frame, e.deltaY, el.d / 2, el.d / 2)
}

// an empty close-up opens the file picker on a plain click
function onClick() {
  if (!el.frame && !dragged) fileInput.value?.click()
}

function onContextMenu(e: MouseEvent) {
  selectElement(el.id)
  openContextMenu(e, [
    {
      kind: 'actions',
      items: [
        { label: el.frame ? 'Change image…' : 'Set image…', icon: 'image', action: () => fileInput.value?.click() },
        { label: 'Remove image', icon: 'close', danger: true, visible: () => !!el.frame, action: () => (el.frame = null) },
      ],
    },
    ...photoMenuEntries(el, () => el.frame, () => [el.d / 2, el.d / 2], el.id),
    { kind: 'separator' },
    { label: 'Duplicate', icon: 'duplicate', action: () => duplicateElement(el.id) },
    { label: 'Delete close-up', icon: 'trash', danger: true, action: () => removeElement(el.id) },
  ])
}

function onFileChosen() {
  const input = fileInput.value!
  useFile(input.files?.[0])
  input.value = ''
}

function onDrop(e: DragEvent) {
  useFile(firstDroppedFile(e))
}

async function useFile(file: File | undefined) {
  if (!file) return
  try {
    await setCircleImage(el, await addImageFile(file))
  } catch {
    alert(`Couldn't load "${file.name}" as an image.`)
  }
}
</script>

<template>
  <div
    ref="root"
    class="circle"
    :class="{ selected }"
    :style="{
      left: `${el.x}px`,
      top: `${el.y}px`,
      width: `${el.d}px`,
      height: `${el.d}px`,
      zIndex: el.z,
      cursor,
      clipPath,
    }"
    @pointerdown.stop="onPointerDown"
    @pointermove="onHover"
    @pointerleave="cursor = undefined"
    @click="onClick"
    @contextmenu="onContextMenu"
    @wheel.prevent.stop="onWheel"
    @dragover.prevent
    @drop.prevent.stop="onDrop"
  >
    <!-- Layers are stacked solid discs (outline, ring, photo) rather than
         border + outline, so each anti-aliased edge blends with the disc
         underneath instead of letting the page show through as a hairline
         gap. -->
    <!-- invisible grab zone reaching a little past the ring, so the border is easy to catch -->
    <div
      class="edge-hit"
      :style="{ inset: `${-(dividerStageWidth + EDGE_SLOP / store.displayScale)}px` }"
      v-bind="{ [NO_EXPORT_ATTR]: '' }"
    />
    <div
      v-if="outlineStyle"
      class="disc"
      :class="{ shadowed: store.closeUps.shadow }"
      :style="{ inset: `${-(dividerStageWidth + outlineStyle.width)}px`, background: outlineStyle.color }"
    />
    <div
      class="disc"
      :class="{ shadowed: store.closeUps.shadow && !outlineStyle }"
      :style="{ inset: `${-dividerStageWidth}px`, background: store.border.color }"
    />
    <!-- the placeholder fill only when empty: behind a photo it would bleed through the clipped edge -->
    <!-- A mirrored or turned photo is shown by flipping and turning this
         whole circle (the same circle) rather than the photo inside it:
         browsers could drop the circle's clip around a flipped or turned
         photo at some zoom levels. The overlay is turned back, so it
         doesn't change. -->
    <div
      class="clip"
      :style="{
        background: el.frame ? undefined : CLOSE_UP_PLACEHOLDER_COLOR,
        transform: el.frame ? roundBoxTransform(el.frame) : undefined,
      }"
    >
      <svg v-if="el.frame && hasPhotoFilter(el)" class="filter-defs" aria-hidden="true">
        <PhotoFilter :id="`photo-filter-circle-${el.id}`" :effects="el" :frame="el.frame" />
      </svg>
      <img
        v-if="el.frame"
        :src="el.frame.src"
        :style="{
          transform: frameTransformInRoundBox(el.frame, el.d, el.d),
          filter: hasPhotoFilter(el) ? `url(#photo-filter-circle-${el.id})` : undefined,
        }"
        draggable="false"
      />
      <span v-else class="hint" v-bind="{ [NO_EXPORT_ATTR]: '' }">Click or drop<br />an image</span>
      <div
        v-if="el.frame && el.overlay"
        class="overlay"
        :style="{ background: overlayBackground(el.overlay), transform: roundBoxUndo(el.frame) }"
      />
    </div>
    <!-- inner outline drawn over the photo's edge; the ring disc below it is opaque, so no gap -->
    <div
      v-if="outlineStyle"
      class="inner-outline"
      :style="{ borderWidth: `${outlineStyle.width}px`, borderColor: outlineStyle.color }"
    />
    <!-- marks the selected close-up, just outside its ring -->
    <div
      v-if="selected"
      class="selection"
      :style="{ inset: `${-(dividerStageWidth + (outlineStyle?.width ?? 0) + 5)}px` }"
      v-bind="{ [NO_EXPORT_ATTR]: '' }"
    />
    <input ref="fileInput" type="file" accept="image/*" v-bind="{ [NO_EXPORT_ATTR]: '' }" @change="onFileChosen" />
  </div>
</template>

<style scoped lang="scss">
.circle {
  position: absolute;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.edge-hit,
.disc,
.clip,
.inner-outline,
.selection {
  position: absolute;
  border-radius: 50%;
}

// the shadow goes on whichever disc is outermost
.shadowed {
  box-shadow: 0 6px 16px rgba(20, 14, 30, 0.35);
}

// transparent, only there to catch presses just outside the ring
.edge-hit {
  background: transparent;
}

.selection {
  @include selection-mark(16px);
}

.inner-outline {
  inset: 0;
  border-style: solid;
  pointer-events: none;
}

.clip {
  inset: 0;
  overflow: hidden;
  // Also clipped to the circle outright: the rounded corners alone (with
  // overflow hidden) don't always cut off a photo the browser draws as a
  // layer of its own, as it may a mirrored or filtered one, and it could
  // then show outside the circle at some zoom levels.
  clip-path: circle(50%);

  img {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    max-width: none;
    -webkit-user-drag: none;
    pointer-events: none;
  }

  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .filter-defs {
    position: absolute;
    width: 0;
    height: 0;
  }
}

.hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.85rem;
  color: rgba($ink, 0.6);
  pointer-events: none;
}

input[type='file'] {
  display: none;
}
</style>
