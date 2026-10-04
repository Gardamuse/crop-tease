<script setup lang="ts">
import { computed } from 'vue'

import CustomColorSwatch from './CustomColorSwatch.vue'
import { BLACK } from '@/lib/constants'
import { BASE_COLORS, PROJECT_COLOR_SLOTS, projectColors } from '@/lib/projectColors'

// Every color row, in the sidebar and in menus: optionally a no-color
// choice (None, or Auto for a placeholder color), black and white, slots
// for the colors used most elsewhere in the project (empty ones held as
// faint rings), and a swatch that opens the color picker, showing the
// color in use when it's none of the others.
const props = defineProps<{
  modelValue: string | null
  label: string
  /** which setting this is (see projectColors), so its own color isn't counted */
  ownKey: string
  /** a choice for null: 'none' (a struck-through dot) or 'auto' (the word Auto) */
  none?: 'none' | 'auto'
  /** hover text for the null choice */
  noneTitle?: string
  /** where the picker starts while the value is null (default black) */
  startColor?: string
  /** without a null choice, keep its room, so the swatches line up with a row that has one */
  alignNone?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const current = computed(() => props.modelValue?.toLowerCase() ?? null)
const fromProject = computed(() => projectColors(props.ownKey))
const emptySlots = computed(() => PROJECT_COLOR_SLOTS - fromProject.value.length)
const isCustom = computed(
  () =>
    current.value !== null &&
    !BASE_COLORS.some((c) => c.color === current.value) &&
    !fromProject.value.includes(current.value),
)
</script>

<template>
  <div class="color-choices" role="radiogroup" :aria-label="label">
    <button
      v-if="none"
      class="dot"
      :class="[none, { active: current === null }]"
      role="radio"
      :title="noneTitle ?? (none === 'auto' ? 'Auto' : 'None')"
      :aria-label="none === 'auto' ? 'Auto' : 'None'"
      :aria-checked="current === null"
      @click="emit('update:modelValue', null)"
    >
      <template v-if="none === 'auto'">A</template>
    </button>
    <span v-else-if="alignNone" class="dot spacer" aria-hidden="true" />
    <button
      v-for="c in BASE_COLORS"
      :key="c.color"
      class="dot"
      role="radio"
      :title="c.label"
      :aria-label="c.label"
      :aria-checked="current === c.color"
      :class="{ active: current === c.color }"
      :style="{ background: c.color }"
      @click="emit('update:modelValue', c.color)"
    />
    <span class="divider" aria-hidden="true" />
    <span class="slots">
      <button
        v-for="color in fromProject"
        :key="color"
        class="dot"
        role="radio"
        :title="`${color}, used in this project`"
        :aria-label="`${color}, used in this project`"
        :aria-checked="current === color"
        :class="{ active: current === color }"
        :style="{ background: color }"
        @click="emit('update:modelValue', color)"
      />
      <span
        v-for="i in emptySlots"
        :key="`empty-${i}`"
        class="dot empty"
        title="Colors you use elsewhere in this project show up here"
      />
    </span>
    <span class="divider" aria-hidden="true" />
    <CustomColorSwatch
      class="dot"
      :model-value="modelValue ?? startColor ?? BLACK"
      :active="isCustom"
      label="Pick a color"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped lang="scss">
$dot: 20px;

.color-choices {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
}

// the project's colors, between black and white and the picker
.slots {
  display: flex;
  gap: 4px;
}

// a short line setting the project's colors apart
.divider {
  flex: none;
  width: 1px;
  height: 14px;
  margin: 0 2px;
  background: $line;
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

  // a ring of the background (--swatch-gap, set by menus), then pink, around the chosen one
  &.active {
    box-shadow:
      0 0 0 2px var(--swatch-gap, #{$bg-panel}),
      0 0 0 3px $accent,
      0 0 10px $accent-dim;
  }
}

// the room of a null choice this row doesn't have
.dot.spacer {
  visibility: hidden;
}

// a slot no project color fills yet
.dot.empty {
  border: 1px dashed rgba($shade, 0.22);
  background: none;
  cursor: default;

  &:hover {
    transform: none;
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

// a placeholder color: a dot marked A
.auto {
  font: 700 0.62rem $font-mono;
  color: $text-dim;
  line-height: 1;
}
</style>
