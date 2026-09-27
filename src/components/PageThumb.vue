<script setup lang="ts">
import { computed } from 'vue'

import { CLOSE_UP_PLACEHOLDER_COLOR, PANEL_PLACEHOLDER_COLORS } from '@/lib/constants'
import { computeLayout } from '@/lib/layout'
import { fontVars } from '@/lib/textFonts'
import {
  borderStageWidth,
  dividerStageWidth,
  pageNumberText,
  stageSize,
  store,
  textFontVars,
  textOutline,
  type CircleElement,
  type ComicPage,
  type TextElement,
} from '@/lib/store'

// A small SVG drawing of a page for the page bar: panels (photo or
// placeholder color), dividers, border, close-ups and text boxes. It's a
// simplified sketch of the stage, not a pixel-exact render.
const { page, index } = defineProps<{
  page: ComicPage
  /** position in the comic, for the page-number text */
  index: number
}>()

const geom = computed(() => computeLayout(page.layout, stageSize.value))
const circles = computed(() => page.elements.filter((e): e is CircleElement => e.kind === 'circle'))
const texts = computed(() => page.elements.filter((e): e is TextElement => e.kind === 'text' && e.style !== 'none'))

const pageNumber = computed(() => {
  const pn = store.pageNumber
  return pn && { el: pn, text: pageNumberText(pn.text, index), outline: textOutline(pn.color) }
})

const points = (pts: [number, number][]) => pts.map((p) => p.join(',')).join(' ')
const clipId = (kind: string, id: number) => `thumb-${page.id}-${kind}-${id}`
</script>

<template>
  <svg class="thumb" :viewBox="`0 0 ${stageSize.w} ${stageSize.h}`" :style="textFontVars" aria-hidden="true">
    <defs>
      <clipPath v-for="p in geom.panels" :id="clipId('panel', p.leaf.id)" :key="p.leaf.id">
        <polygon :points="points(p.poly.pts)" />
      </clipPath>
      <clipPath v-for="c in circles" :id="clipId('circle', c.id)" :key="c.id">
        <circle :cx="c.x + c.d / 2" :cy="c.y + c.d / 2" :r="c.d / 2" />
      </clipPath>
    </defs>
    <rect :width="stageSize.w" :height="stageSize.h" fill="#000" />
    <g v-for="(p, i) in geom.panels" :key="p.leaf.id" :clip-path="`url(#${clipId('panel', p.leaf.id)})`">
      <image
        v-if="p.leaf.frame"
        :href="p.leaf.frame.src"
        :width="p.leaf.frame.natW"
        :height="p.leaf.frame.natH"
        :transform="`translate(${p.leaf.frame.tx} ${p.leaf.frame.ty}) scale(${p.leaf.frame.scale})`"
        preserveAspectRatio="none"
      />
      <rect
        v-else
        :width="stageSize.w"
        :height="stageSize.h"
        :fill="PANEL_PLACEHOLDER_COLORS[i % PANEL_PLACEHOLDER_COLORS.length]"
      />
    </g>
    <line
      v-for="b in geom.bars"
      :key="b.bar.id"
      :x1="b.a[0]"
      :y1="b.a[1]"
      :x2="b.b[0]"
      :y2="b.b[1]"
      :stroke="store.border.color"
      :stroke-width="dividerStageWidth"
    />
    <rect
      v-if="store.border.width > 0"
      :x="borderStageWidth / 2"
      :y="borderStageWidth / 2"
      :width="stageSize.w - borderStageWidth"
      :height="stageSize.h - borderStageWidth"
      fill="none"
      :stroke="store.border.color"
      :stroke-width="borderStageWidth"
    />
    <g v-for="c in circles" :key="c.id">
      <circle :cx="c.x + c.d / 2" :cy="c.y + c.d / 2" :r="c.d / 2 + dividerStageWidth" :fill="store.border.color" />
      <image
        v-if="c.frame"
        :href="c.frame.src"
        :width="c.frame.natW"
        :height="c.frame.natH"
        :transform="`translate(${c.x + c.frame.tx} ${c.y + c.frame.ty}) scale(${c.frame.scale})`"
        :clip-path="`url(#${clipId('circle', c.id)})`"
        preserveAspectRatio="none"
      />
      <circle v-else :cx="c.x + c.d / 2" :cy="c.y + c.d / 2" :r="c.d / 2" :fill="CLOSE_UP_PLACEHOLDER_COLOR" />
    </g>
    <rect
      v-for="t in texts"
      :key="t.id"
      :x="t.x"
      :y="t.y"
      :width="t.w"
      :height="t.h"
      :rx="t.style === 'speech' ? 26 : 4"
      :transform="`rotate(${t.rot} ${t.x + t.w / 2} ${t.y + t.h / 2})`"
      fill="#fffaf3"
      stroke="#241b30"
      stroke-width="4"
    />
    <g
      v-if="pageNumber"
      :transform="`rotate(${pageNumber.el.rot} ${pageNumber.el.x + pageNumber.el.w / 2} ${pageNumber.el.y + pageNumber.el.h / 2})`"
    >
      <rect
        v-if="pageNumber.el.style !== 'none'"
        :x="pageNumber.el.x"
        :y="pageNumber.el.y"
        :width="pageNumber.el.w"
        :height="pageNumber.el.h"
        :rx="pageNumber.el.style === 'speech' ? 26 : 4"
        fill="#fffaf3"
        stroke="#241b30"
        stroke-width="4"
      />
      <text
        class="page-number"
        :x="pageNumber.el.x + pageNumber.el.w / 2"
        :y="pageNumber.el.y + pageNumber.el.h / 2"
        :font-size="pageNumber.el.fontSize"
        :fill="pageNumber.el.color"
        :stroke="pageNumber.el.style === 'none' && pageNumber.el.outline ? pageNumber.outline.color : undefined"
        :stroke-width="pageNumber.outline.width * 2"
        :style="pageNumber.el.font ? fontVars(pageNumber.el.font) : undefined"
      >
        {{ pageNumber.text }}
      </text>
    </g>
  </svg>
</template>

<style scoped lang="scss">
.thumb {
  display: block;
  height: 100%;
  width: auto;
}

.page-number {
  font-family: var(--text-font, #{$ui-font});
  font-weight: var(--text-weight, 800);
  text-anchor: middle;
  dominant-baseline: central;
  paint-order: stroke fill;
}
</style>
