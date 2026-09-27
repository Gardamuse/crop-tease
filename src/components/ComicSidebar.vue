<script setup lang="ts">
import { computed } from 'vue'

import { MAX_PAGE_SIDE, MIN_PAGE_SIDE, PAGE_PRESETS } from '@/lib/constants'
import type { ExportFormat } from '@/lib/exportImage'
import { setPageSize, store } from '@/lib/store'

const FORMATS: ExportFormat[] = ['webp', 'jpg']

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

defineEmits<{
  addCircle: []
  addCaption: []
  addBubble: []
  clear: []
  export: []
}>()
</script>

<template>
  <aside class="sidebar">
    <div>
      <h1>Split-Panel Comic Maker</h1>
      <p class="tagline">
        Drag the seam to move or tilt it, anywhere around the border. Drop images into each half. Add close-ups and
        captions, then export.
      </p>
    </div>

    <div class="tool-group">
      <div class="tool-group-label">Add</div>
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
      <button @click="$emit('clear')">🗑 Clear page</button>
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
      <b>Move</b> an element by dragging it.<br />
      <b>Rotate</b>/<b>resize</b> a selected caption or bubble with its handles.<br />
      <b>Reposition a photo</b> by dragging a panel, or Ctrl+dragging a close-up.<br />
      <b>Zoom a photo</b> by scrolling over it.<br />
      <b>Set a photo</b> by clicking an empty panel, or dropping an image on a panel or close-up.<br />
      <b>Edit text</b> by double-clicking a caption or bubble.
    </p>

    <p class="footnote">Proof of concept &middot; everything lives in your browser &middot; nothing is uploaded anywhere.</p>
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
