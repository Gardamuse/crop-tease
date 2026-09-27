<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'

import PageThumb from './PageThumb.vue'
import { openContextMenu } from '@/lib/contextMenu'
import { addPage, removePage, store, switchPage } from '@/lib/store'

const barEl = useTemplateRef('bar')

function confirmRemove(index: number) {
  if (store.pages.length <= 1) return
  if (confirm(`Delete page ${index + 1}? Its photos, dividers, close-ups and text are removed.`)) removePage(index)
}

function onTabMenu(e: MouseEvent, index: number) {
  openContextMenu(e, [
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
        :class="{ active: i === store.pageIndex }"
        :aria-current="i === store.pageIndex ? 'page' : undefined"
        :title="`Page ${i + 1}`"
        @click="switchPage(i)"
        @contextmenu="onTabMenu($event, i)"
      >
        <PageThumb :page="page" />
        <span class="num">{{ i + 1 }}</span>
      </button>
      <button class="add" title="Add a page after this one" aria-label="Add page" @click="addPage()">＋<span>Page</span></button>
    </div>
    <button
      class="delete"
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

.delete {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 1rem;
  background: rgba(#fff, 0.08);

  &:hover:not(:disabled) {
    background: rgba($pink-deep, 0.6);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}
</style>
