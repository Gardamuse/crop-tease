<script lang="ts">
export type SaveStatus = 'loading' | 'saving' | 'saved' | 'error'
</script>

<script setup lang="ts">
import { computed } from 'vue'

import ColorChoices from './ColorChoices.vue'
import PixelSlider from './PixelSlider.vue'
import {
  COLOR_PRESETS,
  MAX_BORDER_WIDTH,
  MAX_DIVIDER_WIDTH,
  MAX_OUTLINE_WIDTH,
  MAX_PAGE_SIDE,
  MIN_OUTLINE_WIDTH,
  MIN_PAGE_SIDE,
  PAGE_PRESETS,
} from '@/lib/constants'
import type { ExportFormat } from '@/lib/exportImage'
import { setBorderWidth, setDividerWidth, setOutlineWidth, setPageSize, store } from '@/lib/store'

const props = defineProps<{
  saveStatus: SaveStatus
}>()

defineEmits<{
  new: []
  open: []
  saveProject: []
  addCircle: []
  addText: []
  export: []
}>()

const FORMATS: ExportFormat[] = ['webp', 'jpg']

const STATUS_TEXT: Record<SaveStatus, string> = {
  loading: 'Loading your last project…',
  saving: 'Saving in this browser…',
  saved: 'Saved in this browser',
  error: "Couldn't save in this browser; use Save to keep a copy",
}
const statusText = computed(() => STATUS_TEXT[props.saveStatus])

const presetIndex = computed(() =>
  PAGE_PRESETS.findIndex((p) => p.width === store.page.width && p.height === store.page.height),
)

function onPreset(e: Event) {
  const preset = PAGE_PRESETS[Number((e.target as HTMLSelectElement).value)]
  if (preset) setPageSize(preset.width, preset.height)
}

function onDimension(axis: 'width' | 'height', e: Event) {
  const input = e.target as HTMLInputElement
  const value = Number(input.value)
  if (!Number.isFinite(value) || value <= 0) {
    input.value = String(store.page[axis]) // reject junk, show the current size again
    return
  }
  if (axis === 'width') setPageSize(value, store.page.height)
  else setPageSize(store.page.width, value)
}

const borderWidth = computed({ get: () => store.border.width, set: setBorderWidth })
const dividerWidth = computed({ get: () => store.border.dividerWidth, set: setDividerWidth })
const outlineWidth = computed({ get: () => store.border.outlineWidth, set: setOutlineWidth })
const lineColor = computed({
  get: () => store.border.color,
  set: (c: string | null) => {
    if (c) store.border.color = c
  },
})
</script>

<template>
  <aside class="sidebar">
    <header class="sidebar-header">
      <h1>Split-Panel Comic Maker</h1>
    </header>

    <div class="sidebar-body">
      <section>
        <h2>Project</h2>
        <div class="button-row">
          <button title="Start a new, empty project" @click="$emit('new')">✦ New</button>
          <button title="Open a saved .comic project" @click="$emit('open')">📂 Open…</button>
          <button title="Save the project and its images as a .comic file" @click="$emit('saveProject')">
            💾 Save
          </button>
        </div>
        <p class="save-status" :class="saveStatus">{{ statusText }}</p>
      </section>

      <section>
        <h2>Add</h2>
        <div class="add-grid">
          <button
            :class="{ active: store.splitMode }"
            title="Then click the panel to split"
            @click="store.splitMode = !store.splitMode"
          >
            <span class="icon">➗</span>Split panel
          </button>
          <button @click="$emit('addCircle')"><span class="icon">◯</span>Close-up</button>
          <button @click="$emit('addText')"><span class="icon">💬</span>Text</button>
        </div>
      </section>

      <section>
        <h2>Page size</h2>
        <div class="page-size">
          <select :value="presetIndex" aria-label="Page size preset" @change="onPreset">
            <option :value="-1" disabled>Custom</option>
            <option v-for="(p, i) in PAGE_PRESETS" :key="p.label" :value="i">{{ p.label }}</option>
          </select>
          <input
            type="number"
            :min="MIN_PAGE_SIDE"
            :max="MAX_PAGE_SIDE"
            :value="store.page.width"
            aria-label="Page width in pixels"
            @change="onDimension('width', $event)"
          />
          <span>&times;</span>
          <input
            type="number"
            :min="MIN_PAGE_SIDE"
            :max="MAX_PAGE_SIDE"
            :value="store.page.height"
            aria-label="Page height in pixels"
            @change="onDimension('height', $event)"
          />
        </div>
      </section>

      <section>
        <h2>Lines</h2>
        <div class="fields">
          <span class="field-label">Border</span>
          <PixelSlider v-model="borderWidth" :max="MAX_BORDER_WIDTH" label="Border width" />

          <span class="field-label" title="Split bars and close-up rings">Dividers</span>
          <PixelSlider v-model="dividerWidth" :max="MAX_DIVIDER_WIDTH" label="Divider thickness" />

          <span class="field-label">Color</span>
          <ColorChoices v-model="lineColor" :presets="COLOR_PRESETS" label="Line color" />

          <span class="field-label" title="A line along both sides of the border, dividers and close-up rings">
            Outline
          </span>
          <PixelSlider
            v-model="outlineWidth"
            :min="MIN_OUTLINE_WIDTH"
            :max="MAX_OUTLINE_WIDTH"
            :disabled="!store.border.outlineColor"
            label="Outline thickness"
          />
          <ColorChoices
            v-model="store.border.outlineColor"
            class="full-row"
            :presets="COLOR_PRESETS"
            allow-none
            label="Outline color"
          />
        </div>
        <p class="note">
          Border runs around the page edge; dividers are the split bars and close-up rings. Color and outline apply
          to all of them.
        </p>
      </section>

      <section>
        <h2>Close-ups</h2>
        <label class="toggle">
          <input v-model="store.closeUps.shadow" type="checkbox" />
          <span>Drop shadow</span>
        </label>
        <label class="toggle">
          <input v-model="store.closeUps.withinBorder" type="checkbox" />
          <span>Keep inside the page border <small>(don't draw over it)</small></span>
        </label>
      </section>

      <details class="tips" open>
        <summary>How to</summary>
        <ul>
          <li><b>Split a panel:</b> click it; hold and drag to choose which side gets the new panel.</li>
          <li><b>Move a bar:</b> drag it. <b>Tilt it:</b> drag an end along the border or another bar.</li>
          <li><b>Remove a bar:</b> right-click it, or click it and then its ×.</li>
          <li><b>Set a photo:</b> click an empty panel or close-up, or drop an image on it.</li>
          <li><b>Change or remove a photo, delete a close-up:</b> right-click it.</li>
          <li><b>Reposition a photo:</b> drag a panel, or Ctrl+drag a close-up.</li>
          <li><b>Zoom a photo:</b> scroll over it.</li>
          <li><b>Move a close-up or text:</b> drag it. <b>Resize it:</b> drag its edge.</li>
          <li><b>Edit text:</b> double-click it. <b>Rotate it:</b> Ctrl+drag.</li>
          <li><b>Text style, size and color:</b> right-click it.</li>
        </ul>
      </details>
    </div>

    <footer class="sidebar-footer">
      <div class="export-row">
        <div class="choices format" role="radiogroup" aria-label="Export format">
          <button
            v-for="f in FORMATS"
            :key="f"
            role="radio"
            :aria-checked="store.exportFormat === f"
            :class="{ active: store.exportFormat === f }"
            @click="store.exportFormat = f"
          >
            .{{ f }}
          </button>
        </div>
        <button class="primary" @click="$emit('export')">⬇ Export {{ store.exportFormat.toUpperCase() }}</button>
      </div>
      <p class="footnote">
        {{ store.page.width }}&times;{{ store.page.height }} px &middot; everything stays in your browser
      </p>
    </footer>
  </aside>
</template>

<style scoped lang="scss">
$side-pad: 20px;

.sidebar {
  flex: 0 0 360px;
  width: 360px;
  display: flex;
  flex-direction: column;
  background: $toolbar-bg;
  border-right: 1px solid $toolbar-border;
}

.sidebar-header {
  padding: 18px $side-pad 12px;

  h1 {
    margin: 0;
    font-size: 1.2rem;
    letter-spacing: 0.3px;
  }
}

// the middle scrolls on short windows; header and export footer stay put
.sidebar-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 $side-pad 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.sidebar-footer {
  padding: 14px $side-pad 16px;
  border-top: 1px solid $toolbar-border;
  background: $toolbar-bg;
  box-shadow: 0 -6px 14px rgba($ink, 0.05);
}

section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

h2 {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: $muted;
}

button {
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid $toolbar-border;
  background: #fff;
  color: $ink;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;

  &:hover {
    background: #fff0f8;
    border-color: $pink;
  }

  &.active {
    background: #fff0f8;
    border-color: $pink-deep;
    color: $pink-deep;
  }

  &.primary {
    background: $ink;
    color: #fff;
    border-color: $ink;
    justify-content: center;

    &:hover {
      background: $ink-soft;
    }
  }
}

select,
input[type='number'] {
  font: inherit;
  font-size: 0.85rem;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1px solid $toolbar-border;
  background: #fff;
  color: $ink;

  &:focus {
    outline: 2px solid $pink;
    outline-offset: -1px;
  }
}

.button-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;

  button {
    justify-content: center;
    padding: 9px 6px;
  }
}

.save-status {
  margin: 0;
  font-size: 0.72rem;
  color: $muted;

  &.error {
    color: $pink-deep;
    font-weight: 600;
  }
}

.add-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;

  // tiles: icon above label
  button {
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 10px 4px 8px;
    font-size: 0.8rem;
  }

  .icon {
    font-size: 1.15rem;
    line-height: 1;
  }
}

.page-size {
  display: grid;
  grid-template-columns: 1fr 72px auto 72px;
  align-items: center;
  gap: 6px;
  color: $muted;

  select,
  input {
    min-width: 0;
  }
}

// label | control rows
.fields {
  display: grid;
  grid-template-columns: 62px 1fr;
  align-items: center;
  gap: 10px 8px;
}

.field-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: $ink;
}

.choices {
  display: flex;
  gap: 6px;

  button {
    flex: 1 1 0;
    min-width: 0;
    justify-content: center;
    padding: 7px 4px;
    font-size: 0.78rem;
  }
}

.full-row {
  grid-column: 1 / -1;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: $ink;
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: $pink-deep;
    cursor: pointer;
  }

  small {
    font-weight: 400;
    color: $muted;
  }
}

.note {
  margin: 0;
  font-size: 0.72rem;
  color: $muted;
  line-height: 1.4;
}

.tips {
  font-size: 0.76rem;
  color: $muted;
  line-height: 1.45;

  summary {
    cursor: pointer;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  ul {
    margin: 8px 0 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  b {
    color: $ink;
  }
}

.export-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.footnote {
  margin: 8px 0 0;
  font-size: 0.68rem;
  color: $muted;
}
</style>
