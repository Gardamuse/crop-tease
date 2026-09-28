<script setup lang="ts">
import CustomColorSwatch from './CustomColorSwatch.vue'
import PixelSlider from './PixelSlider.vue'
import RangeSlider from './RangeSlider.vue'
import UiIcon from './UiIcon.vue'
import type { MenuChoice, MenuEntry, MenuItem } from '@/lib/contextMenu'

// The rows of a menu (items, choices, sliders, ranges, dropdowns,
// separators), as in the right-click menu; also used in the sidebar for
// settings that share their controls with it.
defineProps<{ items: MenuEntry[] }>()

const emit = defineEmits<{
  /** a plain item was clicked */
  run: [item: MenuItem]
}>()

const labelOf = (o: MenuChoice) => (typeof o.label === 'function' ? o.label() : o.label)
</script>

<template>
  <div class="menu-entries">
    <template v-for="(item, i) in items" :key="i">
      <template v-if="!item.visible || item.visible()">
        <hr v-if="item.kind === 'separator'" />
        <div v-else-if="item.kind === 'slider'" class="slider-row" :title="item.title">
          <span class="row-label">{{ item.label }}</span>
          <button
            v-if="item.link"
            class="link"
            :class="{ linked: item.link.linked() }"
            :aria-pressed="item.link.linked()"
            :aria-label="item.link.linked() ? item.link.linkedTitle : item.link.unlinkedTitle"
            :title="item.link.linked() ? item.link.linkedTitle : item.link.unlinkedTitle"
            @click="item.link.toggle()"
          >
            <UiIcon :name="item.link.linked() ? 'link' : 'unlink'" />
          </button>
          <PixelSlider
            class="slider"
            :class="{ faded: item.link?.linked() }"
            :model-value="item.value()"
            :min="item.min"
            :max="item.max"
            :steps="item.steps"
            :unit="item.unit"
            :track="item.track"
            :reset-value="item.resetValue"
            :label="item.label"
            @update:model-value="item.set"
          />
        </div>
        <div v-else-if="item.kind === 'range'" class="range-row" :title="item.title">
          <RangeSlider
            :model-value="item.value()"
            :min="item.min"
            :max="item.max"
            :min-gap="item.minGap"
            :label="item.label"
            @update:model-value="item.set"
          />
        </div>
        <div v-else-if="item.kind === 'choices'" class="choices-row" role="group" :aria-label="item.label">
          <span class="row-label">{{ item.label }}</span>
          <div
            class="choices"
            :class="{ grid: item.columns }"
            :style="item.columns ? { gridTemplateColumns: `repeat(${item.columns}, auto)` } : undefined"
          >
            <template v-for="(o, j) in item.options" :key="j">
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
                @click="o.pick()"
              >
                <template v-if="!o.swatch">{{ labelOf(o) }}</template>
              </button>
            </template>
          </div>
        </div>
        <label v-else-if="item.kind === 'select'" class="choices-row">
          <span class="row-label">{{ item.label }}</span>
          <select
            class="select"
            :value="item.value()"
            :style="{ fontFamily: item.options.find((o) => o.value === item.value())?.fontFamily }"
            @change="item.set(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="o in item.options" :key="o.value" :value="o.value" :style="{ fontFamily: o.fontFamily }">
              {{ o.label }}
            </option>
          </select>
        </label>
        <button v-else role="menuitem" :class="{ danger: item.danger }" @click="emit('run', item)">
          <span class="icon">{{ item.icon }}</span>{{ item.label }}
        </button>
      </template>
    </template>
  </div>
</template>

<style scoped lang="scss">
.menu-entries {
  display: flex;
  flex-direction: column;
}

button {
  font: inherit;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: none;
  border-radius: 2px;
  background: none;
  color: $text-main;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: $accent-soft;
    outline: none;
  }

  &.danger {
    color: $danger;

    &:hover,
    &:focus-visible {
      background: rgba($danger, 0.14);
    }
  }
}

hr {
  border: none;
  border-top: 1px solid $line;
  margin: 4px 2px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px 4px 10px;

  // so stacked sliders line up
  > .row-label {
    min-width: 64px;
  }

  .slider {
    flex: 1;
    min-width: 150px;
  }
}

// linked to a shared value: lit while linked, dim once it has its own
.slider-row .link {
  padding: 3px;
  margin: 0 -4px;
  color: $text-dim;

  &.linked {
    color: $accent-ink;
  }
}

// a linked slider shows the shared value, faded until it's used
.slider.faded {
  opacity: 0.5;
  transition: opacity 0.12s;

  &:hover,
  &:focus-within {
    opacity: 0.8;
  }
}

// label and values above, the bar across the row's full width below
.range-row {
  padding: 4px 6px 6px 10px;
}

.choices-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 6px 4px 10px;
}

.select {
  @include field;
  min-width: 0;
  max-width: 190px;
  padding: 4px 6px;
  font-size: 0.85rem;
}

.row-label {
  @include micro-label;
}

.choices {
  display: flex;
  gap: 3px;

  &.grid {
    display: grid;
  }

  button {
    padding: 4px 8px;
    font-size: 0.76rem;
    border: 1px solid $line;
    justify-content: center;

    &.active {
      border-color: $accent;
      color: $accent-ink;
      background: $accent-soft;
    }

    &.swatch {
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

.icon {
  width: 1.2em;
  text-align: center;
}
</style>
