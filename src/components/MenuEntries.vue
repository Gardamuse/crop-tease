<script setup lang="ts">
import { ref, watch } from 'vue'

import MenuChoiceButtons from './MenuChoiceButtons.vue'
import MenuDropdown from './MenuDropdown.vue'
import PixelSlider from './PixelSlider.vue'
import RangeSlider from './RangeSlider.vue'
import UiIcon from './UiIcon.vue'
import type { MenuEntry, MenuGroup, MenuItem } from '@/lib/contextMenu'

// The rows of a menu (items, choices, sliders, ranges, dropdowns, groups,
// separators), as in the right-click menu; also used in the sidebar for
// settings that share their controls with it.
const props = defineProps<{ items: MenuEntry[] }>()

const emit = defineEmits<{
  /** a plain item was clicked */
  run: [item: MenuItem]
}>()

/** the folding group open among these rows, by label */
const openGroup = ref<string | null>(null)
watch(
  () => props.items,
  () => (openGroup.value = null),
)

const isOn = (g: MenuGroup) => !g.on || g.on()
const isOpen = (g: MenuGroup) => isOn(g) && (!g.fold || openGroup.value === g.label)

function toggle(g: MenuGroup) {
  openGroup.value = openGroup.value === g.label ? null : g.label
}

// switching a folding group on opens it, folding the one that was open
function onSwitched(g: MenuGroup) {
  if (g.fold && isOn(g)) openGroup.value = g.label
}
</script>

<template>
  <div class="menu-entries">
    <template v-for="(item, i) in items" :key="i">
      <template v-if="!item.visible || item.visible()">
        <hr v-if="item.kind === 'separator'" />
        <section v-else-if="item.kind === 'group'" class="group" :class="{ fold: item.fold, open: isOpen(item) }">
          <div class="group-head">
            <button
              v-if="item.fold"
              class="group-title"
              :disabled="!isOn(item)"
              :aria-expanded="isOpen(item)"
              @click="toggle(item)"
            >
              {{ item.label }}<UiIcon name="chevron" class="chevron" />
            </button>
            <span v-else class="group-title">{{ item.label }}</span>
            <MenuChoiceButtons
              v-if="item.options"
              :options="item.options"
              :label="item.label"
              @picked="onSwitched(item)"
            />
          </div>
          <MenuEntries v-if="isOpen(item)" class="group-rows" :items="item.entries" @run="emit('run', $event)" />
          <button v-else-if="isOn(item) && item.summary" class="group-summary" @click="toggle(item)">
            {{ item.summary() }}
          </button>
        </section>
        <div v-else-if="item.kind === 'actions'" class="actions-row">
          <template v-for="(a, j) in item.items" :key="j">
            <button
              v-if="!a.visible || a.visible()"
              role="menuitem"
              :class="{ danger: a.danger }"
              @click="emit('run', a)"
            >
              <UiIcon v-if="a.icon" :name="a.icon" class="icon" />{{ a.label }}
            </button>
          </template>
        </div>
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
            :shift-snap="item.shiftSnap"
            :label="item.label"
            @update:model-value="item.set"
          />
          <!-- a slot on every slider row, so the number boxes line up -->
          <button
            v-if="item.resetTitle && item.resetValue !== undefined"
            class="reset"
            :disabled="item.value() === item.resetValue"
            :aria-label="item.resetTitle"
            :title="item.resetTitle"
            @click="item.set(item.resetValue)"
          >
            <UiIcon name="reset" />
          </button>
          <span v-else class="reset" />
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
        <div v-else-if="item.kind === 'choices'" class="choices-row">
          <span class="row-label">{{ item.label }}</span>
          <MenuChoiceButtons :options="item.options" :label="item.label" :columns="item.columns" />
        </div>
        <div v-else-if="item.kind === 'select'" class="choices-row">
          <span class="row-label">{{ item.label }}</span>
          <MenuDropdown :model-value="item.value()" :options="item.options" :label="item.label" @update:model-value="item.set" />
        </div>
        <button v-else role="menuitem" class="item" :class="{ danger: item.danger }" @click="emit('run', item)">
          <UiIcon v-if="item.icon" :name="item.icon" class="icon" /><span v-else class="icon" />{{ item.label }}
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

// sets the slider back, e.g. a rotation to 0; dim while it's already there
.slider-row .reset {
  flex: none;
  width: 18px;
  padding: 0;
  margin-left: -6px;
  justify-content: center;
  color: $text-dim;

  &:not(:disabled):hover {
    color: $accent-ink;
  }

  &:disabled {
    opacity: 0.35;
    background: none;
    cursor: default;
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

// label and values above, the bar below; its boxes end where the sliders' do (before their unit and reset slots)
.range-row {
  padding: 4px 56px 6px 10px;
}

.choices-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 6px 4px 10px;
}

.row-label {
  @include micro-label;
}

.icon {
  width: 1.15em;
  color: $text-dim;
}

.danger .icon {
  color: inherit;
}

// side by side, each taking an equal share
.actions-row {
  display: flex;
  gap: 2px;

  button {
    flex: 1;
  }
}

// a group: its heading (with its switch), then its rows indented along an accent rail
.group {
  padding: 2px 0;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 30px;
  padding: 2px 6px 2px 10px;
}

.group-title {
  @include micro-label;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  margin-left: -6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: $text-main;

  .chevron {
    width: 0.95em;
    height: 0.95em;
    color: $text-dim;
    transition: transform 0.15s ease;
  }

  &:disabled {
    color: $text-dim;
    font-weight: 400;
    cursor: default;
    background: none;

    .chevron {
      opacity: 0;
    }
  }
}

.group.open .chevron {
  transform: rotate(90deg);
}

.group-rows,
.group-summary {
  margin: 0 0 2px 12px;
  border-left: 1px solid $line-accent;
}

.group-rows {
  padding-bottom: 2px;
}

// a folded group's settings on one line; opens it
.group-summary {
  width: calc(100% - 12px);
  padding: 2px 10px 5px;
  border-radius: 0;
  font-size: 0.7rem;
  color: $text-dim;

  &:hover,
  &:focus-visible {
    color: $text-main;
  }
}
</style>
