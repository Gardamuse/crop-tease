<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'

import ComicSidebar, { type SaveStatus } from '@/components/ComicSidebar.vue'
import ComicStage from '@/components/ComicStage.vue'
import TaskDialog from '@/components/TaskDialog.vue'
import { EXPORT_MIME } from '@/lib/exportImage'
import { buildProjectZip, newProject, openProjectZip, restoreAutosave, startAutosave } from '@/lib/project'
import {
  addCircle,
  addText,
  clearElements,
  firstPanelImage,
  loadStarterPage,
  resetProject,
  store,
} from '@/lib/store'
import { offerFile, runWithProgress } from '@/lib/task'

const stage = useTemplateRef('stage')
const projectInput = useTemplateRef('projectInput')
const saveStatus = ref<SaveStatus>('loading')

const REPLACE_WARNING =
  'This replaces the current project. Save it as a .zip first if you want to keep it.\n\nContinue?'

function onAddCircle() {
  addCircle(firstPanelImage())
}

function onClear() {
  if (confirm('Remove all close-ups and text from the page?')) clearElements()
}

function reportError(action: string, err: unknown) {
  console.error(err)
  alert(`${action} failed: ${err instanceof Error ? err.message : err}`)
}

async function onNew() {
  if (!confirm(REPLACE_WARNING)) return
  try {
    await newProject(resetProject)
  } catch (err) {
    reportError('Starting a new project', err)
  }
}

function onOpen() {
  projectInput.value?.click()
}

async function onProjectChosen() {
  const input = projectInput.value!
  const file = input.files?.[0]
  input.value = ''
  if (!file || !confirm(REPLACE_WARNING)) return
  try {
    await runWithProgress('Opening project', async (report) => {
      report(0.3, 'Reading file')
      await openProjectZip(file)
      report(1, 'Done')
    })
  } catch (err) {
    reportError('Opening the project', err)
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10)
}

async function onSaveProject() {
  try {
    await runWithProgress('Saving project', async (report) => {
      const zip = await buildProjectZip((f) => report(f * 0.9, 'Packing images'))
      report(1, 'Choosing where to save')
      await offerFile(zip, {
        name: `comic-project-${dateStamp()}.zip`,
        description: 'Comic Maker project',
        mime: 'application/zip',
        extension: 'zip',
      })
    })
  } catch (err) {
    reportError('Saving the project', err)
  }
}

async function onExport() {
  const { width, height } = store.page
  const format = store.exportFormat
  try {
    await runWithProgress(`Exporting ${format.toUpperCase()}`, async (report) => {
      const image = await stage.value!.renderImage(report)
      report(1, 'Choosing where to save')
      await offerFile(image, {
        name: `comic-page-${width}x${height}.${format}`,
        description: `${format.toUpperCase()} image`,
        mime: EXPORT_MIME[format],
        extension: format,
      })
    })
  } catch (err) {
    reportError('Export', err)
  }
}

onMounted(async () => {
  if (!(await restoreAutosave())) loadStarterPage()
  startAutosave((status) => (saveStatus.value = status))
  saveStatus.value = 'saved'
})
</script>

<template>
  <div class="app">
    <ComicSidebar
      :save-status="saveStatus"
      @new="onNew"
      @open="onOpen"
      @save-project="onSaveProject"
      @add-circle="onAddCircle"
      @add-caption="addText('caption', 'Type your caption…')"
      @add-bubble="addText('bubble', 'Speech…')"
      @clear="onClear"
      @export="onExport"
    />
    <ComicStage ref="stage" />
    <TaskDialog />
    <input ref="projectInput" type="file" accept=".zip,application/zip" hidden @change="onProjectChosen" />
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
