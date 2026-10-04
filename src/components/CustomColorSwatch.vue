<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useTemplateRef } from 'vue'

import ColorPicker from './ColorPicker.vue'
import { POPOVER_ATTR } from '@/lib/contextMenu'

// A round swatch that opens the app's color picker in a small card beside
// it. It shows a rainbow until a custom color is in use (active), then that
// color. The card sits on the page itself (not inside a scrolling menu), so
// menus treat presses on it as their own (see POPOVER_ATTR).
const props = defineProps<{
  /** the color being edited; where the picker starts */
  modelValue: string
  /** whether a custom color is the one in use */
  active: boolean
  label: string
}>()
const emit = defineEmits<{ 'update:modelValue': [color: string] }>()

const GAP = 8 // between the swatch and the card, and the card and the window's edge

const swatchEl = useTemplateRef('swatch')
const cardEl = useTemplateRef('card')
const open = ref(false)
const pos = ref({ left: 0, top: 0 })

// below the swatch, or above it if there's no room; kept inside the window
async function place() {
  await nextTick()
  const s = swatchEl.value?.getBoundingClientRect()
  const c = cardEl.value?.getBoundingClientRect()
  if (!s || !c) return
  let top = s.bottom + GAP
  if (top + c.height > innerHeight - GAP) top = Math.max(GAP, s.top - GAP - c.height)
  const left = Math.min(Math.max(GAP, s.left + s.width / 2 - c.width / 2), innerWidth - GAP - c.width)
  pos.value = { left, top }
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    window.addEventListener('pointerdown', onOutside, true)
    window.addEventListener('keydown', onKey, true)
    place()
  } else close()
}

function close() {
  open.value = false
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('keydown', onKey, true)
}

function onOutside(e: PointerEvent) {
  const t = e.target as Node
  if (!cardEl.value?.contains(t) && !swatchEl.value?.contains(t)) close()
}

// Esc closes just the picker, not a menu it's in
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  e.stopImmediatePropagation()
  close()
  swatchEl.value?.focus()
}

onBeforeUnmount(close)
</script>

<template>
  <button
    ref="swatch"
    type="button"
    class="custom-swatch"
    :class="{ active, open }"
    :title="label"
    :aria-label="label"
    :aria-expanded="open"
    @click="toggle"
  >
    <span class="fill" :style="active ? { background: props.modelValue } : undefined" />
    <!-- on the page itself; a child here only so the button stays the one root -->
    <Teleport to="body">
      <Transition name="pop">
        <div
          v-if="open"
          ref="card"
          class="color-card"
          role="dialog"
          :aria-label="label"
          :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
          v-bind="{ [POPOVER_ATTR]: '' }"
        >
          <ColorPicker :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" />
        </div>
      </Transition>
    </Teleport>
  </button>
</template>

<style scoped lang="scss">
.custom-swatch {
  position: relative;
  overflow: hidden;
  padding: 0;
  cursor: pointer;

  // a rainbow until a custom color is in use
  .fill {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: conic-gradient(#f55, #fd4, #5e5, #4dd, #56f, #e5e, #f55);
  }
}

// like the app's other floating cards (menus, How to)
.color-card {
  position: fixed;
  z-index: 1000;
  padding: 12px;
  border-radius: $radius;
  background: $bg-panel-alt;
  border: 1px solid $line;
  box-shadow: 0 12px 32px rgba($shade, 0.3);
  @include corner-brackets(8px);
}

.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 0.15s ease-out,
    transform 0.15s ease-out;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
