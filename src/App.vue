<script setup lang="ts">
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'

import ComicSidebar, { type SaveStatus } from '@/components/ComicSidebar.vue'
import ComicStage from '@/components/ComicStage.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import PageBar from '@/components/PageBar.vue'
import TaskDialog from '@/components/TaskDialog.vue'
import { EXPORT_MIME, zipImages } from '@/lib/exportImage'
import {
  buildProjectZip,
  newProject,
  openProjectZip,
  PROJECT_EXTENSION,
  PROJECT_MIME,
  restoreAutosave,
  startAutosave,
} from '@/lib/project'
import {
  addCircle,
  addPageNumber,
  addText,
  clearContent,
  firstPanelImage,
  loadStarterPage,
  store,
  switchPage,
} from '@/lib/store'
import { offerFile, runWithProgress } from '@/lib/task'

const stage = useTemplateRef('stage')
const projectInput = useTemplateRef('projectInput')
const saveStatus = ref<SaveStatus>('loading')

const REPLACE_WARNING =
  `This replaces the current project. Save it first if you want to keep it.\n\nContinue?`

function onAddCircle() {
  addCircle(firstPanelImage())
}

function reportError(action: string, err: unknown) {
  console.error(err)
  alert(`${action} failed: ${err instanceof Error ? err.message : err}`)
}

async function onNew() {
  const message =
    'Start a new project? This removes all photos, dividers, close-ups and text. ' +
    'Page size, line and close-up settings are kept.\n\nSave the current project first if you want to keep it.'
  if (!confirm(message)) return
  try {
    await newProject(clearContent)
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
        name: `comic-project-${dateStamp()}.${PROJECT_EXTENSION}`,
        description: 'Comic Maker project',
        mime: PROJECT_MIME,
        extension: PROJECT_EXTENSION,
      })
    })
  } catch (err) {
    reportError('Saving the project', err)
  }
}

async function onExport() {
  const { width, height } = store.pageSize
  const format = store.exportFormat
  // exports the page being edited; name it by page number once there are several
  const pageNumber = store.pages.length > 1 ? `-${store.pageIndex + 1}` : ''
  try {
    const title = store.pages.length > 1 ? `Exporting page ${store.pageIndex + 1}` : `Exporting ${format.toUpperCase()}`
    await runWithProgress(title, async (report) => {
      const image = await stage.value!.renderImage(report)
      report(1, 'Choosing where to save')
      await offerFile(image, {
        name: `comic-page${pageNumber}-${width}x${height}.${format}`,
        description: `${format.toUpperCase()} image`,
        mime: EXPORT_MIME[format],
        extension: format,
      })
    })
  } catch (err) {
    reportError('Export', err)
  }
}

/**
 * Renders every page in turn (switching the stage to each one) and saves
 * them together as a zip of page-01.webp, page-02.webp, ..., then returns to
 * the page that was open.
 */
async function onExportAll() {
  const { width, height } = store.pageSize
  const format = store.exportFormat
  const count = store.pages.length
  const startPage = store.pageIndex
  const digits = Math.max(2, String(count).length) // page-01, page-02, ... sort correctly
  try {
    await runWithProgress(`Exporting ${count} pages`, async (report) => {
      const files: { name: string; blob: Blob }[] = []
      for (let i = 0; i < count; i++) {
        switchPage(i)
        await nextTick() // let the page's panels and elements mount
        const label = `Page ${i + 1} of ${count}`
        const blob = await stage.value!.renderImage((f) => report(((i + f) / count) * 0.95, label))
        files.push({ name: `page-${String(i + 1).padStart(digits, '0')}.${format}`, blob })
      }
      switchPage(startPage)
      report(0.97, 'Packing pages')
      const zip = await zipImages(files)
      report(1, 'Choosing where to save')
      await offerFile(zip, {
        name: `comic-pages-${width}x${height}-${format}.zip`,
        description: 'Zip of page images',
        mime: 'application/zip',
        extension: 'zip',
      })
    })
  } catch (err) {
    reportError('Export', err)
  } finally {
    switchPage(startPage)
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
      @add-text="addText()"
      @add-page-number="addPageNumber()"
      @export-all="onExportAll"
      @export="onExport"
    />
    <div class="workspace">
      <ComicStage ref="stage" />
      <PageBar />
    </div>
    <TaskDialog />
    <ContextMenu />
    <input ref="projectInput" type="file" :accept="`.${PROJECT_EXTENSION}`" hidden @change="onProjectChosen" />
  </div>
</template>

<style scoped lang="scss">
.app {
  display: flex;
  align-items: stretch;
  height: 100vh;
  width: 100vw;
}

.workspace {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: $workspace;
}
</style>
