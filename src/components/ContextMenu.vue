<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

import { COLOR_POPOVER_ATTR } from './CustomColorSwatch.vue'
import MenuEntries from './MenuEntries.vue'
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
  if (!menuEl.value?.contains(e.target as Node)) return // e.g. typing in a color picker's hex field
  e.preventDefault()
  const buttons = Array.from(menuEl.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const step = e.key === 'ArrowDown' ? 1 : -1
  buttons[(i + step + buttons.length) % buttons.length]?.focus()
}

// a color picker a swatch in the menu opened counts as part of the menu
const inMenu = (target: EventTarget | null) =>
  target instanceof Node &&
  (menuEl.value?.contains(target) || !!(target as Element).closest?.(`[${COLOR_POPOVER_ATTR}]`))

// any press outside the menu, or the page changing under it, closes it
function onOutsidePointer(e: PointerEvent) {
  if (contextMenu.open && !inMenu(e.target)) closeContextMenu()
}

onMounted(() => {
  window.addEventListener('pointerdown', onOutsidePointer, true)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('blur', closeContextMenu)
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('wheel', closeContextMenu, { passive: true })
})
onBeforeUnmount(() => {
  resizeObserver.disconnect()
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
    <MenuEntries :items="contextMenu.items" @run="run" />
  </div>
</template>

<style scoped lang="scss">
.context-menu {
  position: fixed;
  z-index: 900;
  min-width: 250px;
  // a long menu (a photo's, with its effects open) scrolls in a short window
  max-height: calc(100vh - 12px);
  overflow-y: auto;
  scrollbar-width: thin;
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
</style>
