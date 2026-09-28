<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'

import CloseUpCircle from './CloseUpCircle.vue'
import BorderOutlines from './BorderOutlines.vue'
import ImagePanel from './ImagePanel.vue'
import SplitBars from './SplitBars.vue'
import TextBox from './TextBox.vue'
import { contextMenu } from '@/lib/contextMenu'
import { renderStageImage, type ExportFormat, type ExportProgress } from '@/lib/exportImage'
import type { Point } from '@/lib/layout'
import { trackPointer } from '@/lib/pointer'
import { task } from '@/lib/task'
import { prepareFonts } from '@/lib/textFonts'
import {
  borderStageWidth,
  copyElement,
  deselectAll,
  layout,
  pasteElement,
  planSplit,
  removeSelected,
  splitPanelAt,
  stageSize,
  store,
  textFontVars,
} from '@/lib/store'

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

const panelsClip = computed(() =>
  borderStageWidth.value > 1 ? `inset(${borderStageWidth.value - 1}px)` : undefined,
)
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

// true while typing somewhere (a text box being edited, a field), where keys are for the text
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') store.splitMode = false
  if (isTyping(e.target) || contextMenu.open || task.visible || e.altKey) return
  const ctrl = e.ctrlKey || e.metaKey
  let handled = false
  if (ctrl && e.key.toLowerCase() === 'c') {
    // leave copying selected page text (e.g. in the help) to the browser
    if (!window.getSelection()?.isCollapsed) return
    handled = store.selectedId !== null && copyElement(store.selectedId)
  } else if (ctrl && e.key.toLowerCase() === 'v') {
    handled = pasteElement()
  } else if (!ctrl && !e.shiftKey && e.key === 'Delete') {
    handled = removeSelected()
  }
  if (handled) e.preventDefault()
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

/**
 * Renders the current page at output size times `resolution` (text, lines
 * and photos are redrawn at that size, not upscaled); `format` defaults to
 * the chosen export format.
 */
async function renderImage(
  onProgress?: ExportProgress,
  format: ExportFormat = store.exportFormat,
  resolution = 1,
): Promise<Blob> {
  deselectAll()
  store.splitMode = false
  await nextTick() // let selection chrome disappear before cloning the DOM
  // the fonts on this page, loaded so the text is measured and drawn in them rather than a fallback
  const texts = [...store.elements, store.pageNumber].filter((e) => e?.kind === 'text')
  const fonts = await prepareFonts([store.textFont, ...texts.map((t) => t.font ?? store.textFont)])
  return renderStageImage(
    stageEl.value!,
    {
      width: Math.round(store.pageSize.width * resolution),
      height: Math.round(store.pageSize.height * resolution),
      scale: stageSize.value.exportScale * resolution,
      format,
      fonts,
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
        :style="{
          width: `${stageSize.w}px`,
          height: `${stageSize.h}px`,
          transform: `scale(${store.displayScale})`,
          ...textFontVars,
        }"
        @pointerdown="onStagePointerDown"
        @pointerdown.capture="onSplitPointerDown"
        @pointermove="onSplitPointerMove"
        @pointerleave="!choosingSide && (splitPreview = null)"
      >
        <!-- Photos are clipped just inside the page border (which overlaps them
             by 1 unit, so there's no gap). Otherwise a photo reaching the page
             edge bleeds through the border's anti-aliased outer edge as a
             hairline while the page is shown scaled. -->
        <div class="panels" :style="{ clipPath: panelsClip }">
          <ImagePanel v-for="(p, i) in layout.panels" :key="`${store.generation}-${p.leaf.id}`" :panel="p" :index="i" />
        </div>
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
        <!-- one shared item drawn on every page -->
        <TextBox
          v-if="store.pageNumber"
          :key="`${store.generation}-${store.pageNumber.id}`"
          :element="store.pageNumber"
        />
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
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto; // fallback if the viewport is ever too small
  padding: 24px;
}

// sized to the scaled stage; no padding or frame of its own, so nothing
// around the page can be mistaken for a border that will be exported
.stage-card {
  flex: none;
  box-shadow: 0 14px 40px rgba(#000, 0.5);
}

.stage {
  position: relative;
  transform-origin: top left;
  background: #000; // shows wherever a photo doesn't cover its panel
  font-family: $ui-font; // page content keeps its own font, not the app's
  // clip rather than hidden: a hidden box can still be scrolled by the
  // browser (e.g. to reveal the caret in text near the page edge), which
  // would shift everything on the page
  overflow: clip;
  user-select: none;
  touch-action: none;

  &.splitting,
  &.splitting :deep(*) {
    cursor: crosshair !important;
  }
}

.panels {
  position: absolute;
  inset: 0;
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
  padding: 7px 14px;
  border-radius: $radius;
  background: $dark-panel-alt;
  border: 1px solid $line-accent;
  color: $dark-text;
  font-family: $font-mono;
  font-size: 0.78rem;
  white-space: nowrap;
  box-shadow: 0 0 14px $accent-soft;
  pointer-events: none;

  kbd {
    font: inherit;
    padding: 0 5px;
    border-radius: 4px;
    border: 1px solid $dark-line;
    color: $accent;
  }
}
</style>
