<script setup lang="ts">
import { computed } from 'vue'

import { CLOSE_UP_PLACEHOLDER_COLOR, PANEL_PLACEHOLDER_COLORS } from '@/lib/constants'
import { computeLayout } from '@/lib/layout'
import { blurRadius, overlayGradient } from '@/lib/photoEffects'
import { fontVars } from '@/lib/textFonts'
import {
  dividerStageWidth,
  pageBorderWidth,
  pageNumberText,
  pageShowsNumber,
  stageSize,
  store,
  textFontSize,
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
const border = computed(() => pageBorderWidth(page))
const circles = computed(() => page.elements.filter((e): e is CircleElement => e.kind === 'circle'))
const texts = computed(() => page.elements.filter((e): e is TextElement => e.kind === 'text' && e.style !== 'none'))

const pageNumber = computed(() => {
  const pn = store.pageNumber
  return pn && pageShowsNumber(index) && { el: pn, text: pageNumberText(pn.text, index), outline: textOutline(pn.color) }
})

// the photos' color overlays, each as an SVG gradient over its panel's or close-up's box
const overlays = computed(() => [
  ...geom.value.panels.flatMap((p) =>
    p.leaf.frame && p.leaf.overlay
      ? [{ key: `panel-${p.leaf.id}`, color: p.leaf.overlay.color, ...overlayGradient(p.leaf.overlay, p.bbox) }]
      : [],
  ),
  ...circles.value.flatMap((c) =>
    c.frame && c.overlay
      ? [{ key: `circle-${c.id}`, color: c.overlay.color, ...overlayGradient(c.overlay, { x: c.x, y: c.y, w: c.d, h: c.d }) }]
      : [],
  ),
])

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
      <template v-for="p in geom.panels" :key="`blur-${p.leaf.id}`">
        <filter
          v-if="p.leaf.frame && p.leaf.blur"
          :id="clipId('blur-panel', p.leaf.id)"
          x="0"
          y="0"
          width="1"
          height="1"
          color-interpolation-filters="sRGB"
        >
          <feGaussianBlur :stdDeviation="blurRadius(p.leaf.blur, p.leaf.frame)" edgeMode="duplicate" />
        </filter>
      </template>
      <template v-for="c in circles" :key="`blur-${c.id}`">
        <filter
          v-if="c.frame && c.blur"
          :id="clipId('blur-circle', c.id)"
          x="0"
          y="0"
          width="1"
          height="1"
          color-interpolation-filters="sRGB"
        >
          <feGaussianBlur :stdDeviation="blurRadius(c.blur, c.frame)" edgeMode="duplicate" />
        </filter>
      </template>
      <linearGradient
        v-for="o in overlays"
        :id="`thumb-${page.id}-overlay-${o.key}`"
        :key="o.key"
        gradientUnits="userSpaceOnUse"
        :x1="o.x1"
        :y1="o.y1"
        :x2="o.x2"
        :y2="o.y2"
      >
        <stop v-for="s in o.stops" :key="s.offset" :offset="s.offset" :stop-color="o.color" :stop-opacity="s.opacity" />
      </linearGradient>
    </defs>
    <rect :width="stageSize.w" :height="stageSize.h" fill="#000" />
    <g v-for="(p, i) in geom.panels" :key="p.leaf.id" :clip-path="`url(#${clipId('panel', p.leaf.id)})`">
      <image
        v-if="p.leaf.frame"
        :href="p.leaf.frame.src"
        :width="p.leaf.frame.natW"
        :height="p.leaf.frame.natH"
        :transform="`translate(${p.leaf.frame.tx} ${p.leaf.frame.ty}) scale(${p.leaf.frame.scale})`"
        :filter="p.leaf.blur ? `url(#${clipId('blur-panel', p.leaf.id)})` : undefined"
        preserveAspectRatio="none"
      />
      <rect
        v-if="p.leaf.frame && p.leaf.overlay"
        :x="p.bbox.x"
        :y="p.bbox.y"
        :width="p.bbox.w"
        :height="p.bbox.h"
        :fill="`url(#thumb-${page.id}-overlay-panel-${p.leaf.id})`"
      />
      <rect
        v-if="!p.leaf.frame"
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
      v-if="border > 0"
      :x="border / 2"
      :y="border / 2"
      :width="stageSize.w - border"
      :height="stageSize.h - border"
      fill="none"
      :stroke="store.border.color"
      :stroke-width="border"
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
        :filter="c.blur ? `url(#${clipId('blur-circle', c.id)})` : undefined"
        preserveAspectRatio="none"
      />
      <circle
        v-if="c.frame && c.overlay"
        :cx="c.x + c.d / 2"
        :cy="c.y + c.d / 2"
        :r="c.d / 2"
        :fill="`url(#thumb-${page.id}-overlay-circle-${c.id})`"
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
        :font-size="textFontSize(pageNumber.el)"
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
