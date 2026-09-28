<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

import UiIcon from './UiIcon.vue'
import { PATCH_NOTES } from '@/lib/patchNotes'

// The version number in the workspace corner; clicking it opens the patch notes.
defineProps<{ version: string }>()

const open = ref(false)
const cardEl = useTemplateRef('card')
const tagEl = useTemplateRef('tag')

function onWindowPointerDown(e: PointerEvent) {
  const target = e.target as Node
  if (open.value && !cardEl.value?.contains(target) && !tagEl.value?.contains(target)) open.value = false
}

function onWindowKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  window.addEventListener('pointerdown', onWindowPointerDown)
  window.addEventListener('keydown', onWindowKeyDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onWindowPointerDown)
  window.removeEventListener('keydown', onWindowKeyDown)
})
</script>

<template>
  <button
    ref="tag"
    class="version-tag"
    :class="{ active: open }"
    title="Patch notes"
    :aria-expanded="open"
    @click="open = !open"
  >
    v{{ version }}
  </button>
  <Transition name="pop">
    <div v-if="open" ref="card" class="notes-card" role="dialog" aria-label="Patch notes">
      <header>
        <h2>Patch notes</h2>
        <button class="close" aria-label="Close" @click="open = false"><UiIcon name="close" /></button>
      </header>
      <div class="notes-body">
        <section v-for="release in PATCH_NOTES" :key="release.version">
          <h3>{{ release.version }}</h3>
          <ul>
            <li v-for="note in release.notes" :key="note">{{ note }}</li>
          </ul>
        </section>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.version-tag {
  position: absolute;
  right: 6px;
  bottom: 3px;
  padding: 3px 4px;
  border: none;
  background: none;
  font-family: $font-mono;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  color: $dark-dim;
  opacity: 0.7;
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    color 0.2s ease;

  &:hover,
  &.active {
    opacity: 1;
    color: $accent;
  }
}

// like the How to card, rising from the corner
.notes-card {
  position: absolute;
  z-index: 50;
  right: 10px;
  bottom: 30px;
  width: 340px;
  max-width: calc(100% - 20px);
  max-height: min(520px, calc(100% - 44px));
  display: flex;
  flex-direction: column;
  border-radius: $radius;
  background: $bg-panel-alt;
  border: 1px solid $line;
  box-shadow: 0 12px 32px rgba($shade, 0.35);
  font-size: 0.78rem;
  line-height: 1.5;
  color: $text-dim;

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 8px 18px;
    border-bottom: 1px solid $line;
  }

  h2 {
    @include bar-heading;
    margin: 0;
    font-size: 1rem;
  }
}

.close {
  width: 28px;
  height: 28px;
  padding: 0;
  display: grid;
  place-items: center;
  border: none;
  border-radius: $radius;
  background: none;
  color: $text-dim;
  font-size: 1rem;
  cursor: pointer;

  &:hover {
    color: $accent-ink;
  }
}

// only the notes scroll; the heading stays put
.notes-body {
  overflow-y: auto;
  padding: 10px 18px 16px;
  scrollbar-width: thin;
  scrollbar-color: $line transparent;

  section + section {
    margin-top: 14px;
  }

  h3 {
    margin: 0 0 6px;
    font-family: $font-heading;
    font-size: 0.95rem;
    font-weight: 800;
    color: $accent-ink;
  }

  ul {
    margin: 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  li::marker {
    color: $accent-ink;
  }
}

.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.2s ease-out;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
</style>
