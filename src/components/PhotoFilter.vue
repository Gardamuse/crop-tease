<script setup lang="ts">
import { computed } from 'vue'

import type { ImageFrame } from '@/lib/imageFrame'
import { balanceTables, blurRadius, effectiveEffects, levelsTransfers, type PhotoEffects } from '@/lib/photoEffects'

// The SVG filter for a photo's blur, levels and color balance, applied in
// that order, for use inside an <svg>. Its region is the photo itself: the
// blur repeats the edge pixels outward, so the photo's edges stay solid
// instead of fading.
const props = defineProps<{
  id: string
  /** the photo's own; the project's levels and color balance stand in where it has none */
  effects: PhotoEffects
  frame: ImageFrame
}>()

const effects = computed(() => effectiveEffects(props.effects))

// each pixel's lightness (the channels' average) in all three channels, alpha kept
const LIGHTNESS = '1 1 1 0 0  1 1 1 0 0  1 1 1 0 0  0 0 0 3 0'.replace(/\S+/g, (n) => String(Number(n) / 3))

const transfers = computed(() => (effects.value.levels ? levelsTransfers(effects.value.levels) : []))
const balance = computed(() => {
  const b = effects.value.colorBalance
  return b && { tables: balanceTables(b), preserveLuminosity: b.preserveLuminosity }
})

// which result each stage starts from
const afterBlur = computed(() => (effects.value.blur ? 'blurred' : 'SourceGraphic'))
const afterLevels = computed(() => (transfers.value.length ? 'leveled' : afterBlur.value))
</script>

<template>
  <filter :id="id" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
    <feGaussianBlur
      v-if="effects.blur"
      in="SourceGraphic"
      :stdDeviation="blurRadius(effects.blur, props.frame)"
      edgeMode="duplicate"
      result="blurred"
    />
    <feComponentTransfer
      v-for="(t, i) in transfers"
      :key="i"
      :in="i === 0 ? afterBlur : 'levels-in'"
      :result="i === transfers.length - 1 ? 'leveled' : 'levels-in'"
    >
      <feFuncR type="linear" :slope="t.slope" :intercept="t.intercept" />
      <feFuncG type="linear" :slope="t.slope" :intercept="t.intercept" />
      <feFuncB type="linear" :slope="t.slope" :intercept="t.intercept" />
    </feComponentTransfer>
    <template v-if="balance">
      <!-- each channel's shift for the pixel's lightness, looked up and stored as 0.5 + shift / 2 -->
      <feColorMatrix :in="afterLevels" type="matrix" :values="LIGHTNESS" result="lightness" />
      <feComponentTransfer in="lightness" result="shift">
        <feFuncR type="table" :tableValues="balance.tables[0]" />
        <feFuncG type="table" :tableValues="balance.tables[1]" />
        <feFuncB type="table" :tableValues="balance.tables[2]" />
      </feComponentTransfer>
      <!-- photo + 2 * stored - 1 = photo + shift -->
      <feComposite
        :in="afterLevels"
        in2="shift"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="2"
        k4="-1"
        result="balanced"
      />
      <!-- keep the lightness: add back what the shift changed, the same way -->
      <template v-if="balance.preserveLuminosity">
        <feColorMatrix in="balanced" type="matrix" :values="LIGHTNESS" result="new-lightness" />
        <feComposite
          in="lightness"
          in2="new-lightness"
          operator="arithmetic"
          k1="0"
          k2="0.5"
          k3="-0.5"
          k4="0.5"
          result="lost"
        />
        <feComposite in="balanced" in2="lost" operator="arithmetic" k1="0" k2="1" k3="2" k4="-1" />
      </template>
    </template>
  </filter>
</template>
