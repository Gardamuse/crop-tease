<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { STAGE_H, STAGE_W } from '@/lib/constants'
import { NO_EXPORT_ATTR } from '@/lib/exportPng'
import { closestPerimT, MIN_SEP, perimDist, perimPoint, wrapT } from '@/lib/seam'
import { trackPointer } from '@/lib/pointer'
import { store } from '@/lib/store'

// Overshoot the drawn line a few px past each border point. The stage and
// the panels' clip paths crop everything at the true edge anyway, so this
// just guarantees the ink reaches flush to the border instead of leaving a
// hairline gap from sub-pixel rounding (especially after the export scale-up).
const OVERSHOOT = 8
// perpendicular offset of the highlight line, so the seam reads as a ridge
const RIDGE = 5

const svgEl = useTemplateRef('svg')

const ends = computed(() => {
  const [ax, ay] = perimPoint(store.seam.a)
  const [bx, by] = perimPoint(store.seam.b)
  const len = Math.hypot(bx - ax, by - ay) || 1
  const ux = (bx - ax) / len
  const uy = (by - ay) / len
  const ink = { x1: ax - ux * OVERSHOOT, y1: ay - uy * OVERSHOOT, x2: bx + ux * OVERSHOOT, y2: by + uy * OVERSHOOT }
  const nx = -uy * RIDGE
  const ny = ux * RIDGE
  return {
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    ink,
    highlight: { x1: ink.x1 + nx, y1: ink.y1 + ny, x2: ink.x2 + nx, y2: ink.y2 + ny },
    hit: { x1: ax, y1: ay, x2: bx, y2: by },
  }
})

/** Perimeter parameter closest to the pointer, in stage coordinates. */
function pointerT(ev: PointerEvent, rect: DOMRect): number {
  return closestPerimT((ev.clientX - rect.left) / store.displayScale, (ev.clientY - rect.top) / store.displayScale)
}

function dragEnd(e: PointerEvent, key: 'a' | 'b') {
  const other = key === 'a' ? 'b' : 'a'
  const rect = svgEl.value!.getBoundingClientRect()
  trackPointer(e, (_dx, _dy, ev) => {
    const t = pointerT(ev, rect)
    if (perimDist(t, store.seam[other]) >= MIN_SEP) store.seam[key] = t
  })
}

// Dragging the line itself (not a handle) spins both ends together, keeping
// their relative spacing: the closest thing to "moving" a chord that has to
// stay pinned to the border on both ends.
function dragLine(e: PointerEvent) {
  const rect = svgEl.value!.getBoundingClientRect()
  let lastT = pointerT(e, rect)
  trackPointer(e, (_dx, _dy, ev) => {
    const t = pointerT(ev, rect)
    let dt = t - lastT
    if (dt > 2) dt -= 4
    else if (dt < -2) dt += 4 // shortest way around
    lastT = t
    store.seam.a = wrapT(store.seam.a + dt)
    store.seam.b = wrapT(store.seam.b + dt)
  })
}
</script>

<template>
  <svg ref="svg" class="seam-svg" :viewBox="`0 0 ${STAGE_W} ${STAGE_H}`" :width="STAGE_W" :height="STAGE_H">
    <line v-bind="ends.ink" stroke="#241b30" stroke-width="9" />
    <line v-bind="ends.highlight" stroke="#fffaf3" stroke-width="3" stroke-opacity="0.75" />
    <line
      class="seam-hit"
      v-bind="{ ...ends.hit, [NO_EXPORT_ATTR]: '' }"
      stroke="transparent"
      stroke-width="36"
      @pointerdown.prevent.stop="dragLine"
    />
  </svg>
  <div
    v-for="key in ['a', 'b'] as const"
    :key="key"
    class="seam-handle"
    :style="{ left: `${ends[key].x}px`, top: `${ends[key].y}px` }"
    title="Drag to move this end of the seam anywhere along the border"
    v-bind="{ [NO_EXPORT_ATTR]: '' }"
    @pointerdown.prevent.stop="dragEnd($event, key)"
  />
</template>

<style scoped lang="scss">
.seam-svg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

.seam-hit {
  pointer-events: auto;
  cursor: move;
}

.seam-handle {
  position: absolute;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  border-radius: 50%;
  background: $ink;
  border: 3px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  cursor: ew-resize;
  z-index: 7;
}
</style>
