<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import ElementHandle from './ElementHandle.vue'
import { NO_EXPORT_ATTR } from '@/lib/exportImage'
import type { BarGeom, Point } from '@/lib/layout'
import { trackPointer } from '@/lib/pointer'
import { layout, moveBarEnd, removeBar, selectBar, stageSize, store, translateBar } from '@/lib/store'

defineProps<{
  /** dashed guide for where a split would go, while picking a panel to split */
  preview: [Point, Point] | null
}>()

// Each bar is drawn well past its ends and clipped to the region it cuts.
// At the border the stage crops it flush; where it meets another bar, the
// clip stops it at that bar's centerline, which the host's own stroke covers,
// so the junction is a clean T at any angle.
const OVERSHOOT = 20

const svgEl = useTemplateRef('svg')
// which bar the pointer is over, for hover feedback
const hoverId = ref<number | null>(null)

const bars = computed(() =>
  layout.value.bars.map((g) => {
    const len = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) || 1
    const ux = (g.b[0] - g.a[0]) / len
    const uy = (g.b[1] - g.a[1]) / len
    return {
      geom: g,
      id: g.bar.id,
      clipId: `bar-clip-${g.bar.id}`,
      region: g.region.pts.map((p) => p.join(',')).join(' '),
      line: {
        x1: g.a[0] - ux * OVERSHOOT,
        y1: g.a[1] - uy * OVERSHOOT,
        x2: g.b[0] + ux * OVERSHOOT,
        y2: g.b[1] + uy * OVERSHOOT,
      },
      mid: [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2] as Point,
    }
  }),
)

const selectedBar = computed(() => bars.value.find((b) => b.id === store.selectedBarId))

/** Pointer position in stage coordinates. */
function stagePoint(ev: PointerEvent, rect: DOMRect): Point {
  return [(ev.clientX - rect.left) / store.displayScale, (ev.clientY - rect.top) / store.displayScale]
}

function dragEnd(e: PointerEvent, geom: BarGeom, end: 'a' | 'b') {
  selectBar(geom.bar.id)
  const rect = svgEl.value!.getBoundingClientRect()
  trackPointer(e, (_dx, _dy, ev) => moveBarEnd(geom.bar.id, end, stagePoint(ev, rect)))
}

// Dragging the bar itself slides it without changing its angle; the grab
// point stays under the pointer and both ends re-hook wherever they land.
function dragBar(e: PointerEvent, geom: BarGeom) {
  selectBar(geom.bar.id)
  const rect = svgEl.value!.getBoundingClientRect()
  const start = stagePoint(e, rect)
  const a0 = geom.a
  const dir: Point = [geom.b[0] - geom.a[0], geom.b[1] - geom.a[1]]
  trackPointer(e, (_dx, _dy, ev) => {
    const p = stagePoint(ev, rect)
    translateBar(geom.bar.id, [a0[0] + p[0] - start[0], a0[1] + p[1] - start[1]], dir)
  })
}
</script>

<template>
  <svg
    ref="svg"
    class="bars-svg"
    :viewBox="`0 0 ${stageSize.w} ${stageSize.h}`"
    :width="stageSize.w"
    :height="stageSize.h"
  >
    <defs>
      <clipPath v-for="b in bars" :id="b.clipId" :key="b.id">
        <polygon :points="b.region" />
      </clipPath>
    </defs>
    <line
      v-for="b in bars"
      :key="b.id"
      v-bind="b.line"
      :clip-path="`url(#${b.clipId})`"
      stroke="#241b30"
      stroke-width="9"
    />
    <g v-bind="{ [NO_EXPORT_ATTR]: '' }">
      <line
        v-for="b in bars"
        :key="b.id"
        v-bind="b.line"
        class="bar-hit"
        :class="{ active: b.id === store.selectedBarId || b.id === hoverId }"
        :clip-path="`url(#${b.clipId})`"
        stroke-width="36"
        @pointerenter="hoverId = b.id"
        @pointerleave="hoverId = null"
        @pointerdown.prevent.stop="dragBar($event, b.geom)"
      />
      <line
        v-if="preview"
        class="preview"
        :x1="preview[0][0]"
        :y1="preview[0][1]"
        :x2="preview[1][0]"
        :y2="preview[1][1]"
      />
    </g>
  </svg>
  <template v-for="b in bars" :key="b.id">
    <div
      v-for="end in ['a', 'b'] as const"
      :key="end"
      class="bar-end"
      :style="{ left: `${b.geom[end][0]}px`, top: `${b.geom[end][1]}px` }"
      title="Drag to slide this end along the border or another bar"
      v-bind="{ [NO_EXPORT_ATTR]: '' }"
      @pointerdown.prevent.stop="dragEnd($event, b.geom, end)"
    />
  </template>
  <div
    v-if="selectedBar"
    class="bar-delete"
    :style="{ left: `${selectedBar.mid[0]}px`, top: `${selectedBar.mid[1]}px` }"
    title="Remove this bar"
  >
    <ElementHandle type="delete" @grab="removeBar(selectedBar.id)" />
  </div>
</template>

<style scoped lang="scss">
.bars-svg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  overflow: visible;
}

.bar-hit {
  pointer-events: stroke;
  cursor: move;
  stroke: $pink;
  stroke-opacity: 0;

  &.active {
    stroke-opacity: 0.25;
  }
}

.preview {
  stroke: $ink;
  stroke-width: 4;
  stroke-dasharray: 12 8;
  opacity: 0.7;
}

.bar-end {
  position: absolute;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  border-radius: 50%;
  background: $ink;
  border: 3px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  cursor: grab;
  z-index: 7;
}

// zero-size anchor at the bar's midpoint; the handle inside centers on it
.bar-delete {
  position: absolute;
  z-index: 8;

  :deep(.handle) {
    right: auto;
    top: auto;
    left: -11px;
    bottom: 14px;
  }
}
</style>
