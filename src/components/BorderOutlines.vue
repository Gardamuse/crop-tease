<script setup lang="ts">
import { computed } from 'vue'

import { insetPoly, type Point } from '@/lib/layout'
import { borderStageWidth, dividerStageWidth, layout, outlineStyle, stageSize } from '@/lib/store'

// The outline is traced per panel: each panel's polygon is shrunk to its
// visible area (in by half a bar along bars, by the border width along the
// page edge) plus half the line width, and the moved edges are stroked. The
// line so sits just inside the panel, touching the bar or border, and the
// loops meet cleanly at every corner and T-junction.
const paths = computed(() => {
  const outline = outlineStyle.value
  if (!outline) return []
  const half = outline.width / 2
  const border = borderStageWidth.value
  return layout.value.panels.flatMap((panel) => {
    const inner = insetPoly(panel.poly, (host) => {
      if (host !== 'border') return dividerStageWidth.value / 2 + half
      return border > 0 ? border + half : 0 // no border, nothing to outline at the page edge
    })
    return outlinePath(inner.pts, inner.hosts)
  })
})

/** SVG path data for the runs of outlined edges; a closed loop when every edge is outlined. */
function outlinePath(pts: Point[], outlined: boolean[]): string[] {
  const n = pts.length
  if (n < 3 || !outlined.some(Boolean)) return []
  const at = (i: number) => pts[i % n]!.join(' ')
  if (outlined.every(Boolean)) return [`M ${pts.map((p) => p.join(' ')).join(' L ')} Z`]
  // start each run just after an edge that isn't outlined
  const start = outlined.findIndex((o, i) => o && !outlined[(i - 1 + n) % n])
  const runs: string[] = []
  let d = ''
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n
    if (outlined[i]) d += (d ? '' : `M ${at(i)}`) + ` L ${at(i + 1)}`
    else if (d) {
      runs.push(d)
      d = ''
    }
  }
  if (d) runs.push(d)
  return runs
}
</script>

<template>
  <svg
    v-if="outlineStyle"
    class="outlines-svg"
    :viewBox="`0 0 ${stageSize.w} ${stageSize.h}`"
    :width="stageSize.w"
    :height="stageSize.h"
  >
    <path
      v-for="(d, i) in paths"
      :key="i"
      :d="d"
      fill="none"
      :stroke="outlineStyle.color"
      :stroke-width="outlineStyle.width"
      stroke-linejoin="miter"
    />
  </svg>
</template>

<style scoped lang="scss">
.outlines-svg {
  position: absolute;
  inset: 0;
  z-index: 6; // after the page border in the DOM, so drawn over its inner edge
  pointer-events: none;
}
</style>
