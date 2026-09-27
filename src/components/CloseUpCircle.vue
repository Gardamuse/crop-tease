<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import ElementHandle from './ElementHandle.vue'
import { firstDroppedFile, frameTransform, readFileAsDataURL, zoomFrame } from '@/lib/imageFrame'
import { clamp } from '@/lib/math'
import { screenCenter, trackPointer } from '@/lib/pointer'
import { removeElement, selectElement, setCircleImage, store, type CircleElement } from '@/lib/store'

const MIN_D = 60
const MAX_D = 700

const { element: el } = defineProps<{
  element: CircleElement
}>()

const rootEl = useTemplateRef('root')
const selected = computed(() => store.selectedId === el.id)

// plain drag moves the circle; Alt+drag pans the photo inside it
function onPointerDown(e: PointerEvent) {
  selectElement(el.id)
  const panPhoto = e.altKey
  trackPointer(e, (dx, dy) => {
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

async function onDrop(e: DragEvent) {
  const file = firstDroppedFile(e)
  if (file) await setCircleImage(el, await readFileAsDataURL(file))
}
</script>

<template>
  <div
    ref="root"
    class="circle"
    :class="{ selected, 'pink-ring': el.ring === 'pink' }"
    :style="{ left: `${el.x}px`, top: `${el.y}px`, width: `${el.d}px`, height: `${el.d}px`, zIndex: el.z }"
    @pointerdown.stop="onPointerDown"
    @wheel.prevent.stop="onWheel"
    @dragover.prevent
    @drop.prevent.stop="onDrop"
  >
    <!-- the outer element carries the ring and handles (never clipped); this
         inner layer clips just the photo, so handles can stick out past the ring -->
    <div class="clip">
      <img v-if="el.frame" :src="el.frame.src" :style="{ transform: frameTransform(el.frame) }" draggable="false" />
    </div>
    <template v-if="selected">
      <ElementHandle type="delete" @grab="removeElement(el.id)" />
      <ElementHandle type="resize" @grab="onResize" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.circle {
  position: absolute;
  border-radius: 50%;
  box-shadow: 0 6px 16px rgba(20, 14, 30, 0.35);
  border: 8px solid #fff;
  outline: 5px solid $ink;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &.pink-ring {
    outline-color: $pink;
  }
}

.clip {
  position: absolute;
  inset: 0;
  border-radius: 50%;
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
</style>
