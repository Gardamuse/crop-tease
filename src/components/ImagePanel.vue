<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { STAGE_H, STAGE_W } from '@/lib/constants'
import { firstDroppedFile, frameTransform, readFileAsDataURL, zoomFrame } from '@/lib/imageFrame'
import { deselectAll, setPanelImage, store, type PanelSide } from '@/lib/store'

const props = defineProps<{
  side: PanelSide
  clipPath: string
}>()

const fileInput = useTemplateRef('fileInput')
const frame = computed(() => store.panels[props.side])
const dragOver = ref(false)
let panning = false
let lastX = 0
let lastY = 0

async function useFile(file: File | undefined) {
  if (file) await setPanelImage(props.side, await readFileAsDataURL(file))
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
  if (frame.value) zoomFrame(frame.value, e.deltaY, STAGE_W / 2, STAGE_H / 2)
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
    :style="{ clipPath }"
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
    <div v-if="!frame" class="drop-hint">
      Drop or click to set<br />the {{ side.toUpperCase() }} image
    </div>
    <img v-else class="panel-img" :src="frame.src" :style="{ transform: frameTransform(frame) }" draggable="false" />
    <input ref="fileInput" type="file" accept="image/*" data-no-export @change="onFileChosen" />
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

.drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 0.95rem;
  color: #6b5f78;
  background: repeating-linear-gradient(45deg, #e9e0ef, #e9e0ef 10px, #f2ecf6 10px, #f2ecf6 20px);
  padding: 30px;
  pointer-events: none;

  .dragover & {
    outline: 3px dashed $pink;
    outline-offset: -10px;
  }
}

input[type='file'] {
  display: none;
}
</style>
