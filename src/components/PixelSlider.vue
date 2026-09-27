<script setup lang="ts">
// A slider paired with a number box, both editing the same pixel value.
const props = defineProps<{
  modelValue: number
  max: number
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

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
  <div class="pixel-slider">
    <input type="range" min="0" :max="max" :value="modelValue" :aria-label="label" @input="onInput" />
    <input
      type="number"
      min="0"
      :max="max"
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
