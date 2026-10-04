<script setup lang="ts">
import { computed } from 'vue'

import CustomColorSwatch from './CustomColorSwatch.vue'
import type { MenuChoice } from '@/lib/contextMenu'

// A menu row's choices: color swatches, a grid of small buttons (e.g. a
// speech bubble's tail spots), or else one segmented control, its active
// choice raised.
const props = defineProps<{
  options: (MenuChoice | null)[]
  label: string
  columns?: number
}>()

const emit = defineEmits<{
  /** a choice was picked (after its own pick ran) */
  picked: []
}>()

const labelOf = (o: MenuChoice) => (typeof o.label === 'function' ? o.label() : o.label)

const segmented = computed(() => !props.columns && props.options.every((o) => o && !o.swatch && !o.pickColor))

function pick(o: MenuChoice) {
  o.pick()
  emit('picked')
}
</script>

<template>
  <div
    class="choices"
    :class="{ grid: columns, segmented }"
    role="group"
    :aria-label="label"
    :style="columns ? { gridTemplateColumns: `repeat(${columns}, auto)` } : undefined"
  >
    <template v-for="(o, j) in options" :key="j">
      <span v-if="!o" class="spacer" />
      <CustomColorSwatch
        v-else-if="o.pickColor"
        class="custom-color"
        :model-value="o.pickColor.value()"
        :active="o.active?.() ?? false"
        :label="o.title ?? labelOf(o)"
        @update:model-value="o.pickColor.set"
      />
      <button
        v-else
        role="menuitemradio"
        :aria-checked="o.active?.() ?? false"
        :aria-label="o.title ?? labelOf(o)"
        :title="o.title ?? labelOf(o)"
        :class="{ active: o.active?.(), swatch: o.swatch }"
        :style="o.swatch ? { background: o.swatch } : undefined"
        @click="pick(o)"
      >
        <template v-if="!o.swatch">{{ labelOf(o) }}</template>
      </button>
    </template>
  </div>
</template>

<style scoped lang="scss">
.choices {
  display: flex;
  flex: none;
  gap: 3px;

  button {
    font: inherit;
    font-size: 0.74rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 2px;
    background: none;
    color: $text-main;
    cursor: pointer;

    &:focus-visible {
      outline: 1px solid $accent;
    }
  }

  // a word among swatches (e.g. Auto), or the small separate buttons of a grid (e.g. the tail spots)
  &:not(.segmented) button:not(.swatch) {
    height: 22px;
    padding: 0 8px;
    border: 1px solid $line;
    color: $text-dim;

    &:hover {
      color: $text-main;
      background: $accent-soft;
    }

    &.active {
      border-color: $accent;
      color: $accent-ink;
      background: $accent-soft;
    }
  }

  &.grid {
    display: grid;
    gap: 2px;

    button {
      min-width: 26px;
      padding: 0 4px;
    }
  }

  // one control in a sunken track, the active choice raised
  &.segmented {
    gap: 0;
    padding: 2px;
    border-radius: $radius;
    background: $bg-sunken;
    border: 1px solid $line;

    button {
      padding: 3px 9px;
      color: $text-dim;
      transition:
        background 0.12s ease,
        color 0.12s ease;

      &:hover {
        color: $text-main;
      }

      &.active {
        background: $bg-panel-alt;
        color: $accent-ink;
        box-shadow: 0 1px 2px rgba($shade, 0.18);
      }
    }
  }

  button.swatch {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid rgba($shade, 0.25);
    border-radius: 50%;

    &.active {
      box-shadow:
        0 0 0 2px $bg-panel-alt,
        0 0 0 3px $accent,
        0 0 10px $accent-dim;
    }
  }

  // a swatch like the others (a rainbow until a custom color is chosen), opening the color picker
  .custom-color {
    flex: none;
    width: 22px;
    height: 22px;
    border: 1px solid rgba($shade, 0.25);
    border-radius: 50%;

    &:hover,
    &:focus-visible {
      background: none;
    }

    &.active {
      box-shadow:
        0 0 0 2px $bg-panel-alt,
        0 0 0 3px $accent,
        0 0 10px $accent-dim;
    }
  }
}
</style>
