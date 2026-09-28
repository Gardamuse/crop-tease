<script setup lang="ts">
import { computed } from 'vue'

import type { ImageFrame } from '@/lib/imageFrame'
import { blurRadius, levelsTransfers, type PhotoEffects } from '@/lib/photoEffects'

// The SVG filter for a photo's blur and levels, for use inside an <svg>.
// Its region is the photo itself: the blur repeats the edge pixels outward,
// so the photo's edges stay solid instead of fading.
const { effects, frame } = defineProps<{
  id: string
  effects: PhotoEffects
  frame: ImageFrame
}>()

const transfers = computed(() => (effects.levels ? levelsTransfers(effects.levels) : []))
</script>

<template>
  <filter :id="id" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
    <feGaussianBlur v-if="effects.blur" :stdDeviation="blurRadius(effects.blur, frame)" edgeMode="duplicate" />
    <feComponentTransfer v-for="(t, i) in transfers" :key="i">
      <feFuncR type="linear" :slope="t.slope" :intercept="t.intercept" />
      <feFuncG type="linear" :slope="t.slope" :intercept="t.intercept" />
      <feFuncB type="linear" :slope="t.slope" :intercept="t.intercept" />
    </feComponentTransfer>
  </filter>
</template>
