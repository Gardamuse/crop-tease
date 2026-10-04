<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef } from 'vue'

import UiIcon from './UiIcon.vue'
import { POPOVER_ATTR } from '@/lib/contextMenu'

// A dropdown drawn by the app rather than the browser, so each option can
// show in its own font (Chromium draws a native list in the system font).
// It works like a native one: click or ArrowDown, Enter or Space opens it;
// the arrow keys, Home and End move through it, typing jumps to the option
// starting with what was typed, Enter or a click picks, and Esc or Tab
// closes it. The list sits on the page itself (not inside a scrolling
// menu), placed below the button or above it if there's no room.
const props = defineProps<{
  modelValue: string
  options: { value: string; label: string; fontFamily?: string }[]
  label: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const GAP = 4 // between the button and the list
const EDGE_GAP = 6 // between the list and the window's edge
const TYPE_RESET_MS = 700 // how long typed letters add up before starting over

const buttonEl = useTemplateRef('button')
const listEl = useTemplateRef('list')
const open = ref(false)
/** the option the keys are on (index), shown highlighted */
const current = ref(0)
const pos = ref({ left: 0, top: 0, minWidth: 0, maxHeight: 0 })
const listId = `dropdown-${Math.random().toString(36).slice(2, 9)}`

const selected = computed(() => props.options.find((o) => o.value === props.modelValue))

async function place() {
  await nextTick()
  const b = buttonEl.value?.getBoundingClientRect()
  const list = listEl.value
  if (!b || !list) return
  const below = innerHeight - EDGE_GAP - (b.bottom + GAP)
  const above = b.top - GAP - EDGE_GAP
  list.style.maxHeight = 'none' // its full height, to see where it fits
  const height = list.scrollHeight
  list.style.maxHeight = ''
  const downward = height <= below || below >= above
  const maxHeight = Math.min(height, downward ? below : above)
  const width = Math.max(b.width, list.offsetWidth)
  pos.value = {
    left: Math.min(b.left, innerWidth - EDGE_GAP - width),
    top: downward ? b.bottom + GAP : b.top - GAP - maxHeight,
    minWidth: b.width,
    maxHeight,
  }
  await nextTick()
  scrollToCurrent('center')
}

function scrollToCurrent(block: ScrollLogicalPosition = 'nearest') {
  listEl.value?.querySelector(`[data-index="${current.value}"]`)?.scrollIntoView({ block })
}

function show() {
  if (open.value) return
  open.value = true
  pos.value.maxHeight = 0 // hidden until placed
  current.value = Math.max(0, props.options.indexOf(selected.value!))
  window.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('keydown', onKey, true)
  place()
}

function close(refocus = true) {
  if (!open.value) return
  open.value = false
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('keydown', onKey, true)
  if (refocus) buttonEl.value?.focus()
}

function pick(index: number) {
  const o = props.options[index]
  if (o && o.value !== props.modelValue) emit('update:modelValue', o.value)
  close()
}

function onOutside(e: PointerEvent) {
  const t = e.target as Node
  if (!listEl.value?.contains(t) && !buttonEl.value?.contains(t)) close(false)
}

function move(to: number) {
  current.value = Math.min(Math.max(to, 0), props.options.length - 1)
  nextTick(() => scrollToCurrent())
}

// typed letters add up (e.g. "co" for Comic), jumping to the first option
// from the current one that starts with them
let typed = ''
let typedTimer = 0
function typeAhead(key: string) {
  clearTimeout(typedTimer)
  typedTimer = window.setTimeout(() => (typed = ''), TYPE_RESET_MS)
  typed += key.toLowerCase()
  const n = props.options.length
  // a new search starts after the current option; a longer one may stay on it
  const start = typed.length === 1 ? current.value + 1 : current.value
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n
    if (props.options[i]!.label.toLowerCase().startsWith(typed)) return move(i)
  }
}

// while open, the keys are the list's, and don't reach the menu around it
function onKey(e: KeyboardEvent) {
  const keys: Record<string, () => void> = {
    ArrowDown: () => move(current.value + 1),
    ArrowUp: () => move(current.value - 1),
    Home: () => move(0),
    End: () => move(props.options.length - 1),
    PageDown: () => move(current.value + 8),
    PageUp: () => move(current.value - 8),
    Enter: () => pick(current.value),
    ' ': () => (typed ? typeAhead(' ') : pick(current.value)),
    Escape: () => close(),
  }
  if (e.key === 'Tab') return close(false)
  const action = keys[e.key] ?? (e.key.length === 1 && !e.ctrlKey && !e.metaKey ? () => typeAhead(e.key) : null)
  if (!action) return
  e.preventDefault()
  e.stopImmediatePropagation()
  action()
}

// closed, these open it (rather than moving on through the menu)
function onButtonKey(e: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) return
  e.preventDefault()
  e.stopPropagation()
  show()
}

onBeforeUnmount(() => {
  close(false)
  clearTimeout(typedTimer)
})
</script>

<template>
  <button
    ref="button"
    type="button"
    class="dropdown"
    :class="{ open }"
    role="combobox"
    aria-haspopup="listbox"
    :aria-expanded="open"
    :aria-controls="listId"
    :aria-label="label"
    :style="{ fontFamily: selected?.fontFamily }"
    @click="open ? close() : show()"
    @keydown="onButtonKey"
  >
    <span class="value">{{ selected?.label ?? '' }}</span>
    <UiIcon name="chevron" class="chevron" />
    <!-- on the page itself; a child here only so the button stays the one root -->
    <Teleport to="body">
      <ul
        v-if="open"
        :id="listId"
        ref="list"
        class="dropdown-list"
        role="listbox"
        :aria-label="label"
        :aria-activedescendant="`${listId}-${current}`"
        :style="{
          left: `${pos.left}px`,
          top: `${pos.top}px`,
          minWidth: `${pos.minWidth}px`,
          maxHeight: `${pos.maxHeight}px`,
          visibility: pos.maxHeight ? undefined : 'hidden',
        }"
        v-bind="{ [POPOVER_ATTR]: '' }"
      >
        <li
          v-for="(o, i) in options"
          :id="`${listId}-${i}`"
          :key="o.value"
          role="option"
          :data-index="i"
          :aria-selected="o.value === modelValue"
          :class="{ current: i === current, selected: o.value === modelValue }"
          :style="{ fontFamily: o.fontFamily }"
          @pointermove="current = i"
          @click="pick(i)"
        >
          {{ o.label }}
        </li>
      </ul>
    </Teleport>
  </button>
</template>

<style scoped lang="scss">
.dropdown {
  @include field;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 190px;
  padding: 4px 6px 4px 8px;
  font-size: 0.95rem;
  cursor: pointer;

  .value {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: left;
  }

  .chevron {
    width: 0.8em;
    height: 0.8em;
    color: $text-dim;
    transform: rotate(90deg);
    transition: transform 0.15s ease;
  }

  &.open .chevron {
    transform: rotate(-90deg);
  }

  &:hover:not(.open) {
    border-color: $line-accent;
  }
}

// like the app's other floating cards (menus, the color picker)
.dropdown-list {
  position: fixed;
  z-index: 1000;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  list-style: none;
  border-radius: $radius;
  background: $bg-panel-alt;
  border: 1px solid $line;
  box-shadow: 0 12px 32px rgba($shade, 0.3);
  color: $text-main;
  animation: list-in 0.12s ease-out;

  li {
    position: relative;
    padding: 6px 12px 6px 22px;
    border-radius: 2px;
    font-size: 1.05rem;
    line-height: 1.25;
    white-space: nowrap;
    cursor: pointer;

    &.current {
      background: $accent-soft;
    }

    // a dot marks the option in use
    &.selected::before {
      content: '';
      position: absolute;
      left: 9px;
      top: 50%;
      width: 5px;
      height: 5px;
      margin-top: -2.5px;
      border-radius: 50%;
      background: $accent;
    }

    &.selected {
      color: $accent-ink;
    }
  }
}

@keyframes list-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
}
</style>
