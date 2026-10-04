<script setup lang="ts">
import { computed } from 'vue'

import type { MenuChoice } from '@/lib/contextMenu'

// A menu row's choices: a grid of small buttons (e.g. a speech bubble's
// tail spots), or else one segmented control, its active choice raised.
// (Colors have their own row, ColorChoices.)
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

const segmented = computed(() => !props.columns)

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
      <button
        v-else
        role="menuitemradio"
        :aria-checked="o.active?.() ?? false"
        :aria-label="o.title ?? labelOf(o)"
        :title="o.title ?? labelOf(o)"
        :class="{ active: o.active?.() }"
        @click="pick(o)"
      >
        {{ labelOf(o) }}
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

  // small separate buttons, e.g. the tail spots
  &.grid {
    display: grid;
    gap: 2px;

    button {
      min-width: 26px;
      height: 22px;
      padding: 0 4px;
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
}
</style>
