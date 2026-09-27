<script setup lang="ts">
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'

import ComicSidebar, { type SaveStatus } from '@/components/ComicSidebar.vue'
import ComicStage from '@/components/ComicStage.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import PageBar from '@/components/PageBar.vue'
import TaskDialog from '@/components/TaskDialog.vue'
import { EXPORT_MIME, zipImages, type ExportFormat } from '@/lib/exportImage'
import { MAX_PAGE_SIDE } from '@/lib/constants'
import { buildPdf } from '@/lib/pdf'
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
  fileBaseName,
  firstPanelImage,
  loadStarterPage,
  store,
  switchPage,
} from '@/lib/store'
import { offerFile, runWithProgress, type Report } from '@/lib/task'

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

async function onSaveProject() {
  try {
    await runWithProgress('Saving project', async (report) => {
      const zip = await buildProjectZip((f) => report(f * 0.9, 'Packing images'))
      report(1, 'Choosing where to save')
      await offerFile(zip, {
        name: `${fileBaseName()}.${PROJECT_EXTENSION}`,
        description: 'Crop Tease project',
        mime: PROJECT_MIME,
        extension: PROJECT_EXTENSION,
      })
    })
  } catch (err) {
    reportError('Saving the project', err)
  }
}

/** File name for one page's image: "name.webp", or "name-page-2.webp" once there are several pages. */
function pageFileName(index: number, format: ExportFormat): string {
  if (store.pages.length === 1) return `${fileBaseName()}.${format}`
  const digits = Math.max(2, String(store.pages.length).length) // -01, -02, ... sort correctly
  return `${fileBaseName()}-page-${String(index + 1).padStart(digits, '0')}.${format}`
}

async function onExport() {
  const format = store.exportFormat
  const index = store.pageIndex
  try {
    const title = store.pages.length > 1 ? `Exporting page ${index + 1}` : `Exporting ${format.toUpperCase()}`
    await runWithProgress(title, async (report) => {
      const image = await stage.value!.renderImage(report)
      report(1, 'Choosing where to save')
      await offerFile(image, {
        name: pageFileName(index, format),
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
 * Renders every page in turn (switching the stage to each one), reporting
 * progress up to `share` of the bar, then returns to the page that was open.
 */
async function renderAllPages(format: ExportFormat, report: Report, share: number, resolution = 1): Promise<Blob[]> {
  const count = store.pages.length
  const startPage = store.pageIndex
  const blobs: Blob[] = []
  try {
    for (let i = 0; i < count; i++) {
      switchPage(i)
      await nextTick() // let the page's panels and elements mount
      const label = `Page ${i + 1} of ${count}`
      blobs.push(await stage.value!.renderImage((f) => report(((i + f) / count) * share, label), format, resolution))
    }
  } finally {
    switchPage(startPage)
  }
  return blobs
}

/** Saves every page as an image, together in one zip. */
async function onExportAll() {
  const format = store.exportFormat
  try {
    await runWithProgress(`Exporting ${store.pages.length} pages`, async (report) => {
      const blobs = await renderAllPages(format, report, 0.95)
      report(0.97, 'Packing pages')
      const zip = await zipImages(blobs.map((blob, i) => ({ name: pageFileName(i, format), blob })))
      report(1, 'Choosing where to save')
      await offerFile(zip, {
        name: `${fileBaseName()}.zip`,
        description: 'Zip of page images',
        mime: 'application/zip',
        extension: 'zip',
      })
    })
  } catch (err) {
    reportError('Export', err)
  }
}

// PDF pages are rendered at twice the page's pixel size and embedded at
// twice 96 dpi, so they keep the same physical size (1 px = 1/96 inch, e.g.
// 1600x2000 -> 1200x1500 pt) but are twice as sharp. The factor shrinks for
// very large pages so the longest side stays within MAX_PAGE_SIDE, which
// keeps the render inside browsers' canvas limits.
const PDF_RESOLUTION = 2
const BASE_DPI = 96

/** Saves every page into one PDF, a page each (rendered as JPEG, which PDF embeds natively). */
async function onExportPdf() {
  const { width, height } = store.pageSize
  const resolution = Math.max(1, Math.min(PDF_RESOLUTION, MAX_PAGE_SIDE / Math.max(width, height)))
  const pixelWidth = Math.round(width * resolution)
  const pixelHeight = Math.round(height * resolution)
  try {
    await runWithProgress(`Exporting PDF`, async (report) => {
      const blobs = await renderAllPages('jpg', report, 0.95, resolution)
      report(0.97, 'Building PDF')
      const pages = await Promise.all(
        blobs.map(async (blob) => ({
          jpeg: new Uint8Array(await blob.arrayBuffer()),
          width: pixelWidth,
          height: pixelHeight,
          dpi: BASE_DPI * (pixelWidth / width),
        })),
      )
      const pdf = buildPdf(pages, store.name.trim() || fileBaseName())
      report(1, 'Choosing where to save')
      await offerFile(pdf, {
        name: `${fileBaseName()}.pdf`,
        description: 'PDF document',
        mime: 'application/pdf',
        extension: 'pdf',
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
      @add-text="addText()"
      @add-page-number="addPageNumber()"
      @export-all="onExportAll"
      @export-pdf="onExportPdf"
      @export="onExport"
    />
    <div class="workspace">
      <PageBar />
      <ComicStage ref="stage" />
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
  background:
    radial-gradient(rgba(#fff, 0.07) 1px, transparent 1px) 0 0 / 24px 24px,
    $dark-void;
}
</style>
