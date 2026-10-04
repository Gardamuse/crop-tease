<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue'

import PageThumb from './PageThumb.vue'
import { openContextMenu } from '@/lib/contextMenu'
import { addPage, duplicatePage, movePage, removePage, store, switchPage, togglePageBorder } from '@/lib/store'

const barEl = useTemplateRef('bar')

function confirmRemove(index: number) {
  if (store.pages.length <= 1) return
  if (confirm(`Delete page ${index + 1}? Its photos, dividers, close-ups and text are removed.`)) removePage(index)
}

function onTabMenu(e: MouseEvent, index: number) {
  openContextMenu(e, [
    { label: 'Duplicate page', icon: 'duplicate', action: () => duplicatePage(index) },
    { label: 'Move up', icon: 'up', visible: () => index > 0, action: () => movePage(index, index - 1) },
    {
      label: 'Move down',
      icon: 'down',
      visible: () => index < store.pages.length - 1,
      action: () => movePage(index, index + 1),
    },
    {
      label: store.pages[index]?.border ? 'Hide border on this page' : 'Show border on this page',
      icon: 'border',
      visible: () => store.border.width > 0,
      action: () => togglePageBorder(index),
    },
    { kind: 'separator' },
    {
      label: 'Add page after',
      icon: 'plus',
      action: () => {
        switchPage(index)
        addPage()
      },
    },
    {
      label: 'Delete page',
      icon: 'trash',
      danger: true,
      visible: () => store.pages.length > 1,
      action: () => confirmRemove(index),
    },
  ])
}

// Drag a page onto another to move it there: dropping on a page's top half
// puts it before that page, on the bottom half after it.
const PAGE_DRAG_TYPE = 'application/x-comic-page'
const dragFrom = ref<number | null>(null)
const dropMark = ref<{ index: number; after: boolean } | null>(null)

function onDragStart(e: DragEvent, index: number) {
  dragFrom.value = index
  // a custom type, so the drag can't be dropped as text or a file anywhere else
  e.dataTransfer!.setData(PAGE_DRAG_TYPE, String(index))
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, index: number) {
  if (dragFrom.value === null) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dropMark.value = { index, after: e.clientY > rect.top + rect.height / 2 }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const from = dragFrom.value
  const mark = dropMark.value
  if (from !== null && mark) {
    // the insert position counted before the dragged page is taken out
    const insertAt = mark.index + (mark.after ? 1 : 0)
    movePage(from, insertAt > from ? insertAt - 1 : insertAt)
  }
  onDragEnd()
}

function onDragEnd() {
  dragFrom.value = null
  dropMark.value = null
}

// keep the current page in view (e.g. after adding one at the end)
watch(
  () => [store.pageIndex, store.pages.length],
  async () => {
    await nextTick()
    barEl.value?.querySelector('.page-tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  },
)
</script>

<template>
  <nav class="page-rail" aria-label="Pages">
    <div ref="bar" class="tabs">
      <div
        v-for="(page, i) in store.pages"
        :key="page.id"
        class="page-slot"
        :class="{
          'drop-before': dropMark?.index === i && !dropMark.after,
          'drop-after': dropMark?.index === i && dropMark.after,
        }"
        @dragover="onDragOver($event, i)"
        @drop="onDrop"
      >
        <button
          class="page-tab"
          :class="{ active: i === store.pageIndex, dragging: i === dragFrom }"
          :aria-current="i === store.pageIndex ? 'page' : undefined"
          :title="`Page ${i + 1} (drag to reorder, right-click for more)`"
          draggable="true"
          @click="switchPage(i)"
          @contextmenu="onTabMenu($event, i)"
          @dragstart="onDragStart($event, i)"
          @dragend="onDragEnd"
        >
          <PageThumb :page="page" :index="i" />
        </button>
        <span class="num">{{ i + 1 }}</span>
        <button
          class="more"
          :title="`Page ${i + 1} options`"
          :aria-label="`Page ${i + 1} options`"
          @click.stop="onTabMenu($event, i)"
        >
          &middot;&middot;&middot;
        </button>
      </div>
      <button class="add" title="Add a page after this one" aria-label="Add page" @click="addPage()">＋</button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
$rail-w: 84px;

.page-rail {
  flex: none;
  width: $rail-w;
  display: flex;
  flex-direction: column;
  background: rgba($dark-panel, 0.6);
  border-right: 1px solid $dark-line;
}

.tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  overflow-y: auto;
  padding: 18px 0 20px;
  scrollbar-width: thin;
  scrollbar-color: $dark-line transparent;
}

button {
  font: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: $dark-text;
}

.page-slot {
  flex: none;
  position: relative;
  width: 52px;

  // insertion marker while dragging a page
  &.drop-before::before,
  &.drop-after::before {
    content: '';
    position: absolute;
    left: -4px;
    right: -4px;
    height: 2px;
    background: $accent;
    box-shadow: 0 0 8px $accent-dim;
  }

  &.drop-before::before {
    top: -9px;
  }

  &.drop-after::before {
    bottom: -9px;
  }

  // the options button shows on hover
  &:hover .more,
  &:focus-within .more {
    opacity: 1;
  }
}

.page-tab {
  display: block;
  width: 100%;
  padding: 0;
  border-radius: 2px;
  overflow: hidden;
  outline: 1px solid $dark-line;
  outline-offset: 3px;
  opacity: 0.55;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    outline-color 0.2s ease,
    box-shadow 0.2s ease;

  :deep(.thumb) {
    width: 100%;
    height: auto;
  }

  &:hover {
    opacity: 1;
    transform: translateY(-2px);
    outline-color: $line-accent;
  }

  &.active {
    opacity: 1;
    outline-color: $accent;
    box-shadow: 0 0 14px $accent-soft;
  }

  &:focus-visible {
    outline-color: $dark-text;
  }

  &.dragging {
    opacity: 0.25;
  }
}

.num {
  position: absolute;
  left: -10px;
  top: -9px;
  min-width: 17px;
  padding: 0 4px;
  border-radius: 2px;
  background: $dark-panel-alt;
  border: 1px solid $dark-line;
  color: $dark-dim;
  font-family: $font-mono;
  font-size: 0.66rem;
  line-height: 15px;
  text-align: center;
  pointer-events: none;

  .active + & {
    background: $accent;
    border-color: $accent;
    color: $shade;
  }
}

.more {
  position: absolute;
  right: -9px;
  bottom: -9px;
  width: 22px;
  height: 17px;
  padding: 0;
  border-radius: 2px;
  background: $dark-panel-alt;
  border: 1px solid $dark-line;
  font-size: 0.7rem;
  line-height: 1;
  letter-spacing: -1px;
  opacity: 0;
  transition:
    opacity 0.15s,
    border-color 0.2s,
    color 0.2s;

  &:hover {
    border-color: $accent;
    color: $accent;
  }
}

.add {
  position: relative;
  flex: none;
  width: 52px;
  height: 36px;
  border: 1px dashed $dark-line;
  border-radius: 2px;
  font-size: 1.05rem;
  color: $dark-dim;
  transition:
    border-color 0.2s,
    color 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: $line-accent;
    border-style: solid;
    color: $accent;
    box-shadow: 0 0 14px $accent-soft;
  }
}
</style>
