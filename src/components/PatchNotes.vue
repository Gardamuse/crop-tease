<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

import UiIcon from './UiIcon.vue'
import { PATCH_NOTES, type PatchNote } from '@/lib/patchNotes'

// The version number in the workspace corner; clicking it opens the patch notes.
defineProps<{ version: string }>()

// notes for fixes start with this; it's shown as a small tag
const FIXED = 'Fixed: '

/** a note's text, split into whether it's a fix and the rest */
function parts(text: string): { fixed: boolean; text: string } {
  const fixed = text.startsWith(FIXED)
  return { fixed, text: fixed ? text.slice(FIXED.length) : text }
}

const textOf = (note: PatchNote) => (typeof note === 'string' ? note : note.text)
const subOf = (note: PatchNote) => (typeof note === 'string' ? [] : note.sub)

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
            <li v-for="note in release.notes" :key="textOf(note)">
              <span v-if="parts(textOf(note)).fixed" class="tag">Fixed</span>{{ parts(textOf(note)).text }}
              <!-- smaller related changes, indented under it -->
              <ul v-if="subOf(note).length" class="sub">
                <li v-for="sub in subOf(note)" :key="sub">
                  <span v-if="parts(sub).fixed" class="tag">Fixed</span>{{ parts(sub).text }}
                </li>
              </ul>
            </li>
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
  padding: 4px 6px;
  border: none;
  background: none;
  font-family: $font-mono;
  font-size: 0.8rem;
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
  bottom: 36px;
  width: 460px;
  max-width: calc(100% - 20px);
  max-height: min(720px, calc(100% - 50px));
  display: flex;
  flex-direction: column;
  border-radius: $radius;
  background: $bg-panel-alt;
  border: 1px solid $line;
  box-shadow: 0 12px 32px rgba($shade, 0.35);
  // the app's mono, at full contrast and a size that reads easily
  font-family: $font-mono;
  font-size: 0.9rem;
  line-height: 1.4;
  color: $text-main;

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
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid $line;
  }

  h3 {
    margin: 0 0 8px;
    font-family: $font-heading;
    font-size: 1.1rem;
    font-weight: 800;
    color: $accent-ink;
  }

  // clearly more room between notes than between a note's lines, so each reads as one block
  ul {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  li {
    padding-left: 2px;
  }

  li::marker {
    color: $accent;
  }

  // closer to their note than notes are to each other, in a lighter voice
  ul.sub {
    margin-top: 6px;
    padding-left: 16px;
    gap: 5px;
    font-size: 0.85rem;
    color: rgba($text-main, 0.82);

    li {
      list-style: '– ';
    }

    li::marker {
      color: $text-dim;
    }
  }

  // "Fixed", before a fix's note
  .tag {
    @include micro-label;
    display: inline-block;
    margin-right: 6px;
    padding: 0 5px;
    border-radius: 2px;
    background: $bg-sunken;
    font-size: 0.62rem;
    line-height: 1.6;
    vertical-align: 1px;
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
