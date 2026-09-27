<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue'

import PageThumb from './PageThumb.vue'
import { openContextMenu } from '@/lib/contextMenu'
import { addPage, duplicatePage, movePage, removePage, store, switchPage } from '@/lib/store'

const barEl = useTemplateRef('bar')

function confirmRemove(index: number) {
  if (store.pages.length <= 1) return
  if (confirm(`Delete page ${index + 1}? Its photos, dividers, close-ups and text are removed.`)) removePage(index)
}

function onTabMenu(e: MouseEvent, index: number) {
  openContextMenu(e, [
    { label: 'Duplicate page', icon: '⧉', action: () => duplicatePage(index) },
    { label: 'Move left', icon: '←', visible: () => index > 0, action: () => movePage(index, index - 1) },
    {
      label: 'Move right',
      icon: '→',
      visible: () => index < store.pages.length - 1,
      action: () => movePage(index, index + 1),
    },
    { kind: 'separator' },
    {
      label: 'Add page after',
      icon: '＋',
      action: () => {
        switchPage(index)
        addPage()
      },
    },
    {
      label: 'Delete page',
      icon: '🗑',
      danger: true,
      visible: () => store.pages.length > 1,
      action: () => confirmRemove(index),
    },
  ])
}

// Drag a page onto another to move it there: dropping on a tab's left half
// puts it before that page, on the right half after it.
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
  dropMark.value = { index, after: e.clientX > rect.left + rect.width / 2 }
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

// keep the current page's tab in view (e.g. after adding one at the end)
watch(
  () => [store.pageIndex, store.pages.length],
  async () => {
    await nextTick()
    barEl.value?.querySelector('.page-tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  },
)
</script>

<template>
  <nav class="page-bar" aria-label="Pages">
    <div ref="bar" class="tabs">
      <button
        v-for="(page, i) in store.pages"
        :key="page.id"
        class="page-tab"
        :class="{
          active: i === store.pageIndex,
          dragging: i === dragFrom,
          'drop-before': dropMark?.index === i && !dropMark.after,
          'drop-after': dropMark?.index === i && dropMark.after,
        }"
        :aria-current="i === store.pageIndex ? 'page' : undefined"
        :title="`Page ${i + 1} (drag to reorder, right-click for more)`"
        draggable="true"
        @click="switchPage(i)"
        @contextmenu="onTabMenu($event, i)"
        @dragstart="onDragStart($event, i)"
        @dragover="onDragOver($event, i)"
        @drop="onDrop"
        @dragend="onDragEnd"
      >
        <PageThumb :page="page" :index="i" />
        <span class="num">{{ i + 1 }}</span>
      </button>
      <button class="add" title="Add a page after this one" aria-label="Add page" @click="addPage()">＋<span>Page</span></button>
    </div>
    <button class="tool" :title="`Duplicate page ${store.pageIndex + 1}`" @click="duplicatePage(store.pageIndex)">
      ⧉
    </button>
    <button
      class="tool delete"
      :disabled="store.pages.length <= 1"
      :title="store.pages.length <= 1 ? 'A comic needs at least one page' : `Delete page ${store.pageIndex + 1}`"
      @click="confirmRemove(store.pageIndex)"
    >
      🗑
    </button>
  </nav>
</template>

<style scoped lang="scss">
$thumb-h: 64px;

.page-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px 12px;
  background: $workspace-bar;
  border-top: 1px solid rgba(#fff, 0.08);
}

.tabs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  padding: 4px 2px;
}

button {
  font: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: #fff;
}

.page-tab {
  flex: none;
  position: relative;
  height: $thumb-h;
  padding: 0;
  border-radius: 4px;
  outline: 2px solid transparent;
  outline-offset: 2px;
  opacity: 0.75;
  transition: opacity 0.1s;

  &:hover {
    opacity: 1;
  }

  &.active {
    opacity: 1;
    outline-color: $pink;
  }

  &:focus-visible {
    outline-color: #fff;
  }

  &.dragging {
    opacity: 0.35;
  }

  // insertion marker while dragging a page
  &.drop-before::before,
  &.drop-after::before {
    content: '';
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 3px;
    border-radius: 2px;
    background: $pink;
  }

  &.drop-before::before {
    left: -7px;
  }

  &.drop-after::before {
    right: -7px;
  }

  .num {
    position: absolute;
    right: 3px;
    bottom: 3px;
    min-width: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: rgba($ink, 0.85);
    font-size: 0.66rem;
    font-weight: 700;
    line-height: 16px;
  }
}

.add {
  flex: none;
  height: $thumb-h;
  padding: 0 14px;
  border: 1.5px dashed rgba(#fff, 0.35);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 1.1rem;
  color: rgba(#fff, 0.8);

  span {
    font-size: 0.66rem;
    font-weight: 600;
  }

  &:hover {
    border-color: $pink;
    color: #fff;
  }
}

.tool {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 1rem;
  background: rgba(#fff, 0.08);

  &:hover:not(:disabled) {
    background: rgba(#fff, 0.18);
  }

  &.delete:hover:not(:disabled) {
    background: rgba($pink-deep, 0.6);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}
</style>
