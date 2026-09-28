<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { clamp } from '@/lib/math'

// A low and a high value on one black-to-white track, like the level sliders
// in image editors: drag either triangle (or press the track to bring the
// nearer one there), use the arrow keys on it (Shift for steps of 10), or
// type into the boxes at the ends. Double-clicking the track resets both.
const props = defineProps<{
  modelValue: [number, number]
  min: number
  max: number
  /** the least the high value must be above the low one */
  minGap: number
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: [number, number]]
}>()

const trackEl = useTemplateRef('track')

const percent = (v: number) => `${((v - props.min) / (props.max - props.min)) * 100}%`

/** Sets one end, keeping the other at least minGap away (by pushing it along if needed). */
function setEnd(end: 0 | 1, value: number) {
  const v = clamp(Math.round(value), props.min, props.max)
  let [low, high] = props.modelValue
  if (end === 0) {
    low = Math.min(v, props.max - props.minGap)
    high = Math.max(high, low + props.minGap)
  } else {
    high = Math.max(v, props.min + props.minGap)
    low = Math.min(low, high - props.minGap)
  }
  if (low !== props.modelValue[0] || high !== props.modelValue[1]) emit('update:modelValue', [low, high])
}

function valueAt(clientX: number): number {
  const r = trackEl.value!.getBoundingClientRect()
  return props.min + ((clientX - r.left) / r.width) * (props.max - props.min)
}

// a press picks the nearer handle (the one pressed, if it's a handle) and drags it
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  const [low, high] = props.modelValue
  const at = valueAt(e.clientX)
  const end: 0 | 1 = target.dataset.end
    ? (Number(target.dataset.end) as 0 | 1)
    : Math.abs(at - low) <= Math.abs(at - high)
      ? 0
      : 1
  if (!target.dataset.end) setEnd(end, at)
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent) => setEnd(end, valueAt(ev.clientX))
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

function onKey(e: KeyboardEvent, end: 0 | 1) {
  const step = e.shiftKey ? 10 : 1
  const delta = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key]
  if (delta === undefined) return
  e.preventDefault()
  e.stopPropagation() // not the menu's up/down focus keys
  setEnd(end, props.modelValue[end] + delta)
}

// the boxes show the kept value once editing is done
function onBox(e: Event, end: 0 | 1) {
  const input = e.target as HTMLInputElement
  const value = Number(input.value)
  if (input.value !== '' && Number.isFinite(value)) setEnd(end, value)
  input.value = String(props.modelValue[end])
}
</script>

<template>
  <div class="range-slider">
    <input
      type="number"
      :min="min"
      :max="max"
      :value="modelValue[0]"
      :aria-label="`${label}: low`"
      @change="onBox($event, 0)"
    />
    <div
      ref="track"
      class="track"
      @pointerdown.prevent="onPointerDown"
      @dblclick="emit('update:modelValue', [min, max])"
    >
      <div class="gradient" />
      <button
        v-for="end in [0, 1] as const"
        :key="end"
        class="handle"
        :class="end === 0 ? 'low' : 'high'"
        :data-end="end"
        :style="{ left: percent(modelValue[end]) }"
        role="slider"
        :aria-label="`${label}: ${end === 0 ? 'low' : 'high'}`"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-valuenow="modelValue[end]"
        @keydown="onKey($event, end)"
      />
    </div>
    <input
      type="number"
      :min="min"
      :max="max"
      :value="modelValue[1]"
      :aria-label="`${label}: high`"
      @change="onBox($event, 1)"
    />
  </div>
</template>

<style scoped lang="scss">
.range-slider {
  display: flex;
  align-items: center;
  gap: 8px;

  input[type='number'] {
    @include field;
    width: 48px;
    padding: 4px 5px;
    font-size: 0.72rem;
  }
}

// the black-to-white bar, with the handles' triangles pointing up at it from below
.track {
  position: relative;
  flex: 1;
  min-width: 110px;
  height: 22px;
  cursor: pointer;
  touch-action: none;
}

.gradient {
  position: absolute;
  left: 0;
  right: 0;
  top: 2px;
  height: 8px;
  border-radius: 2px;
  background: linear-gradient(to right, #000, #fff);
  box-shadow: inset 0 0 0 1px rgba($shade, 0.25);
}

.handle {
  position: absolute;
  top: 11px;
  width: 12px;
  height: 10px;
  margin-left: -6px;
  padding: 0;
  border: none;
  background: none;
  cursor: grab;
  // a triangle with a thin outline, drawn by its two layers
  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    clip-path: polygon(50% 0, 100% 100%, 0 100%);
  }
  &::before {
    background: $shade;
  }
  &::after {
    inset: 2px 2.5px 1px;
  }
  &.low::after {
    background: #222;
  }
  &.high::after {
    background: #fff;
  }

  &:hover::before,
  &:focus-visible::before {
    background: $accent;
  }

  &:focus-visible {
    outline: none;
  }

  &:active {
    cursor: grabbing;
  }
}
</style>
