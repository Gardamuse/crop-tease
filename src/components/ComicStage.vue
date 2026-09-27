<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'

import CloseUpCircle from './CloseUpCircle.vue'
import BorderOutlines from './BorderOutlines.vue'
import ImagePanel from './ImagePanel.vue'
import SplitBars from './SplitBars.vue'
import TextBox from './TextBox.vue'
import { renderStageImage, type ExportProgress } from '@/lib/exportImage'
import type { Point } from '@/lib/layout'
import { trackPointer } from '@/lib/pointer'
import { borderStageWidth, deselectAll, layout, planSplit, splitPanelAt, stageSize, store } from '@/lib/store'

const OUTER_PAD = 48 // .stage-outer padding (24px each side)

const outerEl = useTemplateRef('outer')
const stageEl = useTemplateRef('stage')
const card = reactive({ w: 0, h: 0 })

/** The cut a split would make, and the area that would become the new empty panel. */
export interface SplitPreview {
  line: [Point, Point]
  fresh: Point[]
}
const splitPreview = ref<SplitPreview | null>(null)
// true while the mouse is held down to choose a side
let choosingSide = false


// Scale the stage to fill the space available to it. Every
// pointer handler that turns a screen delta into stage coordinates divides
// by store.displayScale.
function fitStage() {
  const outer = outerEl.value
  if (!outer) return
  const availW = outer.clientWidth - OUTER_PAD
  const availH = outer.clientHeight - OUTER_PAD
  const { w, h } = stageSize.value
  const scale = Math.max(0.05, Math.min(availW / w, availH / h))
  store.displayScale = scale
  card.w = Math.ceil(w * scale)
  card.h = Math.ceil(h * scale)
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

function showPlan(plan: ReturnType<typeof planSplit>) {
  splitPreview.value = plan && { line: [plan.chord.a.point, plan.chord.b.point], fresh: plan.freshPoly }
}

// While splitting, the stage swallows presses (in the capture phase, before
// any panel, bar or element sees them) and previews the cut. Pressing fixes
// where the cut goes; dragging to either side of it, then releasing, picks
// which side becomes the new empty panel.
function onSplitPointerDown(e: PointerEvent) {
  if (!store.splitMode || e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  const at = stagePoint(e)
  const plan = planSplit(at)
  if (!plan) return
  choosingSide = true
  showPlan(plan)
  let side = plan.freshSide
  trackPointer(
    e,
    (_dx, _dy, ev) => {
      const next = planSplit(at, stagePoint(ev))
      if (!next) return
      side = next.freshSide
      showPlan(next)
    },
    (_ev, cancelled) => {
      choosingSide = false
      if (!cancelled && splitPanelAt(at, side)) store.splitMode = false
    },
  )
}

function onSplitPointerMove(e: PointerEvent) {
  if (!store.splitMode || choosingSide) return
  showPlan(planSplit(stagePoint(e)))
}

async function renderImage(onProgress?: ExportProgress): Promise<Blob> {
  deselectAll()
  store.splitMode = false
  await nextTick() // let selection chrome disappear before cloning the DOM
  return renderStageImage(
    stageEl.value!,
    {
      width: store.page.width,
      height: store.page.height,
      scale: stageSize.value.exportScale,
      format: store.exportFormat,
    },
    onProgress,
  )
}

defineExpose({ renderImage })
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
        @pointerleave="!choosingSide && (splitPreview = null)"
      >
        <ImagePanel v-for="(p, i) in layout.panels" :key="`${store.generation}-${p.leaf.id}`" :panel="p" :index="i" />
        <SplitBars :preview="splitPreview" />
        <div
          v-if="store.border.width > 0"
          class="page-border"
          :style="{ borderWidth: `${borderStageWidth}px`, borderColor: store.border.color }"
        />
        <BorderOutlines />
        <template v-for="el in store.elements" :key="`${store.generation}-${el.id}`">
          <CloseUpCircle v-if="el.kind === 'circle'" :element="el" />
          <TextBox v-else :element="el" />
        </template>
      </div>
    </div>
    <div v-if="store.splitMode" class="split-banner">
      Click a panel to split it &middot; drag to pick the new side &middot; <kbd>Esc</kbd> cancels
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
  padding: 24px;
  background: $workspace;
}

// sized to the scaled stage; no padding or frame of its own, so nothing
// around the page can be mistaken for a border that will be exported
.stage-card {
  flex: none;
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.45);
}

.stage {
  position: relative;
  transform-origin: top left;
  background: #000; // shows wherever a photo doesn't cover its panel
  overflow: hidden;
  user-select: none;
  touch-action: none;

  &.splitting,
  &.splitting :deep(*) {
    cursor: crosshair !important;
  }
}

.page-border {
  position: absolute;
  inset: 0;
  border-style: solid;
  z-index: 6; // over panels and bars, under close-ups and text
  pointer-events: none;
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
