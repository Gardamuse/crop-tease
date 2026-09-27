<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'

import CloseUpCircle from './CloseUpCircle.vue'
import ImagePanel from './ImagePanel.vue'
import SplitBars from './SplitBars.vue'
import TextBox from './TextBox.vue'
import { exportStageImage } from '@/lib/exportImage'
import type { Point } from '@/lib/layout'
import { deselectAll, layout, splitChordAt, splitPanelAt, stageSize, store } from '@/lib/store'

const CARD_PAD = 40 // .stage-card padding (20px each side)
const OUTER_PAD = 40 // .stage-outer padding (20px each side)

const outerEl = useTemplateRef('outer')
const stageEl = useTemplateRef('stage')
const card = reactive({ w: 0, h: 0 })

const splitPreview = ref<[Point, Point] | null>(null)

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

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') store.splitMode = false
}

let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(fitStage)
  observer.observe(outerEl.value!)
  fitStage()
  window.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('keydown', onKeyDown)
})

watch(
  () => store.splitMode,
  (on) => {
    if (!on) splitPreview.value = null
  },
)

function stagePoint(e: PointerEvent): Point {
  const rect = stageEl.value!.getBoundingClientRect()
  return [(e.clientX - rect.left) / store.displayScale, (e.clientY - rect.top) / store.displayScale]
}

function onStagePointerDown(e: PointerEvent) {
  if (e.target === stageEl.value) deselectAll()
}

// While splitting, the stage swallows clicks (in the capture phase, before
// any panel, bar or element sees them) and shows where the cut would go.
function onSplitPointerDown(e: PointerEvent) {
  if (!store.splitMode) return
  e.stopPropagation()
  e.preventDefault()
  if (splitPanelAt(stagePoint(e))) store.splitMode = false
}

function onSplitPointerMove(e: PointerEvent) {
  if (!store.splitMode) return
  const found = splitChordAt(stagePoint(e))
  splitPreview.value = found ? [found.chord.a.point, found.chord.b.point] : null
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
        :class="{ splitting: store.splitMode }"
        :style="{ width: `${stageSize.w}px`, height: `${stageSize.h}px`, transform: `scale(${store.displayScale})` }"
        @pointerdown="onStagePointerDown"
        @pointerdown.capture="onSplitPointerDown"
        @pointermove="onSplitPointerMove"
        @pointerleave="splitPreview = null"
      >
        <ImagePanel v-for="(p, i) in layout.panels" :key="p.leaf.id" :panel="p" :index="i" />
        <SplitBars :preview="splitPreview" />
        <template v-for="el in store.elements" :key="el.id">
          <CloseUpCircle v-if="el.kind === 'circle'" :element="el" />
          <TextBox v-else :element="el" />
        </template>
      </div>
    </div>
    <div v-if="store.splitMode" class="split-banner">
      Click the panel to split &middot; <kbd>Esc</kbd> to cancel
    </div>
  </main>
</template>

<style scoped lang="scss">
.stage-outer {
  position: relative;
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

  &.splitting,
  &.splitting :deep(*) {
    cursor: crosshair !important;
  }
}

.split-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  border-radius: 999px;
  background: $ink;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(36, 27, 48, 0.25);
  pointer-events: none;

  kbd {
    font: inherit;
    padding: 0 5px;
    border-radius: 4px;
    background: $ink-soft;
  }
}
</style>
