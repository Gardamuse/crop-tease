<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'

import ComicSidebar from '@/components/ComicSidebar.vue'
import ComicStage from '@/components/ComicStage.vue'
import { addCircle, addText, clearElements, loadStarterPage, store } from '@/lib/store'

const stage = useTemplateRef('stage')

function onAddCircle() {
  addCircle(store.panels.left?.src ?? null)
}

function onClear() {
  if (confirm('Remove all close-ups and text from the page?')) clearElements()
}

async function onExport() {
  try {
    await stage.value?.exportImage()
  } catch (err) {
    console.error(err)
    alert(`Export failed: ${err instanceof Error ? err.message : err}`)
  }
}

onMounted(loadStarterPage)
</script>

<template>
  <div class="app">
    <ComicSidebar
      @add-circle="onAddCircle"
      @add-caption="addText('caption', 'Type your caption…')"
      @add-bubble="addText('bubble', 'Speech…')"
      @clear="onClear"
      @export="onExport"
    />
    <ComicStage ref="stage" />
  </div>
</template>

<style scoped lang="scss">
.app {
  display: flex;
  align-items: stretch;
  height: 100vh;
  width: 100vw;
}
</style>
