<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, useTemplateRef } from 'vue'

import CloseUpCircle from './CloseUpCircle.vue'
import ImagePanel from './ImagePanel.vue'
import SeamLine from './SeamLine.vue'
import TextBox from './TextBox.vue'
import { STAGE_H, STAGE_W } from '@/lib/constants'
import { exportStagePng } from '@/lib/exportPng'
import { seamClipPaths } from '@/lib/seam'
import { deselectAll, store } from '@/lib/store'

const CARD_PAD = 40 // .stage-card padding (20px each side)
const OUTER_PAD = 40 // .stage-outer padding (20px each side)

const outerEl = useTemplateRef('outer')
const stageEl = useTemplateRef('stage')
const card = reactive({ w: 0, h: 0 })

const clipPaths = computed(() => seamClipPaths(store.seam))

// Scale the fixed-size stage to fill the space available to it. Every
// pointer handler that turns a screen delta into stage coordinates divides
// by store.displayScale.
function fitStage() {
  const outer = outerEl.value
  if (!outer) return
  const availW = outer.clientWidth - OUTER_PAD - CARD_PAD
  const availH = outer.clientHeight - OUTER_PAD - CARD_PAD
  const scale = Math.max(0.05, Math.min(availW / STAGE_W, availH / STAGE_H))
  store.displayScale = scale
  card.w = Math.ceil(STAGE_W * scale + CARD_PAD)
  card.h = Math.ceil(STAGE_H * scale + CARD_PAD)
}

let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(fitStage)
  observer.observe(outerEl.value!)
  fitStage()
})
onBeforeUnmount(() => observer?.disconnect())

function onStagePointerDown(e: PointerEvent) {
  if (e.target === stageEl.value) deselectAll()
}

async function exportPng() {
  deselectAll()
  await nextTick() // let selection chrome disappear before cloning the DOM
  await exportStagePng(stageEl.value!)
}

defineExpose({ exportPng })
</script>

<template>
  <main ref="outer" class="stage-outer">
    <div class="stage-card" :style="{ width: `${card.w}px`, height: `${card.h}px` }">
      <div
        ref="stage"
        class="stage"
        :style="{ width: `${STAGE_W}px`, height: `${STAGE_H}px`, transform: `scale(${store.displayScale})` }"
        @pointerdown="onStagePointerDown"
      >
        <ImagePanel side="left" :clip-path="clipPaths.left" />
        <ImagePanel side="right" :clip-path="clipPaths.right" />
        <SeamLine />
        <template v-for="el in store.elements" :key="el.id">
          <CloseUpCircle v-if="el.kind === 'circle'" :element="el" />
          <TextBox v-else :element="el" />
        </template>
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">
.stage-outer {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto; // fallback if the viewport is ever too small
  padding: 20px;
}

.stage-card {
  background: #fff;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(36, 27, 48, 0.12);
}

.stage {
  position: relative;
  transform-origin: top left;
  background: #d8cfe0;
  overflow: hidden;
  outline: 3px solid $ink;
  user-select: none;
  touch-action: none;
}
</style>
