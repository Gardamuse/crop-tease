<script lang="ts">
export type SaveStatus = 'loading' | 'saving' | 'saved' | 'error'
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { BORDER_COLOR_PRESETS, MAX_BORDER_WIDTH, MAX_PAGE_SIDE, MIN_PAGE_SIDE, PAGE_PRESETS } from '@/lib/constants'
import type { ExportFormat } from '@/lib/exportImage'
import { setBorderWidth, setPageSize, store } from '@/lib/store'

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

const isPresetColor = computed(() =>
  BORDER_COLOR_PRESETS.some((p) => p.color === store.border.color.toLowerCase()),
)

function onBorderWidth(e: Event) {
  const input = e.target as HTMLInputElement
  const value = Number(input.value)
  if (Number.isFinite(value)) setBorderWidth(value)
  input.value = String(store.border.width) // show the clamped value
}

function onBorderColor(e: Event) {
  store.border.color = (e.target as HTMLInputElement).value
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

const props = defineProps<{
  saveStatus: SaveStatus
}>()

defineEmits<{
  new: []
  open: []
  saveProject: []
  addCircle: []
  addCaption: []
  addBubble: []
  export: []
}>()
</script>

<template>
  <aside class="sidebar">
    <div>
      <h1>Split-Panel Comic Maker</h1>
      <p class="tagline">
        Split the page into panels with bars, drop an image into each panel, add close-ups and captions, then
        export.
      </p>
    </div>

    <div class="tool-group">
      <div class="tool-group-label">Project</div>
      <div class="button-row">
        <button title="Start a new, empty project" @click="$emit('new')">✦ New</button>
        <button title="Open a project saved as .zip" @click="$emit('open')">📂 Open…</button>
      </div>
      <button title="Download the project and its images as a .zip" @click="$emit('saveProject')">
        💾 Save project (.zip)
      </button>
      <p class="save-status" :class="saveStatus">{{ statusText }}</p>
    </div>

    <hr />

    <div class="tool-group">
      <div class="tool-group-label">Add</div>
      <button :class="{ active: store.splitMode }" @click="store.splitMode = !store.splitMode">
        ➗ Split a panel
      </button>
      <button @click="$emit('addCircle')">◯ Close-up</button>
      <button @click="$emit('addCaption')">▭ Caption</button>
      <button @click="$emit('addBubble')">💬 Speech bubble</button>
    </div>

    <hr />

    <div class="tool-group">
      <div class="tool-group-label">Page size (px)</div>
      <select :value="presetIndex" @change="onPreset">
        <option :value="-1" disabled>Custom</option>
        <option v-for="(p, i) in PAGE_PRESETS" :key="p.label" :value="i">
          {{ p.label }} ({{ p.width }}&times;{{ p.height }})
        </option>
      </select>
      <div class="dimensions">
        <input
          type="number"
          :min="MIN_PAGE_SIDE"
          :max="MAX_PAGE_SIDE"
          :value="store.page.width"
          aria-label="Page width"
          @change="onDimension('width', $event)"
        />
        <span>&times;</span>
        <input
          type="number"
          :min="MIN_PAGE_SIDE"
          :max="MAX_PAGE_SIDE"
          :value="store.page.height"
          aria-label="Page height"
          @change="onDimension('height', $event)"
        />
      </div>
    </div>

    <hr />

    <div class="tool-group">
      <div class="tool-group-label">Border &amp; dividers</div>
      <div class="border-width">
        <input
          type="range"
          min="0"
          :max="MAX_BORDER_WIDTH"
          :value="store.border.width"
          aria-label="Border width"
          @input="onBorderWidth"
        />
        <input
          type="number"
          min="0"
          :max="MAX_BORDER_WIDTH"
          :value="store.border.width"
          aria-label="Border width in pixels"
          @change="onBorderWidth"
        />
        <span>px</span>
      </div>
      <div class="color-options" role="radiogroup" aria-label="Border color">
        <button
          v-for="p in BORDER_COLOR_PRESETS"
          :key="p.color"
          role="radio"
          :aria-checked="store.border.color.toLowerCase() === p.color"
          :class="{ active: store.border.color.toLowerCase() === p.color }"
          @click="store.border.color = p.color"
        >
          <span class="swatch" :style="{ background: p.color }" />{{ p.label }}
        </button>
        <label
          class="custom-color"
          :class="{ active: !isPresetColor }"
          role="radio"
          :aria-checked="!isPresetColor"
          title="Pick a custom color"
        >
          <span class="swatch" :style="{ background: isPresetColor ? undefined : store.border.color }" />Custom
          <input type="color" :value="store.border.color" @input="onBorderColor" />
        </label>
      </div>
      <p class="option-note">
        {{ store.border.width ? 'Border' : 'No border' }}; the color also applies to the split bars and close-up
        rings.
      </p>
    </div>

    <hr />

    <div class="tool-group">
      <div class="format-toggle" role="radiogroup" aria-label="Export format">
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
      <button class="primary" @click="$emit('export')">
        ⬇ Download {{ store.exportFormat.toUpperCase() }} ({{ store.page.width }}&times;{{ store.page.height }})
      </button>
    </div>

    <hr />

    <p class="hint">
      <b>Move a bar</b> by dragging it; <b>tilt</b> it by dragging an end, which can slide along the border or
      another bar.<br />
      <b>Move</b> an element by dragging it.<br />
      <b>Rotate</b>/<b>resize</b> a selected caption or bubble with its handles.<br />
      <b>Reposition a photo</b> by dragging a panel, or Ctrl+dragging a close-up.<br />
      <b>Zoom a photo</b> by scrolling over it.<br />
      <b>Set a photo</b> by clicking an empty panel or close-up, or dropping an image on it.<br />
      <b>Edit text</b> by double-clicking a caption or bubble.
    </p>

    <p class="footnote">Everything stays in your browser &middot; nothing is uploaded anywhere.</p>
  </aside>
</template>

<style scoped lang="scss">
.sidebar {
  flex: 0 0 260px;
  width: 260px;
  background: $toolbar-bg;
  border-right: 1px solid $toolbar-border;
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto; // safety net on very short viewports

  h1 {
    margin: 0;
    font-size: 1.25rem;
    letter-spacing: 0.3px;
    line-height: 1.25;
  }

  hr {
    border: none;
    border-top: 1px solid $toolbar-border;
    margin: 0;
    width: 100%;
  }
}

.tagline {
  margin: 2px 0 0;
  font-size: 0.82rem;
  color: $muted;
  line-height: 1.4;
}

.tool-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-group-label {
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
  text-align: left;
  width: 100%;

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

    &:hover {
      background: $ink-soft;
    }
  }
}

.dimensions {
  display: flex;
  align-items: center;
  gap: 6px;
  color: $muted;

  input {
    flex: 1;
    min-width: 0;
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

.border-width {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: $muted;

  input[type='range'] {
    flex: 1;
    min-width: 0;
    accent-color: $pink-deep;
  }

  input[type='number'] {
    width: 64px;
  }
}

.color-options {
  display: flex;
  gap: 6px;

  button,
  .custom-color {
    flex: 1;
    justify-content: center;
    padding: 7px 6px;
    font-size: 0.78rem;
  }

  .custom-color {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    border-radius: 8px;
    border: 1px solid $toolbar-border;
    background: #fff;
    cursor: pointer;

    &:hover {
      background: #fff0f8;
      border-color: $pink;
    }

    &.active {
      background: #fff0f8;
      border-color: $pink-deep;
      color: $pink-deep;
    }

    // the native picker covers the whole label so any click opens it
    input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }
  }

  .swatch {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: 4px;
    border: 1px solid rgba($ink, 0.35);
    // an empty custom swatch shows a rainbow hint
    background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
  }
}

.option-note {
  margin: 0;
  font-size: 0.72rem;
  color: $muted;
  line-height: 1.4;
}

.button-row {
  display: flex;
  gap: 6px;
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

.format-toggle {
  display: flex;
  gap: 6px;

  button {
    justify-content: center;

    &.active {
      background: #fff0f8;
      border-color: $pink-deep;
      color: $pink-deep;
    }
  }
}

.hint {
  font-size: 0.76rem;
  color: $muted;
  line-height: 1.45;
  margin: 0;

  b {
    color: $ink;
  }
}

.footnote {
  margin: auto 0 0;
  font-size: 0.68rem;
  color: $muted;
  line-height: 1.4;
}
</style>
