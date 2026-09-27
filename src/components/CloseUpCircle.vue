<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import ElementHandle from './ElementHandle.vue'
import { CLOSE_UP_PLACEHOLDER_COLOR } from '@/lib/constants'
import { NO_EXPORT_ATTR } from '@/lib/exportImage'
import { firstDroppedFile, frameTransform, zoomFrame } from '@/lib/imageFrame'
import { addImageFile } from '@/lib/images'
import { clamp } from '@/lib/math'
import { screenCenter, trackPointer } from '@/lib/pointer'
import { dividerStageWidth, outlineStyle, removeElement, selectElement, setCircleImage, store, type CircleElement } from '@/lib/store'

const MIN_D = 60
const MAX_D = 700
// pointer travel (screen px) below which a press counts as a click, not a drag
const CLICK_SLOP = 4

const { element: el } = defineProps<{
  element: CircleElement
}>()

const rootEl = useTemplateRef('root')
const fileInput = useTemplateRef('fileInput')
let dragged = false
const selected = computed(() => store.selectedId === el.id)

// plain drag moves the circle; Ctrl+drag pans the photo inside it
function onPointerDown(e: PointerEvent) {
  selectElement(el.id)
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

// resizes around the circle's center, proportional to the pointer's distance from it
function onResize(e: PointerEvent) {
  const { cx, cy } = screenCenter(rootEl.value!)
  const centerX = el.x + el.d / 2
  const centerY = el.y + el.d / 2
  const startD = el.d
  const startDist = Math.hypot(e.clientX - cx, e.clientY - cy)
  trackPointer(e, (_dx, _dy, ev) => {
    const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy)
    el.d = clamp(startD * (dist / startDist), MIN_D, MAX_D)
    el.x = centerX - el.d / 2
    el.y = centerY - el.d / 2
  })
}

function onWheel(e: WheelEvent) {
  if (el.frame) zoomFrame(el.frame, e.deltaY, el.d / 2, el.d / 2)
}

// an empty close-up opens the file picker on a plain click
function onClick() {
  if (!el.frame && !dragged) fileInput.value?.click()
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
    }"
    @pointerdown.stop="onPointerDown"
    @click="onClick"
    @wheel.prevent.stop="onWheel"
    @dragover.prevent
    @drop.prevent.stop="onDrop"
  >
    <!-- Layers are stacked solid discs (outline, ring, photo) rather than
         border + outline, so each anti-aliased edge blends with the disc
         underneath instead of letting the page show through as a hairline
         gap. The outer element stays unclipped so handles can stick out past
         the ring. -->
    <div
      v-if="outlineStyle"
      class="disc shadowed"
      :style="{ inset: `${-(dividerStageWidth + outlineStyle.width)}px`, background: outlineStyle.color }"
    />
    <div
      class="disc"
      :class="{ shadowed: !outlineStyle }"
      :style="{ inset: `${-dividerStageWidth}px`, background: store.border.color }"
    />
    <!-- the placeholder fill only when empty: behind a photo it would bleed through the clipped edge -->
    <div class="clip" :style="{ background: el.frame ? undefined : CLOSE_UP_PLACEHOLDER_COLOR }">
      <img v-if="el.frame" :src="el.frame.src" :style="{ transform: frameTransform(el.frame) }" draggable="false" />
      <span v-else class="hint" v-bind="{ [NO_EXPORT_ATTR]: '' }">Click or drop<br />an image</span>
    </div>
    <!-- inner outline drawn over the photo's edge; the ring disc below it is opaque, so no gap -->
    <div
      v-if="outlineStyle"
      class="inner-outline"
      :style="{ borderWidth: `${outlineStyle.width}px`, borderColor: outlineStyle.color }"
    />
    <input ref="fileInput" type="file" accept="image/*" v-bind="{ [NO_EXPORT_ATTR]: '' }" @change="onFileChosen" />
    <template v-if="selected">
      <ElementHandle type="delete" @grab="removeElement(el.id)" />
      <ElementHandle type="resize" @grab="onResize" />
    </template>
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

.disc,
.clip,
.inner-outline {
  position: absolute;
  border-radius: 50%;
}

// the shadow goes on whichever disc is outermost
.shadowed {
  box-shadow: 0 6px 16px rgba(20, 14, 30, 0.35);
}

.inner-outline {
  inset: 0;
  border-style: solid;
  pointer-events: none;
}

.clip {
  inset: 0;
  overflow: hidden;

  img {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    max-width: none;
    -webkit-user-drag: none;
    pointer-events: none;
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
