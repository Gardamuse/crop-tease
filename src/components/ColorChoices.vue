<script setup lang="ts">
import { computed } from 'vue'

import CustomColorSwatch from './CustomColorSwatch.vue'

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
      class="dot none"
      role="radio"
      title="None"
      aria-label="None"
      :aria-checked="current === null"
      :class="{ active: current === null }"
      @click="emit('update:modelValue', null)"
    />
    <button
      v-for="p in presets"
      :key="p.color"
      class="dot"
      role="radio"
      :title="p.label"
      :aria-label="p.label"
      :aria-checked="current === p.color"
      :class="{ active: current === p.color }"
      :style="{ background: p.color }"
      @click="emit('update:modelValue', p.color)"
    />
    <CustomColorSwatch
      class="dot"
      :model-value="modelValue ?? '#000000'"
      :active="isCustom"
      label="Pick a custom color"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped lang="scss">
$dot: 24px;

.choices {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  flex: none;
  position: relative;
  width: $dot;
  height: $dot;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba($shade, 0.25);
  background: $bg-field;
  cursor: pointer;
  transition: transform 0.1s;

  &:hover {
    transform: scale(1.12);
  }

  // a ring of page color, then pink, around the chosen one
  &.active {
    box-shadow:
      0 0 0 2px $bg-panel,
      0 0 0 3px $accent,
      0 0 10px $accent-dim;
  }
}

// "no color": an empty dot struck through
.none::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 1px;
  bottom: 1px;
  width: 1.5px;
  background: $accent;
  transform: translateX(-50%) rotate(45deg);
}
</style>
