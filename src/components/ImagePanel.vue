<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import PhotoFilter from './PhotoFilter.vue'
import { isDark } from '@/lib/color'
import { SWATCH_COLORS } from '@/lib/constants'
import { NO_EXPORT_ATTR } from '@/lib/exportImage'
import { firstDroppedFile, frameTransform, zoomFrame } from '@/lib/imageFrame'
import { addImageFile } from '@/lib/images'
import type { PanelGeom } from '@/lib/layout'
import { openContextMenu, type MenuEntry } from '@/lib/contextMenu'
import { hasPhotoFilter, overlayBackground, photoMenuEntries } from '@/lib/photoEffects'
import { clearPanelImage, deselectAll, panelFill, setPanelImage, store } from '@/lib/store'

const props = defineProps<{
  panel: PanelGeom
  /** position in the panel list, for the placeholder color */
  index: number
}>()

const fileInput = useTemplateRef('fileInput')
const frame = computed(() => props.panel.leaf.frame)
const filterId = computed(() => `photo-filter-panel-${props.panel.leaf.id}`)
const fillColor = computed(() => panelFill(props.panel.leaf, props.index))
const dragOver = ref(false)
let panning = false
let lastX = 0
let lastY = 0

async function useFile(file: File | undefined) {
  if (!file) return
  try {
    await setPanelImage(props.panel.leaf.id, await addImageFile(file))
  } catch {
    alert(`Couldn't load "${file.name}" as an image.`)
  }
}

function onPointerDown(e: PointerEvent) {
  deselectAll()
  if (e.button !== 0) return // right-click opens the menu instead
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
  const { x, y, w, h } = props.panel.bbox
  if (frame.value) zoomFrame(frame.value, e.deltaY, x + w / 2, y + h / 2)
}

function onClick() {
  if (!frame.value) fileInput.value?.click()
}

function onContextMenu(e: MouseEvent) {
  deselectAll()
  const leafId = props.panel.leaf.id
  openContextMenu(e, [
    { label: frame.value ? 'Change image…' : 'Set image…', icon: '🖼', action: () => fileInput.value?.click() },
    ...(frame.value
      ? [{ label: 'Remove image', icon: '🗑', danger: true, action: () => clearPanelImage(leafId) }]
      : []),
    ...fillEntries(),
    ...photoMenuEntries(props.panel.leaf, () => frame.value, `photo-${props.panel.leaf.id}`),
  ])
}

// Without a photo, the panel's color: its placeholder color (Auto), a
// preset or a custom one.
function fillEntries(): MenuEntry[] {
  const leaf = props.panel.leaf
  const empty = () => !frame.value
  return [
    { kind: 'separator', visible: empty },
    {
      kind: 'choices',
      label: 'Color',
      visible: empty,
      options: [
        { label: 'Auto', title: 'A placeholder color', active: () => leaf.fill === null, pick: () => (leaf.fill = null) },
        ...SWATCH_COLORS.map((c) => ({
          label: c.label,
          swatch: c.color,
          active: () => leaf.fill === c.color,
          pick: () => (leaf.fill = c.color),
        })),
        {
          label: 'Custom color',
          active: () => leaf.fill !== null && !SWATCH_COLORS.some((c) => c.color === leaf.fill),
          pick: () => {},
          pickColor: { value: () => fillColor.value, set: (color: string) => (leaf.fill = color) },
        },
      ],
    },
  ]
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
    :style="{ clipPath: panel.clipPath }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="panning = false"
    @pointercancel="panning = false"
    @wheel.prevent="onWheel"
    @click="onClick"
    @contextmenu="onContextMenu"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <div v-if="!frame" class="placeholder" :style="{ background: fillColor }">
      <span
        class="hint"
        :class="{ light: isDark(fillColor) }"
        :style="{ left: `${panel.center[0]}px`, top: `${panel.center[1]}px` }"
        v-bind="{ [NO_EXPORT_ATTR]: '' }"
      >
        Drop or click to<br />set an image
      </span>
    </div>
    <svg v-if="frame && hasPhotoFilter(panel.leaf)" class="filter-defs" aria-hidden="true">
      <PhotoFilter :id="filterId" :effects="panel.leaf" :frame="frame" />
    </svg>
    <img
      v-if="frame"
      class="panel-img"
      :src="frame.src"
      :style="{ transform: frameTransform(frame), filter: hasPhotoFilter(panel.leaf) ? `url(#${filterId})` : undefined }"
      draggable="false"
    />
    <!-- over the panel's own area, so the fade runs across what's visible -->
    <div
      v-if="frame && panel.leaf.overlay"
      class="overlay"
      :style="{
        left: `${panel.bbox.x}px`,
        top: `${panel.bbox.y}px`,
        width: `${panel.bbox.w}px`,
        height: `${panel.bbox.h}px`,
        background: overlayBackground(panel.leaf.overlay),
      }"
    />
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

.overlay {
  position: absolute;
  pointer-events: none;
}

.filter-defs {
  position: absolute;
  width: 0;
  height: 0;
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

  // on a dark fill
  &.light {
    color: rgba(#fff, 0.7);
  }
}

input[type='file'] {
  display: none;
}
</style>
