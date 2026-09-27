<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, useTemplateRef, watch } from 'vue'

import CloseUpCircle from './CloseUpCircle.vue'
import ImagePanel from './ImagePanel.vue'
import SeamLine from './SeamLine.vue'
import TextBox from './TextBox.vue'
import { exportStageImage } from '@/lib/exportImage'
import { seamPanels } from '@/lib/seam'
import { deselectAll, stageSize, store } from '@/lib/store'

const CARD_PAD = 40 // .stage-card padding (20px each side)
const OUTER_PAD = 40 // .stage-outer padding (20px each side)

const outerEl = useTemplateRef('outer')
const stageEl = useTemplateRef('stage')
const card = reactive({ w: 0, h: 0 })

const panelShapes = computed(() => seamPanels(store.seam, stageSize.value))

// Scale the stage to fill the space available to it. Every
// pointer handler that turns a screen delta into stage coordinates divides
// by store.displayScale.
function fitStage() {
  const outer = outerEl.value
  if (!outer) return
  const availW = outer.clientWidth - OUTER_PAD - CARD_PAD
  const availH = outer.clientHeight - OUTER_PAD - CARD_PAD
  const { w, h } = stageSize.value
  const scale = Math.max(0.05, Math.min(availW / w, availH / h))
  store.displayScale = scale
  card.w = Math.ceil(w * scale + CARD_PAD)
  card.h = Math.ceil(h * scale + CARD_PAD)
}
watch(stageSize, fitStage)

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

async function exportImage() {
  deselectAll()
  await nextTick() // let selection chrome disappear before cloning the DOM
  await exportStageImage(stageEl.value!, {
    width: store.page.width,
    height: store.page.height,
    scale: stageSize.value.exportScale,
    format: store.exportFormat,
  })
}

defineExpose({ exportImage })
</script>

<template>
  <main ref="outer" class="stage-outer">
    <div class="stage-card" :style="{ width: `${card.w}px`, height: `${card.h}px` }">
      <div
        ref="stage"
        class="stage"
        :style="{ width: `${stageSize.w}px`, height: `${stageSize.h}px`, transform: `scale(${store.displayScale})` }"
        @pointerdown="onStagePointerDown"
      >
        <ImagePanel side="left" :shape="panelShapes.left" />
        <ImagePanel side="right" :shape="panelShapes.right" />
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
  background: #000; // shows wherever a photo doesn't cover its panel
  overflow: hidden;
  outline: 3px solid $ink;
  user-select: none;
  touch-action: none;
}
</style>
