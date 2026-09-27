<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

import { closeContextMenu, contextMenu, type MenuItem } from '@/lib/contextMenu'

const EDGE_GAP = 6 // keep the menu this far inside the window

const menuEl = useTemplateRef('menu')
const pos = ref({ x: 0, y: 0 })

// open at the pointer, flipped/shifted as needed to stay inside the window
watch(
  () => contextMenu.open && [contextMenu.x, contextMenu.y],
  async (open) => {
    if (!open) return
    pos.value = { x: contextMenu.x, y: contextMenu.y }
    await nextTick()
    const menu = menuEl.value
    if (!menu) return
    const { width, height } = menu.getBoundingClientRect()
    let { x, y } = pos.value
    if (x + width > innerWidth - EDGE_GAP) x = Math.max(EDGE_GAP, x - width)
    if (y + height > innerHeight - EDGE_GAP) y = Math.max(EDGE_GAP, innerHeight - EDGE_GAP - height)
    pos.value = { x, y }
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

// any press outside the menu, or the page changing under it, closes it
function onOutsidePointer(e: PointerEvent) {
  if (contextMenu.open && !menuEl.value?.contains(e.target as Node)) closeContextMenu()
}

onMounted(() => {
  window.addEventListener('pointerdown', onOutsidePointer, true)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('blur', closeContextMenu)
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('wheel', closeContextMenu, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onOutsidePointer, true)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('blur', closeContextMenu)
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
      <hr v-if="item.kind === 'separator'" />
      <div v-else-if="item.kind === 'choices'" class="choices-row" role="group" :aria-label="item.label">
        <span class="row-label">{{ item.label }}</span>
        <div class="choices">
          <button
            v-for="o in item.options"
            :key="o.label"
            role="menuitemradio"
            :aria-checked="o.active?.() ?? false"
            :aria-label="o.label"
            :title="o.title ?? o.label"
            :class="{ active: o.active?.(), swatch: o.swatch }"
            :style="o.swatch ? { background: o.swatch } : undefined"
            @click="o.pick()"
          >
            <template v-if="!o.swatch">{{ o.label }}</template>
          </button>
        </div>
      </div>
      <button v-else role="menuitem" :class="{ danger: item.danger }" @click="run(item)">
        <span class="icon">{{ item.icon }}</span>{{ item.label }}
      </button>
    </template>
  </div>
</template>

<style scoped lang="scss">
.context-menu {
  position: fixed;
  z-index: 900;
  min-width: 190px;
  padding: 5px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid $toolbar-border;
  box-shadow: 0 10px 28px rgba($ink, 0.25);
  display: flex;
  flex-direction: column;
}

button {
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: none;
  color: $ink;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: #fff0f8;
    outline: none;
  }

  &.danger {
    color: $pink-deep;
  }
}

hr {
  border: none;
  border-top: 1px solid $toolbar-border;
  margin: 4px 2px;
}

.choices-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 6px 4px 10px;
}

.row-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: $muted;
}

.choices {
  display: flex;
  gap: 3px;

  button {
    padding: 4px 8px;
    font-size: 0.78rem;
    border: 1px solid $toolbar-border;
    border-radius: 6px;
    justify-content: center;

    &.active {
      border-color: $pink-deep;
      color: $pink-deep;
      background: #fff0f8;
    }

    &.swatch {
      width: 22px;
      height: 22px;
      padding: 0;
      border: 1px solid rgba($ink, 0.35);

      &.active {
        box-shadow:
          0 0 0 2px #fff,
          0 0 0 4px $pink-deep;
      }
    }
  }
}

.icon {
  width: 1.2em;
  text-align: center;
}
</style>
