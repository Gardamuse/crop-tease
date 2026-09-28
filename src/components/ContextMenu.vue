<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

import PixelSlider from './PixelSlider.vue'
import RangeSlider from './RangeSlider.vue'
import UiIcon from './UiIcon.vue'
import { closeContextMenu, contextMenu, type MenuItem } from '@/lib/contextMenu'

const EDGE_GAP = 6 // keep the menu this far inside the window

const menuEl = useTemplateRef('menu')
const pos = ref({ x: 0, y: 0 })

// Placed at the pointer, flipped or shifted as needed to stay inside the
// window; placed again whenever its size changes (rows can appear while
// it's open, e.g. an overlay's color once an overlay is picked).
function place() {
  const menu = menuEl.value
  if (!menu) return
  const { width, height } = menu.getBoundingClientRect()
  let { x, y } = contextMenu
  if (x + width > innerWidth - EDGE_GAP) x = Math.max(EDGE_GAP, x - width)
  if (y + height > innerHeight - EDGE_GAP) y = Math.max(EDGE_GAP, innerHeight - EDGE_GAP - height)
  pos.value = { x, y }
}

const resizeObserver = new ResizeObserver(place)

watch(
  () => contextMenu.open && [contextMenu.x, contextMenu.y],
  async (open) => {
    resizeObserver.disconnect()
    if (!open) return
    pos.value = { x: contextMenu.x, y: contextMenu.y }
    await nextTick()
    const menu = menuEl.value
    if (!menu) return
    place()
    resizeObserver.observe(menu)
    menu.querySelector<HTMLButtonElement>('button')?.focus()
  },
)

function run(item: MenuItem) {
  closeContextMenu()
  item.action()
}

function onKeyDown(e: KeyboardEvent) {
  if (!contextMenu.open) return
  if (e.key === 'Escape') {
    closeContextMenu()
    return
  }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  const buttons = Array.from(menuEl.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const step = e.key === 'ArrowDown' ? 1 : -1
  buttons[(i + step + buttons.length) % buttons.length]?.focus()
}

// leaving the window closes the menu, except for the color picker a custom
// swatch opened (which may be a window of its own)
function onWindowBlur() {
  const active = document.activeElement
  if (active instanceof HTMLInputElement && active.type === 'color' && menuEl.value?.contains(active)) return
  closeContextMenu()
}

// any press outside the menu, or the page changing under it, closes it
function onOutsidePointer(e: PointerEvent) {
  if (contextMenu.open && !menuEl.value?.contains(e.target as Node)) closeContextMenu()
}

onMounted(() => {
  window.addEventListener('pointerdown', onOutsidePointer, true)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('wheel', closeContextMenu, { passive: true })
})
onBeforeUnmount(() => {
  resizeObserver.disconnect()
  window.removeEventListener('pointerdown', onOutsidePointer, true)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('resize', closeContextMenu)
  window.removeEventListener('wheel', closeContextMenu)
})
</script>

<template>
  <div
    v-if="contextMenu.open"
    ref="menu"
    class="context-menu"
    role="menu"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @contextmenu.prevent
  >
    <template v-for="(item, i) in contextMenu.items" :key="i">
      <template v-if="!item.visible || item.visible()">
        <hr v-if="item.kind === 'separator'" />
        <div v-else-if="item.kind === 'slider'" class="slider-row">
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
              <label
                v-else-if="o.pickColor"
                class="custom-color"
                :class="{ active: o.active?.() }"
                :title="o.title ?? o.label"
              >
                <span class="rainbow" :style="{ background: o.active?.() ? o.pickColor.value() : undefined }" />
                <input
                  type="color"
                  :aria-label="o.label"
                  :value="o.pickColor.value()"
                  @input="o.pickColor.set(($event.target as HTMLInputElement).value)"
                />
              </label>
              <button
                v-else
                role="menuitemradio"
                :aria-checked="o.active?.() ?? false"
                :aria-label="o.title ?? o.label"
                :title="o.title ?? o.label"
                :class="{ active: o.active?.(), swatch: o.swatch }"
                :style="o.swatch ? { background: o.swatch } : undefined"
                @click="o.pick()"
              >
                <template v-if="!o.swatch">{{ o.label }}</template>
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
        <button v-else role="menuitem" :class="{ danger: item.danger }" @click="run(item)">
          <span class="icon">{{ item.icon }}</span>{{ item.label }}
        </button>
      </template>
    </template>
  </div>
</template>

<style scoped lang="scss">
.context-menu {
  position: fixed;
  z-index: 900;
  min-width: 250px;
  padding: 5px;
  border-radius: $radius;
  background: $bg-panel-alt;
  border: 1px solid $line;
  box-shadow: 0 12px 32px rgba($shade, 0.3);
  display: flex;
  flex-direction: column;
  font-family: $font-mono;
  color: $text-main;
  animation: menu-in 0.14s ease-out;
  @include corner-brackets(8px);
}

@keyframes menu-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
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

  // a swatch like the others, showing a rainbow until a custom color is chosen
  .custom-color {
    position: relative;
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid rgba($shade, 0.25);
    overflow: hidden;
    cursor: pointer;

    &.active {
      overflow: visible;
      box-shadow:
        0 0 0 2px $bg-panel-alt,
        0 0 0 3px $accent,
        0 0 10px $accent-dim;
    }

    .rainbow {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
    }

    // the native picker covers the swatch so any click opens it
    input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      padding: 0;
      border: none;
      opacity: 0;
      cursor: pointer;
    }
  }
}

.icon {
  width: 1.2em;
  text-align: center;
}
</style>
