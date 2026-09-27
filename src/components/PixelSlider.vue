<script setup lang="ts">
import { computed } from 'vue'

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
  }>(),
  { min: 0, disabled: false },
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

function onSlide(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  emit('update:modelValue', props.steps ? props.steps[value]! : value)
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
  <div class="pixel-slider" :class="{ disabled }">
    <input
      type="range"
      :min="steps ? 0 : min"
      :max="steps ? steps.length - 1 : max"
      :value="steps ? stepIndex : modelValue"
      :aria-label="label"
      :aria-valuetext="`${modelValue} px`"
      :disabled="disabled"
      @input="onSlide"
    />
    <input
      type="number"
      :min="min"
      :max="max"
      :disabled="disabled"
      :value="modelValue"
      :aria-label="`${label} in pixels`"
      @change="onChange"
    />
    <span>px</span>
  </div>
</template>

<style scoped lang="scss">
.pixel-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: $muted;

  &.disabled {
    opacity: 0.45;
  }

  input[type='range'] {
    flex: 1;
    min-width: 0;
    accent-color: $pink-deep;
  }

  input[type='number'] {
    width: 62px;
    font: inherit;
    font-size: 0.85rem;
    padding: 6px 6px;
    border-radius: 8px;
    border: 1px solid $toolbar-border;
    background: #fff;
    color: $ink;

    &:focus {
      outline: 2px solid $pink;
      outline-offset: -1px;
    }
  }
}
</style>
