<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { clamp } from '@/lib/math'

// A low and a high value on one black-to-white bar, like the level sliders
// in image editors, styled like the app's other sliders: the label and both
// values on a line, the bar below it at full width. Drag either knob (or
// press the bar to bring the nearer one there), use the arrow keys on it
// (Shift for steps of 10), or type into the boxes. Double-clicking the bar
// resets both ends.
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

const barEl = useTemplateRef('bar')

const fraction = (v: number) => (v - props.min) / (props.max - props.min)
const percent = (v: number) => `${fraction(v) * 100}%`

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
  const r = barEl.value!.getBoundingClientRect()
  return props.min + ((clientX - r.left) / r.width) * (props.max - props.min)
}

// a press picks the knob pressed, or else the nearer one (moving it there), and drags it
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const knob = (e.target as HTMLElement).dataset.end
  const at = valueAt(e.clientX)
  const [low, high] = props.modelValue
  const end: 0 | 1 = knob ? (Number(knob) as 0 | 1) : Math.abs(at - low) <= Math.abs(at - high) ? 0 : 1
  if (!knob) setEnd(end, at)
  ;(e.target as HTMLElement).closest<HTMLElement>('.bar')?.querySelector<HTMLElement>(`[data-end="${end}"]`)?.focus()
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
    <div class="head">
      <span class="label">{{ label }}</span>
      <input
        type="number"
        :min="min"
        :max="max"
        :value="modelValue[0]"
        :aria-label="`${label}: black point`"
        @change="onBox($event, 0)"
      />
      <span class="dash">–</span>
      <input
        type="number"
        :min="min"
        :max="max"
        :value="modelValue[1]"
        :aria-label="`${label}: white point`"
        @change="onBox($event, 1)"
      />
    </div>
    <div
      ref="bar"
      class="bar"
      @pointerdown.prevent="onPointerDown"
      @dblclick="emit('update:modelValue', [min, max])"
    >
      <div class="gradient" />
      <!-- the tones outside the range, dimmed -->
      <div class="outside" :style="{ left: 0, width: percent(modelValue[0]) }" />
      <div class="outside" :style="{ left: percent(modelValue[1]), right: 0 }" />
      <button
        v-for="end in [0, 1] as const"
        :key="end"
        class="knob"
        :class="end === 0 ? 'black' : 'white'"
        :data-end="end"
        :style="{ left: percent(modelValue[end]) }"
        role="slider"
        :aria-label="`${label}: ${end === 0 ? 'black' : 'white'} point`"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-valuenow="modelValue[end]"
        @keydown="onKey($event, end)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.range-slider {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

// the label, then "black – white" in number boxes like the other sliders'
.head {
  display: flex;
  align-items: center;
  gap: 6px;

  .label {
    @include micro-label;
    flex: 1;
  }

  input[type='number'] {
    @include field;
    width: 54px;
    padding: 4px 6px;
    font-size: 0.72rem;
  }

  .dash {
    color: $text-dim;
    font-size: 0.72rem;
  }
}

// a slim black-to-white bar across the whole row, knobs riding on it; the
// sides are inset by a knob's radius so the knobs stay inside at 0 and 255
.bar {
  position: relative;
  height: 20px;
  margin: 0 8px;
  cursor: pointer;
  touch-action: none;
}

.gradient,
.outside {
  position: absolute;
  top: 7px;
  height: 6px;
}

.gradient {
  left: -1px;
  right: -1px;
  border-radius: 3px;
  background: linear-gradient(to right, #000, #fff);
  box-shadow: inset 0 0 0 1px $line;
}

.outside {
  background: repeating-linear-gradient(135deg, rgba($bg-panel-alt, 0.75) 0 3px, rgba($bg-panel-alt, 0.35) 3px 6px);
}

// the app's slider knob (see PixelSlider), filled with the tone it sets
.knob {
  position: absolute;
  top: 3px;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  padding: 0;
  border: none;
  border-radius: 50%;
  box-shadow:
    0 0 0 2px $accent,
    0 0 0 5px $accent-soft;
  cursor: grab;
  transition: box-shadow 0.2s ease;

  &.black {
    background: #111;
  }

  &.white {
    background: #fff;
  }

  &:hover,
  &:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px $accent,
      0 0 0 6px $accent-soft,
      0 0 10px $accent-dim;
  }

  &:active {
    cursor: grabbing;
  }
}
</style>
