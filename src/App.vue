<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'

import ComicSidebar from '@/components/ComicSidebar.vue'
import ComicStage from '@/components/ComicStage.vue'
import { addCircle, addText, clearElements, DEMO, loadDemo, store } from '@/lib/store'

const stage = useTemplateRef('stage')

function onAddCircle() {
  addCircle(store.panels.left?.src ?? DEMO.faceLeft)
}

function onClear() {
  if (confirm('Remove all close-ups and text from the page?')) clearElements()
}

async function onExport() {
  try {
    await stage.value?.exportPng()
  } catch (err) {
    console.error(err)
    alert('Export failed to rasterize (this can happen with cross-origin images). Try using only dropped/local images.')
  }
}

onMounted(loadDemo)
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
