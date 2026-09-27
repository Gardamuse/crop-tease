<script setup lang="ts">
import { EXPORT_H, EXPORT_W } from '@/lib/constants'

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
      <button @click="$emit('clear')">🗑 Clear page</button>
      <button class="primary" @click="$emit('export')">⬇ Download PNG ({{ EXPORT_W }}&times;{{ EXPORT_H }})</button>
    </div>

    <hr />

    <p class="hint">
      <b>Move</b> an element by dragging it.<br />
      <b>Rotate</b>/<b>resize</b> a selected caption or bubble with its handles.<br />
      <b>Reposition a photo</b> (in a panel or close-up) with Alt+drag.<br />
      <b>Zoom a photo</b> by scrolling over it.<br />
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
