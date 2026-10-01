<script lang="ts">
export type SaveStatus = 'loading' | 'saving' | 'saved' | 'error'
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'

import ColorChoices from './ColorChoices.vue'
import MenuEntries from './MenuEntries.vue'
import PixelSlider from './PixelSlider.vue'
import RecentProjects from './RecentProjects.vue'
import UiIcon from './UiIcon.vue'
import {
  COLOR_PRESETS,
  FONT_SIZE_STEPS,
  MAX_BORDER_WIDTH,
  MAX_DIVIDER_WIDTH,
  MAX_OUTLINE_WIDTH,
  MAX_PAGE_SIDE,
  MAX_TYPED_FONT_PX,
  MIN_OUTLINE_WIDTH,
  MIN_PAGE_SIDE,
  MIN_TYPED_FONT_PX,
  PAGE_PRESETS,
} from '@/lib/constants'
import type { ExportFormat } from '@/lib/exportImage'
import { clamp } from '@/lib/math'
import { toneEntries } from '@/lib/photoEffects'
import { addCustomFont, fontChoices, previewFamily, removeCustomFont, resolveFont } from '@/lib/textFonts'
import {
  missingFonts,
  removeElement,
  setBorderWidth,
  setDividerWidth,
  setOutlineWidth,
  setPageSize,
  stageSize,
  store,
} from '@/lib/store'

const props = defineProps<{
  saveStatus: SaveStatus
}>()

const emit = defineEmits<{
  new: []
  open: []
  saveProject: []
  addCircle: []
  addText: []
  addPageNumber: []
  exportAll: []
  exportPdf: []
  export: []
}>()

const FORMATS: ExportFormat[] = ['webp', 'jpg']

// the web version links back to the app's page on the site; the desktop
// builds (served from app://, see electron/main.js) have nowhere to go back to
const BACK_URL = location.protocol === 'app:' ? null : 'https://www.blushingdefeat.com/apps/crop-tease/'

const STATUS_TEXT: Record<SaveStatus, string> = {
  loading: 'Loading your last project…',
  saving: 'Saving in this browser…',
  saved: 'Saved in this browser; nothing leaves your computer',
  error: "Couldn't save in this browser; use Save to keep a copy",
}
const statusText = computed(() => STATUS_TEXT[props.saveStatus])

const presetIndex = computed(() =>
  PAGE_PRESETS.findIndex((p) => p.width === store.pageSize.width && p.height === store.pageSize.height),
)

function onPreset(e: Event) {
  const preset = PAGE_PRESETS[Number((e.target as HTMLSelectElement).value)]
  if (preset) setPageSize(preset.width, preset.height)
}

function onDimension(axis: 'width' | 'height', e: Event) {
  const input = e.target as HTMLInputElement
  const value = Number(input.value)
  if (!Number.isFinite(value) || value <= 0) {
    input.value = String(store.pageSize[axis]) // reject junk, show the current size again
    return
  }
  if (axis === 'width') setPageSize(value, store.pageSize.height)
  else setPageSize(store.pageSize.width, value)
}

const borderWidth = computed({ get: () => store.border.width, set: setBorderWidth })
const dividerWidth = computed({ get: () => store.border.dividerWidth, set: setDividerWidth })
const outlineWidth = computed({ get: () => store.border.outlineWidth, set: setOutlineWidth })
// in output pixels, like each text's own size (see TextBox)
const textSize = computed({
  get: () => Math.round(store.textSize * stageSize.value.exportScale),
  set: (px: number) => (store.textSize = clamp(px, MIN_TYPED_FONT_PX, MAX_TYPED_FONT_PX) / stageSize.value.exportScale),
})
const lineColor = computed({
  get: () => store.border.color,
  set: (c: string | null) => {
    if (c) store.border.color = c
  },
})

// One-line summaries shown on the settings sections while they're folded.
const pageSummary = computed(() => {
  const { width, height } = store.pageSize
  return `${PAGE_PRESETS[presetIndex.value]?.label.split(' ')[0] ?? 'Custom'} · ${width}×${height}`
})
const linesSummary = computed(() => `${store.border.width} / ${store.border.dividerWidth} px`)
const photosSummary = computed(() => {
  const { levels, colorBalance } = store.photoFilters
  const parts = [levels && 'levels', colorBalance && 'color balance'].filter(Boolean)
  return parts.length ? parts.join(', ') : 'as they are'
})

// the project's levels and color balance, with the same controls as a photo's menu
const photoFilterEntries = toneEntries(store.photoFilters, 'global', () => true, 'global')

const closeUpsSummary = computed(() => {
  const parts = [store.closeUps.shadow && 'shadow', store.closeUps.withinBorder && 'inside border'].filter(Boolean)
  return parts.length ? parts.join(', ') : 'plain'
})

// Which settings sections are unfolded, remembered in this browser.
const FOLD_KEY = 'crop-tease.open-sections'
const openSections = reactive<Record<string, boolean>>({
  page: false,
  lines: true,
  text: false,
  closeUps: false,
  photos: false,
})
try {
  Object.assign(openSections, JSON.parse(localStorage.getItem(FOLD_KEY) ?? '{}'))
} catch {
  // storage unavailable or junk: keep the defaults
}
watch(openSections, () => {
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify(openSections))
  } catch {
    // not remembered; harmless
  }
})

function onToggle(key: string, e: Event) {
  openSections[key] = (e.target as HTMLDetailsElement).open
}

// The user's own fonts, kept in this browser.
const fontInput = useTemplateRef('fontInput')

async function onFontsChosen() {
  const input = fontInput.value!
  const files = [...(input.files ?? [])]
  input.value = ''
  for (const file of files) {
    try {
      await addCustomFont(file)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }
}

async function onRemoveFont(name: string) {
  if (!confirm(`Remove the font "${name}" from this browser? Text using it will be shown in the default font.`)) return
  await removeCustomFont(name)
}

// The Recent projects view, shown in place of the sidebar's controls.
const recentOpen = ref(false)

function fromRecent(action: 'new' | 'open') {
  recentOpen.value = false
  if (action === 'new') emit('new')
  else emit('open')
}

// The How-to card, opened from the ? button.
const helpOpen = ref(false)
// the app and its save format described for AI agents (public/crop-tease-skill.md)
const SKILL_URL = `${import.meta.env.BASE_URL}crop-tease-skill.md`
const helpEl = useTemplateRef('help')
const helpButton = useTemplateRef('helpButton')

function onWindowPointerDown(e: PointerEvent) {
  const target = e.target as Node
  if (helpOpen.value && !helpEl.value?.contains(target) && !helpButton.value?.contains(target)) helpOpen.value = false
}

function onWindowKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') helpOpen.value = false
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
  <aside class="sidebar">
    <header class="sidebar-header">
      <a v-if="BACK_URL" class="icon-button back-link" :href="BACK_URL" title="Back to Blushing Defeat" aria-label="Back">
        <UiIcon name="back" />
      </a>
      <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="4" fill="#fbf3f8" />
        <path d="M6 2 H13 L19 30 H6 A4 4 0 0 1 2 26 V6 A4 4 0 0 1 6 2 Z" fill="#7b2649" />
        <rect x="2" y="2" width="28" height="28" rx="4" fill="none" stroke="#241b30" stroke-width="3" />
        <path d="M13 3 L19 29" stroke="#241b30" stroke-width="3" />
        <circle cx="23" cy="11" r="5" fill="#ff6fb0" stroke="#241b30" stroke-width="2" />
      </svg>
      <h1 title="Crop and zoom your photos into comic pages">Crop Tease</h1>
      <button
        ref="helpButton"
        class="icon-button"
        :class="{ active: helpOpen }"
        title="How to"
        aria-label="How to"
        :aria-expanded="helpOpen"
        @click="helpOpen = !helpOpen"
      >
        <UiIcon name="help" />
      </button>
    </header>

    <div class="project-row">
      <label class="name-field" :title="statusText">
        <span class="status-dot" :class="saveStatus" />
        <input v-model="store.name" type="text" placeholder="comic" spellcheck="false" aria-label="Project name" />
      </label>
      <button
        class="icon-button"
        title="Recent projects"
        aria-label="Recent projects"
        :aria-expanded="recentOpen"
        @click="recentOpen = true"
      >
        <UiIcon name="recent" />
      </button>
      <button
        class="icon-button"
        title="New project (this one stays in Recent projects)"
        aria-label="New project"
        @click="$emit('new')"
      >
        <UiIcon name="new" />
      </button>
      <button class="icon-button" title="Open a saved .ct project" aria-label="Open project" @click="$emit('open')">
        <UiIcon name="open" />
      </button>
      <button
        class="icon-button"
        title="Save the project and its images as a .ct file"
        aria-label="Save project"
        @click="$emit('saveProject')"
      >
        <UiIcon name="save" />
      </button>
    </div>
    <p v-if="saveStatus === 'error'" class="save-error">{{ statusText }}</p>

    <div class="sidebar-body">
      <div class="add-grid">
        <button
          :class="{ active: store.splitMode }"
          title="Split a panel: click this, then the panel"
          @click="store.splitMode = !store.splitMode"
        >
          <UiIcon name="split" />Split
        </button>
        <button title="Add a round close-up" @click="$emit('addCircle')"><UiIcon name="closeUp" />Close-up</button>
        <button title="Add a text box" @click="$emit('addText')"><UiIcon name="text" />Text</button>
        <button
          v-if="!store.pageNumber"
          title="Add a page number shown on every page"
          @click="$emit('addPageNumber')"
        >
          <UiIcon name="hash" />Page no.
        </button>
        <button
          v-else
          class="active"
          title="Remove the page numbers (click again to add them back at the bottom)"
          @click="removeElement(store.pageNumber.id)"
        >
          <UiIcon name="hash" />Page no.
        </button>
      </div>

      <details class="fold" :open="openSections.page" @toggle="onToggle('page', $event)">
        <summary>
          <UiIcon name="chevron" class="chevron" />
          <span class="fold-title">Page</span>
          <span class="fold-summary">{{ pageSummary }}</span>
        </summary>
        <div class="fold-body page-size">
          <select :value="presetIndex" aria-label="Page size preset" @change="onPreset">
            <option :value="-1" disabled>Custom</option>
            <option v-for="(p, i) in PAGE_PRESETS" :key="p.label" :value="i">{{ p.label }}</option>
          </select>
          <div class="dimensions">
            <input
              type="number"
              :min="MIN_PAGE_SIDE"
              :max="MAX_PAGE_SIDE"
              :value="store.pageSize.width"
              aria-label="Page width in pixels"
              @change="onDimension('width', $event)"
            />
            <span>&times;</span>
            <input
              type="number"
              :min="MIN_PAGE_SIDE"
              :max="MAX_PAGE_SIDE"
              :value="store.pageSize.height"
              aria-label="Page height in pixels"
              @change="onDimension('height', $event)"
            />
            <span>px</span>
          </div>
        </div>
      </details>

      <details class="fold" :open="openSections.lines" @toggle="onToggle('lines', $event)">
        <summary>
          <UiIcon name="chevron" class="chevron" />
          <span class="fold-title">Lines</span>
          <span class="fold-summary">
            <span class="mini-swatch" :style="{ background: store.border.color }" />{{ linesSummary }}
          </span>
        </summary>
        <div class="fold-body fields">
          <span class="field-label" title="Runs around the page edge">Border</span>
          <PixelSlider v-model="borderWidth" :max="MAX_BORDER_WIDTH" label="Border width" />

          <span class="field-label" title="The split bars and close-up rings">Dividers</span>
          <PixelSlider v-model="dividerWidth" :max="MAX_DIVIDER_WIDTH" label="Divider thickness" />

          <span class="field-label" title="Applies to the border and dividers">Color</span>
          <ColorChoices v-model="lineColor" :presets="COLOR_PRESETS" label="Line color" />

          <span class="field-label" title="A line along both sides of the border and dividers">Outline</span>
          <ColorChoices v-model="store.border.outlineColor" :presets="COLOR_PRESETS" allow-none label="Outline color" />

          <template v-if="store.border.outlineColor">
            <span />
            <PixelSlider
              v-model="outlineWidth"
              :min="MIN_OUTLINE_WIDTH"
              :max="MAX_OUTLINE_WIDTH"
              label="Outline thickness"
            />
          </template>
        </div>
      </details>

      <details class="fold" :open="openSections.text" @toggle="onToggle('text', $event)">
        <summary>
          <UiIcon name="chevron" class="chevron" />
          <span class="fold-title">Text</span>
          <span class="fold-summary" :class="{ warn: missingFonts.length }">
            {{ missingFonts.length ? 'font missing' : `${resolveFont(store.textFont).label} · ${textSize} px` }}
          </span>
        </summary>
        <div class="fold-body">
          <div class="fields text-size">
            <span class="field-label" title="Text you've resized on its own keeps its size">Size</span>
            <PixelSlider
              v-model="textSize"
              :min="MIN_TYPED_FONT_PX"
              :max="MAX_TYPED_FONT_PX"
              :steps="FONT_SIZE_STEPS"
              label="Size of all text"
            />
          </div>
          <p v-if="missingFonts.length" class="font-missing" role="status">
            Missing {{ missingFonts.length > 1 ? 'fonts' : 'font' }}:
            <b v-for="(name, i) in missingFonts" :key="name">{{ name }}{{ i < missingFonts.length - 1 ? ', ' : '' }}</b>.
            Text using it is shown in the default font until you add the font below or pick another.
          </p>
          <div class="font-grid" role="radiogroup" aria-label="Font of all text">
            <div v-for="font in fontChoices" :key="font.id" class="font-choice">
              <button
                role="radio"
                :aria-checked="store.textFont === font.id"
                :class="{ active: store.textFont === font.id }"
                :style="{ fontFamily: previewFamily(font.id) }"
                :title="
                  font.id === 'classic'
                    ? 'A bold sans, with serif italics in square captions'
                    : font.custom
                      ? `${font.label} (your font, kept in this browser)`
                      : font.label
                "
                @click="store.textFont = font.id"
              >
                {{ font.label }}
              </button>
              <button
                v-if="font.custom"
                class="font-remove"
                :title="`Remove ${font.label} from this browser`"
                :aria-label="`Remove ${font.label}`"
                @click="onRemoveFont(font.label)"
              >
                <UiIcon name="close" />
              </button>
            </div>
            <button class="font-add" title="Use a font file (TTF, OTF, WOFF) from your computer" @click="fontInput?.click()">
              + Add font…
            </button>
          </div>
          <input
            ref="fontInput"
            type="file"
            accept=".ttf,.otf,.woff,.woff2,font/*"
            multiple
            hidden
            @change="onFontsChosen"
          />
        </div>
      </details>

      <details class="fold" :open="openSections.closeUps" @toggle="onToggle('closeUps', $event)">
        <summary>
          <UiIcon name="chevron" class="chevron" />
          <span class="fold-title">Close-ups</span>
          <span class="fold-summary">{{ closeUpsSummary }}</span>
        </summary>
        <div class="fold-body">
          <label class="toggle">
            <input v-model="store.closeUps.shadow" type="checkbox" />
            <span>Drop shadow</span>
          </label>
          <label class="toggle" title="Close-ups don't draw over the page border">
            <input v-model="store.closeUps.withinBorder" type="checkbox" />
            <span>Keep inside the page border</span>
          </label>
        </div>
      </details>

      <details class="fold" :open="openSections.photos" @toggle="onToggle('photos', $event)">
        <summary>
          <UiIcon name="chevron" class="chevron" />
          <span class="fold-title">Filters</span>
          <span class="fold-summary">{{ photosSummary }}</span>
        </summary>
        <div class="fold-body">
          <p class="fold-note">Right-click image to set local filter instead.</p>
          <MenuEntries class="photo-filters" :items="photoFilterEntries" />
        </div>
      </details>
    </div>

    <footer class="sidebar-footer">
      <div class="export-main">
        <div class="segmented" role="radiogroup" aria-label="Image format">
          <button
            v-for="f in FORMATS"
            :key="f"
            role="radio"
            :aria-checked="store.exportFormat === f"
            :class="{ active: store.exportFormat === f }"
            @click="store.exportFormat = f"
          >
            {{ f }}
          </button>
        </div>
        <button
          class="primary"
          :title="`Save the current page as a ${store.exportFormat.toUpperCase()} image`"
          @click="$emit('export')"
        >
          <UiIcon name="export" />Export {{ store.pages.length > 1 ? `page ${store.pageIndex + 1}` : 'image' }}
        </button>
      </div>
      <div class="export-more">
        <button
          v-if="store.pages.length > 1"
          :title="`All ${store.pages.length} pages as ${store.exportFormat.toUpperCase()} images in one zip`"
          @click="$emit('exportAll')"
        >
          All pages .zip
        </button>
        <button title="All pages in one PDF, a page each" @click="$emit('exportPdf')">
          PDF{{ store.pages.length > 1 ? ` · ${store.pages.length} pages` : '' }}
        </button>
      </div>
    </footer>

    <RecentProjects v-if="recentOpen" @close="recentOpen = false" @new="fromRecent('new')" @open="fromRecent('open')" />

    <Transition name="pop">
      <div v-if="helpOpen" ref="help" class="help-card" role="dialog" aria-label="How to">
        <header>
          <h2>How to</h2>
          <button class="icon-button" aria-label="Close" @click="helpOpen = false"><UiIcon name="close" /></button>
        </header>
        <ul>
          <li>
            <b>Projects:</b> each is kept in this browser as you work; the clock button lists them to switch
            between or delete. Save (.ct) keeps a copy on your computer.
          </li>
          <li>
            <b>Pages:</b> the strip beside the page switches and adds them (＋); drag one to reorder. Its
            <b>···</b> or a right-click duplicates, moves or deletes it.
          </li>
          <li><b>Split a panel:</b> Split, then click the panel; drag to choose which side is new.</li>
          <li>
            <b>Bars:</b> drag to move; drag an end along the border or another bar to tilt. Right-click to
            remove, or click and then ×.
          </li>
          <li>
            <b>Photos:</b> click an empty panel or close-up, or drop an image on it (or right-click an empty panel for a color). Drag to reposition
            (Ctrl+drag in a close-up), scroll to zoom. Right-click to change or mirror it, or add effects: blur, a color overlay, levels, color balance. The Filters section sets levels and color balance for all photos.
          </li>
          <li>
            <b>Close-ups and text:</b> drag to move, drag the edge to resize, right-click for options.
            <b>Text:</b> double-click to edit; drag its knob (or Ctrl+drag) to rotate, Shift snaps.
          </li>
          <li>
            <b>Text section:</b> the font and size of all text; right-click a text to give it its own.
            <b>+ Add font…</b> adds a font file, kept in this browser; saved projects (.ct) carry their fonts.
          </li>
          <li>
            <b>Page numbers:</b> one text shown on every page; <code>{n}</code> is the page number,
            <code>{total}</code> the page count. Pages with their border hidden don't show it; a borderless first
            page is a cover and isn't counted.
          </li>
          <li>
            <b>Keys</b> (on the last clicked item): Ctrl+C / Ctrl+V copy and paste, Delete removes, the arrows move
            it (Shift for further). Ctrl+Z undoes, Ctrl+Shift+Z or Ctrl+Y redoes.
          </li>
        </ul>
        <p class="help-more">
          <a :href="SKILL_URL" download="crop-tease-skill.md">Download the AI agent skill</a>: a full description of
          the app and its .ct files, so an AI assistant can lay out comics for you to open and refine here.
        </p>
      </div>
    </Transition>
  </aside>
</template>

<style scoped lang="scss">
$side-pad: 18px;

.sidebar {
  position: relative;
  z-index: 20; // the help card floats over the workspace
  flex: 0 0 364px;
  width: 364px;
  display: flex;
  flex-direction: column;
  background: $bg-panel;
  border-right: 1px solid $line;
  color: $text-main;
}

// ---- header and project ----

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px $side-pad 14px;

  .back-link {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -8px;
    margin-right: -4px;
    border-radius: $radius;
    transition: color 0.2s ease;
  }

  .logo {
    width: 26px;
    height: 26px;
    flex: none;
  }

  h1 {
    flex: 1;
    margin: 0;
    font-family: $font-heading;
    font-size: 1.2rem;
    font-weight: 800;
    letter-spacing: 0.2px;
    color: $text-main;
    cursor: default;

    &::after {
      content: '_';
      color: $accent-ink;
      text-shadow: 0 0 6px $accent-soft;
    }
  }
}

.project-row {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 $side-pad 16px;
  border-bottom: 1px solid $line;
}

.name-field {
  flex: 1;
  min-width: 0;
  position: relative;
  margin-right: 6px;

  input {
    @include field;
    width: 100%;
    padding-left: 22px;
  }
}

// autosave state: a small dot inside the name box, explained on hover
.status-dot {
  position: absolute;
  left: 9px;
  top: 50%;
  width: 6px;
  height: 6px;
  margin-top: -3px;
  border-radius: 50%;
  background: $accent;
  box-shadow: 0 0 6px $accent-dim;

  &.loading,
  &.saving {
    animation: blink 0.8s ease-in-out infinite alternate;
  }

  &.error {
    background: $danger;
    box-shadow: 0 0 6px rgba($danger, 0.5);
  }
}

@keyframes blink {
  to {
    opacity: 0.25;
  }
}

.save-error {
  margin: 8px $side-pad 0;
  font-size: 0.72rem;
  color: $danger;
}

// ---- shared controls ----

button {
  @include ghost-button;
  font-size: 0.8rem;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  white-space: nowrap;

  &.primary {
    @include accent-button;
  }
}

.icon-button {
  flex: none;
  width: 30px;
  height: 30px;
  padding: 0;
  border-color: transparent;
  background: none;
  color: $text-dim;
  font-size: 1rem;

  &:hover:not(:disabled),
  &.active {
    border-color: transparent;
    color: $accent-ink;
    filter: drop-shadow(0 0 6px $accent-soft);
  }
}

select,
input[type='number'] {
  @include field;
}

// ---- body ----

// the middle scrolls on short windows; header and export footer stay put
.sidebar-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px $side-pad;
  display: flex;
  flex-direction: column;
  gap: 4px;
  scrollbar-width: thin;
  scrollbar-color: $line transparent;
}

.add-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;

  // cards: icon above label
  button {
    position: relative;
    @include corner-brackets(7px);
    flex-direction: column;
    gap: 6px;
    padding: 11px 2px 9px;
    font-size: 0.7rem;
    letter-spacing: 0.3px;

    .ui-icon {
      font-size: 1.3rem;
      color: $text-dim;
      transition: color 0.2s ease;
    }

    &:hover:not(:disabled) {
      transform: translateY(-2px);

      .ui-icon {
        color: $accent-ink;
      }
    }

    &.active {
      border-color: $accent;
      background: $accent-soft;

      .ui-icon {
        color: $accent-ink;
      }
    }
  }
}

// folding settings sections: title and a summary of the values when closed
.fold {
  border-top: 1px solid $line;

  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 0;
    cursor: pointer;
    list-style: none;
    user-select: none;

    &::-webkit-details-marker {
      display: none;
    }

    &:hover .chevron {
      color: $accent-ink;
    }
  }

  .chevron {
    order: 3;
    font-size: 0.8rem;
    color: $text-dim;
    transition:
      transform 0.15s,
      color 0.2s;
  }

  &[open] .chevron {
    transform: rotate(90deg);
  }

  .fold-title {
    @include bar-heading;
    font-size: 0.95rem;
    line-height: 1.1;
  }

  .fold-summary {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: $text-dim;
  }

  &[open] .fold-summary {
    visibility: hidden; // the controls show the same values
  }
}

.fold-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 0 18px;
  animation: fold-in 0.2s ease-out;
}

@keyframes fold-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.mini-swatch {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid $line;
}

.page-size select {
  width: 100%;
}

.dimensions {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: $text-dim;

  input {
    min-width: 0;
  }
}

.fold-note {
  margin: 0 0 2px;
  font-size: 0.74rem;
  line-height: 1.4;
  color: $text-dim;
}

// the menu's rows, sitting flush with the section's own and labeled like its fields
.photo-filters {
  margin: 0 -6px 0 -10px;

  :deep(.row-label),
  :deep(.range-slider .label) {
    font-family: inherit;
    font-size: 0.8rem;
    text-transform: none;
    letter-spacing: normal;
    color: $text-main;
  }

  // the narrower sidebar: a row of choices too wide for it moves below its label
  :deep(.choices-row) {
    flex-wrap: wrap;
    row-gap: 6px;
  }

  :deep(.choices) {
    margin-left: auto;
  }
}

.font-missing {
  margin: 0;
  padding: 8px 10px;
  border-radius: $radius;
  border-left: 2px solid $danger;
  background: rgba($danger, 0.08);
  font-size: 0.74rem;
  line-height: 1.45;
  color: $text-main;

  b {
    font-weight: 700;
  }
}

.fold-summary.warn {
  color: $danger;
}

// font choices, each named in its own font
// a little apart from the fonts below
.text-size {
  margin-bottom: 6px;
}

.font-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.font-choice {
  position: relative;
  min-width: 0;

  // the remove button of one of the user's fonts shows on hover
  &:hover .font-remove,
  &:focus-within .font-remove {
    opacity: 1;
  }
}

.font-choice > button:first-child {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 7px 6px;
  font-size: 0.95rem;
  font-size-adjust: cap-height 0.7; // even out fonts drawn much bigger or smaller at the same size
  font-weight: normal;
  background: $bg-field;

  &.active {
    border-color: $accent;
    color: $accent-ink;
    box-shadow: 0 0 0 1px $accent-soft;
  }
}

// the classic choice shows the classic heavy sans
.font-choice:first-child > button {
  font-family: $ui-font;
  font-weight: 800;
  font-size: 0.85rem;
}

.font-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 50%;
  font-size: 0.6rem;
  background: $bg-panel-alt;
  color: $text-dim;
  opacity: 0;
  transition: opacity 0.15s;

  &:hover:not(:disabled) {
    border-color: $danger;
    color: $danger;
  }
}

.font-add {
  grid-column: 1 / -1;
  padding: 7px 6px;
  font-size: 0.78rem;
  border-style: dashed;
  background: none;
  color: $text-dim;

  &:hover:not(:disabled) {
    color: $accent-ink;
  }
}

// label | control rows
.fields {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: center;
  gap: 12px 8px;
}

.fields > * {
  min-width: 0;
}

// same size and color as the checkbox labels
.field-label {
  font-size: 0.8rem;
  color: $text-main;
  cursor: help;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 0.8rem;
  cursor: pointer;

  input {
    width: 15px;
    height: 15px;
    margin: 0;
    accent-color: $accent;
    cursor: pointer;
  }
}

// ---- export footer ----

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px $side-pad 16px;
  border-top: 1px solid $line;
}

.export-main {
  display: flex;
  gap: 8px;

  .primary {
    flex: 1;
    min-width: 0;
    padding: 9px 12px;
  }
}

.segmented {
  flex: none;
  display: flex;
  padding: 2px;
  border-radius: $radius;
  background: $bg-sunken;
  border: 1px solid $line;

  button {
    padding: 5px 8px;
    border: none;
    border-radius: 2px;
    background: none;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: $text-dim;

    &:hover:not(:disabled) {
      color: $text-main;
    }

    &.active {
      background: $bg-panel-alt;
      color: $accent-ink;
      box-shadow: 0 1px 2px rgba($shade, 0.15);
    }
  }
}

.export-more {
  display: flex;
  gap: 8px;

  button {
    flex: 1;
    padding: 6px 8px;
    font-size: 0.74rem;
    background: none;
    color: $text-dim;

    &:hover:not(:disabled) {
      color: $text-main;
    }
  }
}

// ---- how-to card ----

.help-card {
  position: absolute;
  top: 14px;
  left: calc(100% + 14px);
  width: 360px;
  max-height: calc(100% - 28px);
  overflow-y: auto;
  padding: 14px 18px 16px;
  border-radius: $radius;
  background: $bg-panel-alt;
  border: 1px solid $line;
  box-shadow: 0 12px 32px rgba($shade, 0.35);
  font-size: 0.78rem;
  line-height: 1.5;
  color: $text-dim;
  scrollbar-width: thin;
  scrollbar-color: $line transparent;

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  h2 {
    @include bar-heading;
    margin: 0;
    font-size: 1rem;
  }

  ul {
    margin: 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  li::marker {
    color: $accent-ink;
  }

  b {
    font-weight: normal;
    color: $text-main;
  }

  code {
    padding: 0 4px;
    border-radius: 2px;
    background: $accent-soft;
    color: $accent-ink;
  }

  .help-more {
    margin: 12px 0 0;
    padding-top: 10px;
    border-top: 1px solid $line;

    a {
      color: $accent-ink;
      font-weight: 600;
    }
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
  transform: translateY(-6px) scale(0.98);
}
</style>
