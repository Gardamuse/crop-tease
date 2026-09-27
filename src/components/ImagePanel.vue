<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { PLACEHOLDER_COLORS } from '@/lib/constants'
import { NO_EXPORT_ATTR } from '@/lib/exportImage'
import { firstDroppedFile, frameTransform, readFileAsDataURL, zoomFrame } from '@/lib/imageFrame'
import type { PanelShape } from '@/lib/seam'
import { deselectAll, setPanelImage, stageSize, store, type PanelSide } from '@/lib/store'

const props = defineProps<{
  side: PanelSide
  shape: PanelShape
}>()

const fileInput = useTemplateRef('fileInput')
const frame = computed(() => store.panels[props.side])
const dragOver = ref(false)
let panning = false
let lastX = 0
let lastY = 0

async function useFile(file: File | undefined) {
  if (!file) return
  try {
    await setPanelImage(props.side, await readFileAsDataURL(file))
  } catch {
    alert(`Couldn't load "${file.name}" as an image.`)
  }
}

function onPointerDown(e: PointerEvent) {
  deselectAll()
  if (!frame.value) return
  panning = true
  lastX = e.clientX
  lastY = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  const f = frame.value
  if (!panning || !f) return
  f.tx += (e.clientX - lastX) / store.displayScale
  f.ty += (e.clientY - lastY) / store.displayScale
  lastX = e.clientX
  lastY = e.clientY
}

function onWheel(e: WheelEvent) {
  if (frame.value) zoomFrame(frame.value, e.deltaY, stageSize.value.w / 2, stageSize.value.h / 2)
}

function onClick() {
  if (!frame.value) fileInput.value?.click()
}

function onFileChosen() {
  const input = fileInput.value!
  useFile(input.files?.[0])
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  useFile(firstDroppedFile(e))
}
</script>

<template>
  <div
    class="panel"
    :class="{ dragover: dragOver }"
    :style="{ clipPath: shape.clipPath }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="panning = false"
    @pointercancel="panning = false"
    @wheel.prevent="onWheel"
    @click="onClick"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <div v-if="!frame" class="placeholder" :style="{ background: PLACEHOLDER_COLORS[side] }">
      <span
        class="hint"
        :style="{ left: `${shape.center[0]}px`, top: `${shape.center[1]}px` }"
        v-bind="{ [NO_EXPORT_ATTR]: '' }"
      >
        Drop or click to set<br />the {{ side.toUpperCase() }} image
      </span>
    </div>
    <img v-else class="panel-img" :src="frame.src" :style="{ transform: frameTransform(frame) }" draggable="false" />
    <input ref="fileInput" type="file" accept="image/*" v-bind="{ [NO_EXPORT_ATTR]: '' }" @change="onFileChosen" />
  </div>
</template>

<style scoped lang="scss">
.panel {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.panel-img {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  cursor: grab;
  max-width: none;
  -webkit-user-drag: none;

  &:active {
    cursor: grabbing;
  }
}

.placeholder {
  position: absolute;
  inset: 0;
  pointer-events: none;

  .dragover & {
    outline: 3px dashed $pink;
    outline-offset: -10px;
  }
}

.hint {
  position: absolute;
  transform: translate(-50%, -50%);
  text-align: center;
  white-space: nowrap;
  font-size: 0.95rem;
  color: rgba($ink, 0.6);
}

input[type='file'] {
  display: none;
}
</style>
