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
    <button
      v-for="item in contextMenu.items"
      :key="item.label"
      role="menuitem"
      :class="{ danger: item.danger }"
      @click="run(item)"
    >
      <span class="icon">{{ item.icon }}</span>{{ item.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.context-menu {
  position: fixed;
  z-index: 900;
  min-width: 170px;
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

.icon {
  width: 1.2em;
  text-align: center;
}
</style>
