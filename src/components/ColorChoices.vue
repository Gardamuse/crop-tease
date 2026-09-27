<script setup lang="ts">
import { computed } from 'vue'

// Preset color buttons plus a Custom button that opens the native picker,
// optionally with a "None" choice (null).
const props = defineProps<{
  modelValue: string | null
  presets: { label: string; color: string }[]
  allowNone?: boolean
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const current = computed(() => props.modelValue?.toLowerCase() ?? null)
const isCustom = computed(() => current.value !== null && !props.presets.some((p) => p.color === current.value))
</script>

<template>
  <div class="choices" role="radiogroup" :aria-label="label">
    <button
      v-if="allowNone"
      role="radio"
      :aria-checked="current === null"
      :class="{ active: current === null }"
      @click="emit('update:modelValue', null)"
    >
      None
    </button>
    <button
      v-for="p in presets"
      :key="p.color"
      role="radio"
      :aria-checked="current === p.color"
      :class="{ active: current === p.color }"
      @click="emit('update:modelValue', p.color)"
    >
      <span class="swatch" :style="{ background: p.color }" />{{ p.label }}
    </button>
    <label class="choice custom" :class="{ active: isCustom }" role="radio" :aria-checked="isCustom" title="Pick a custom color">
      <span class="swatch" :style="{ background: isCustom ? modelValue! : undefined }" />Custom
      <input
        type="color"
        :value="modelValue ?? '#000000'"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </label>
  </div>
</template>

<style scoped lang="scss">
.choices {
  display: flex;
  gap: 6px;
}

button,
.choice {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 4px;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 8px;
  border: 1px solid $toolbar-border;
  background: #fff;
  color: $ink;
  cursor: pointer;

  &:hover {
    background: #fff0f8;
    border-color: $pink;
  }

  &.active {
    background: #fff0f8;
    border-color: $pink-deep;
    color: $pink-deep;
  }
}

.custom {
  position: relative;

  // the native picker covers the whole button so any click opens it
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
}

.swatch {
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba($ink, 0.35);
  // an unset custom swatch shows a rainbow hint
  background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
}
</style>
