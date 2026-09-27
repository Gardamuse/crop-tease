<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'

import ElementHandle from './ElementHandle.vue'
import { TEXT_PALETTE } from '@/lib/constants'
import { NO_EXPORT_ATTR } from '@/lib/exportImage'
import { screenCenter, trackPointer } from '@/lib/pointer'
import { removeElement, selectElement, store, type TextElement } from '@/lib/store'

const MIN_W = 80
const MIN_H = 40
const MIN_FONT = 10

const { element: el } = defineProps<{
  element: TextElement
}>()

const rootEl = useTemplateRef('root')
const faceEl = useTemplateRef('face')
const selected = computed(() => store.selectedId === el.id)
const editing = ref(false)

// The face is contenteditable, so its text is written once here and read
// back on blur rather than rendered by Vue (which would fight the caret).
onMounted(() => {
  faceEl.value!.textContent = el.text
})

// single click selects/moves the frame; double-click edits the text inside it
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  selectElement(el.id)
  if (editing.value) return // let text selection / caret placement happen instead
  trackPointer(e, (dx, dy) => {
    el.x += dx / store.displayScale
    el.y += dy / store.displayScale
  })
}

async function startEdit() {
  editing.value = true
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

function onRotate(e: PointerEvent) {
  const { cx, cy } = screenCenter(rootEl.value!)
  trackPointer(e, (_dx, _dy, ev) => {
    el.rot = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90
  })
}

// drag deltas are rotated into the box's own frame, so the handle follows the pointer
function onResize(e: PointerEvent) {
  const rad = (el.rot * Math.PI) / 180
  trackPointer(e, (dx, dy) => {
    dx /= store.displayScale
    dy /= store.displayScale
    el.w = Math.max(MIN_W, el.w + dx * Math.cos(rad) + dy * Math.sin(rad))
    el.h = Math.max(MIN_H, el.h - dx * Math.sin(rad) + dy * Math.cos(rad))
  })
}

function cycleColor() {
  el.color = TEXT_PALETTE[(TEXT_PALETTE.indexOf(el.color) + 1) % TEXT_PALETTE.length]!
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
    }"
    @pointerdown.stop="onPointerDown"
  >
    <div
      ref="face"
      class="face"
      :class="{ bubble: el.kind === 'bubble' }"
      :contenteditable="editing"
      :style="{ fontSize: `${el.fontSize}px`, color: el.color }"
      @dblclick.stop="startEdit"
      @blur="stopEdit"
    />
    <template v-if="selected">
      <ElementHandle type="delete" @grab="removeElement(el.id)" />
      <ElementHandle type="resize" @grab="onResize" />
      <ElementHandle type="rotate" @grab="onRotate" />
      <div class="mini-toolbar" v-bind="{ [NO_EXPORT_ATTR]: '' }" @pointerdown.stop>
        <button @click="el.fontSize = Math.max(MIN_FONT, el.fontSize - 2)">A-</button>
        <button @click="el.fontSize += 2">A+</button>
        <button class="swatch" :style="{ background: el.color }" title="Text color" @click="cycleColor" />
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.text-box {
  position: absolute;
}

.face {
  position: absolute;
  inset: 0;
  padding: 14px 18px;
  background: $paper;
  border: 4px solid $ink;
  border-radius: 10px;
  font-family: $caption-font;
  font-style: italic;
  font-weight: 700;
  line-height: 1.3;
  cursor: grab;
  outline: none;
  overflow: hidden;

  &:active {
    cursor: grabbing;
  }

  &[contenteditable='true'] {
    cursor: text;
    box-shadow: 0 0 0 3px $teal inset;
  }

  &.bubble {
    padding: 16px 20px;
    border-radius: 26px;
    font-family: $ui-font;
    font-style: normal;
    font-weight: 800;
    line-height: 1.25;
    text-align: center;
    overflow: visible; // the tail hangs below the box

    // tail: an ink triangle with a smaller paper one on top
    &::after {
      content: '';
      position: absolute;
      left: 30px;
      bottom: -22px;
      border-width: 22px 12px 0 0;
      border-style: solid;
      border-color: $ink transparent transparent transparent;
    }

    &::before {
      content: '';
      position: absolute;
      left: 34px;
      bottom: -13px;
      border-width: 16px 8px 0 0;
      border-style: solid;
      border-color: $paper transparent transparent transparent;
      z-index: 1;
    }
  }
}

.mini-toolbar {
  position: absolute;
  top: -92px; // sits clear above the rotate handle and its stick
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  background: $ink;
  padding: 5px;
  border-radius: 8px;
  z-index: 70;
  white-space: nowrap;

  button {
    font-size: 12px;
    font-weight: 700;
    border: none;
    border-radius: 5px;
    padding: 5px 8px;
    cursor: pointer;
    background: $ink-soft;
    color: #fff;

    &:hover {
      background: $pink-deep;
    }
  }

  .swatch {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 2px solid #fff;
  }
}
</style>
