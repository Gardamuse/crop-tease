<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'

import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from '@/lib/color'
import { clamp } from '@/lib/math'

// The app's own color picker: a saturation/brightness square, a hue bar and
// a hex field. The color changes as either is dragged, so there's nothing to
// confirm.
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [color: string] }>()

// The hue is kept here too: a grey or black has none of its own, and
// dragging through one shouldn't lose it.
// a color that isn't #rgb or #rrggbb (a project may use any CSS color) starts from black
const asHex = (color: string) => normalizeHex(color) ?? '#000000'
const hsv = ref<Hsv>(hexToHsv(asHex(props.modelValue)))
let sent = asHex(props.modelValue)
watch(
  () => asHex(props.modelValue),
  (hex) => {
    if (hex !== sent) hsv.value = hexToHsv(hex) // changed elsewhere (e.g. a preset picked)
  },
)

const hex = computed(() => hsvToHex(hsv.value))
const hueColor = computed(() => hsvToHex({ h: hsv.value.h, s: 1, v: 1 }))

function set(change: Partial<Hsv>) {
  hsv.value = { ...hsv.value, ...change }
  sent = hex.value
  emit('update:modelValue', sent)
}

const squareEl = useTemplateRef('square')
const hueEl = useTemplateRef('hue')

/** Follows a drag over an element, reporting the pointer's position in it as 0-1 fractions. */
function drag(e: PointerEvent, el: HTMLElement, onMove: (x: number, y: number) => void) {
  if (e.button !== 0) return
  const at = (ev: PointerEvent) => {
    const r = el.getBoundingClientRect()
    onMove(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1))
  }
  at(e)
  el.setPointerCapture(e.pointerId)
  const up = () => {
    el.removeEventListener('pointermove', at)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', at)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

const onSquare = (e: PointerEvent) => drag(e, squareEl.value!, (x, y) => set({ s: x, v: 1 - y }))
const onHue = (e: PointerEvent) => drag(e, hueEl.value!, (x) => set({ h: x * 360 }))

// arrow keys nudge the focused knob (Shift for bigger steps)
function onSquareKey(e: KeyboardEvent) {
  const step = e.shiftKey ? 0.1 : 0.01
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]
  if (!d) return
  e.preventDefault()
  e.stopPropagation()
  set({ s: clamp(hsv.value.s + d[0]!, 0, 1), v: clamp(hsv.value.v + d[1]!, 0, 1) })
}

function onHueKey(e: KeyboardEvent) {
  const step = e.shiftKey ? 10 : 1
  const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key]
  if (d === undefined) return
  e.preventDefault()
  e.stopPropagation()
  set({ h: (hsv.value.h + d + 360) % 360 })
}

// the hex field takes #rgb or #rrggbb, with or without the #, once it's done
function onHex(e: Event) {
  const input = e.target as HTMLInputElement
  const color = normalizeHex(input.value)
  if (color) {
    hsv.value = hexToHsv(color)
    sent = color
    emit('update:modelValue', color)
  }
  input.value = hex.value
}
</script>

<template>
  <div class="color-picker">
    <div ref="square" class="square" :style="{ background: hueColor }" @pointerdown.prevent="onSquare">
      <button
        class="knob"
        :style="{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }"
        role="slider"
        aria-label="Saturation and brightness"
        :aria-valuetext="hex"
        @keydown="onSquareKey"
      />
    </div>
    <div ref="hue" class="hue" @pointerdown.prevent="onHue">
      <button
        class="knob"
        :style="{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }"
        role="slider"
        aria-label="Hue"
        aria-valuemin="0"
        aria-valuemax="360"
        :aria-valuenow="Math.round(hsv.h)"
        @keydown="onHueKey"
      />
    </div>
    <div class="value">
      <span class="preview" :style="{ background: hex }" />
      <input
        type="text"
        :value="hex"
        spellcheck="false"
        aria-label="Hex color"
        @change="onHex"
        @keydown.enter="onHex"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.color-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 208px;
}

.square {
  position: relative;
  height: 132px;
  border-radius: 3px;
  cursor: crosshair;
  touch-action: none;

  // over the hue color (set inline): white to it across, darkening to black down
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, transparent);
    box-shadow: inset 0 0 0 1px $line;
  }
}

.hue {
  position: relative;
  height: 10px;
  margin: 0 7px;
  cursor: pointer;
  touch-action: none;

  &::before {
    content: '';
    position: absolute;
    inset: 0 -7px;
    border-radius: 5px;
    background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    box-shadow: inset 0 0 0 1px $line;
  }
}

// the app's slider knob, filled with the color it points at
.knob {
  position: absolute;
  z-index: 1;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow:
    0 0 0 1px $accent,
    0 0 0 4px $accent-soft;
  cursor: grab;
  transition: box-shadow 0.2s ease;

  .hue & {
    top: 50%;
  }

  &:hover,
  &:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 1px $accent,
      0 0 0 5px $accent-soft,
      0 0 10px $accent-dim;
  }

  &:active {
    cursor: grabbing;
  }
}

.value {
  display: flex;
  align-items: center;
  gap: 8px;

  .preview {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid rgba($shade, 0.25);
  }

  input {
    @include field;
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    font-size: 0.8rem;
    text-transform: lowercase;
  }
}
</style>
