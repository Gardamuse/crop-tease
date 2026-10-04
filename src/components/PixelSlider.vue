<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'

// A slider paired with a number box, both editing the same pixel value.
const props = withDefaults(
  defineProps<{
    modelValue: number
    max: number
    min?: number
    label: string
    disabled?: boolean
    /** if given, the slider snaps to these values (the number box still takes anything in min..max) */
    steps?: number[]
    /** shown after the number */
    unit?: string
    /** a CSS background for the track (e.g. a color gradient), drawn thicker */
    track?: string
    /** if given, double-clicking the slider sets this value */
    resetValue?: number
    /** if given, sliding with Shift held snaps to multiples of this */
    shiftSnap?: number
  }>(),
  { min: 0, disabled: false, unit: 'px' },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

/** The step nearest the current value, for the slider's position. */
const stepIndex = computed(() => {
  const steps = props.steps
  if (!steps?.length) return 0
  let best = 0
  steps.forEach((s, i) => {
    if (Math.abs(s - props.modelValue) < Math.abs(steps[best]! - props.modelValue)) best = i
  })
  return best
})

// whether Shift is held, from the latest key or pointer event (a slider's
// input event doesn't say)
let shift = false
const trackShift = (e: KeyboardEvent | PointerEvent) => (shift = e.shiftKey)
const SHIFT_EVENTS = ['keydown', 'keyup', 'pointerdown', 'pointermove'] as const
onMounted(() => {
  if (props.shiftSnap) for (const type of SHIFT_EVENTS) window.addEventListener(type, trackShift, true)
})
onBeforeUnmount(() => {
  for (const type of SHIFT_EVENTS) window.removeEventListener(type, trackShift, true)
})

function onSlide(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  const snap = props.shiftSnap
  if (snap && shift) emit('update:modelValue', Math.round(value / snap) * snap)
  else emit('update:modelValue', props.steps ? props.steps[value]! : value)
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const value = Number(input.value)
  if (input.value !== '' && Number.isFinite(value)) emit('update:modelValue', value)
}

// the number box shows the clamped value once editing is done
function onChange(e: Event) {
  onInput(e)
  ;(e.target as HTMLInputElement).value = String(props.modelValue)
}
</script>

<template>
  <div class="pixel-slider" :class="{ disabled, 'custom-track': track }" :style="track ? { '--track': track } : undefined">
    <input
      type="range"
      :min="steps ? 0 : min"
      :max="steps ? steps.length - 1 : max"
      :value="steps ? stepIndex : modelValue"
      :aria-label="label"
      :aria-valuetext="`${modelValue} ${unit}`"
      :disabled="disabled"
      @input="onSlide"
      @dblclick="resetValue !== undefined && emit('update:modelValue', resetValue)"
    />
    <input
      type="number"
      :min="min"
      :max="max"
      :disabled="disabled"
      :value="modelValue"
      :aria-label="unit === 'px' ? `${label} in pixels` : label"
      @change="onChange"
    />
    <span>{{ unit }}</span>
  </div>
</template>

<style scoped lang="scss">
.pixel-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.72rem;
  color: $text-dim;

  &.disabled {
    opacity: 0.45;
  }

  input[type='number'] {
    @include field;
    width: 54px;
    padding: 5px 6px;
  }
}

// a thin line with a glowing accent knob
input[type='range'] {
  flex: 1;
  min-width: 0;
  height: 18px;
  margin: 0;
  background: none;
  appearance: none;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    height: 2px;
    border-radius: 1px;
    background: $line;
  }

  &::-moz-range-track {
    height: 2px;
    border-radius: 1px;
    background: $line;
  }

  &::-moz-range-progress {
    height: 2px;
    background: $accent-dim;
  }

  // a colored track, e.g. a color balance axis, thick enough to read
  .custom-track & {
    &::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 3px;
      background: var(--track);
    }

    &::-moz-range-track {
      height: 6px;
      border-radius: 3px;
      background: var(--track);
    }

    &::-moz-range-progress {
      background: none;
    }

    &::-webkit-slider-thumb {
      margin-top: -3px;
      background: #fff;
      box-shadow:
        0 0 0 2px $accent,
        0 0 0 5px $accent-soft;
    }

    &::-moz-range-thumb {
      background: #fff;
      box-shadow:
        0 0 0 2px $accent,
        0 0 0 5px $accent-soft;
    }

    &:hover::-webkit-slider-thumb,
    &:focus-visible::-webkit-slider-thumb {
      box-shadow:
        0 0 0 2px $accent,
        0 0 0 6px $accent-soft,
        0 0 10px $accent-dim;
    }

    &:hover::-moz-range-thumb,
    &:focus-visible::-moz-range-thumb {
      box-shadow:
        0 0 0 2px $accent,
        0 0 0 6px $accent-soft,
        0 0 10px $accent-dim;
    }
  }

  &::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -5px;
    border: none;
    border-radius: 50%;
    background: $accent;
    box-shadow: 0 0 0 3px $accent-soft;
    transition: box-shadow 0.2s ease;
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 50%;
    background: $accent;
    box-shadow: 0 0 0 3px $accent-soft;
    transition: box-shadow 0.2s ease;
  }

  &:hover::-webkit-slider-thumb,
  &:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 5px $accent-soft, 0 0 10px $accent-dim;
  }

  &:hover::-moz-range-thumb,
  &:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 5px $accent-soft, 0 0 10px $accent-dim;
  }

  &:focus {
    outline: none;
  }

  &:disabled {
    cursor: default;
  }
}
</style>
