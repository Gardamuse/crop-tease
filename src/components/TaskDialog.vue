<script setup lang="ts">
import { cancelPendingSave, confirmPendingSave, task } from '@/lib/task'
</script>

<template>
  <div v-if="task.visible" class="backdrop">
    <div class="dialog" role="dialog" aria-modal="true" :aria-label="task.title">
      <h2>{{ task.title }}</h2>
      <div
        class="bar"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(task.progress * 100)"
      >
        <div class="fill" :style="{ width: `${task.progress * 100}%` }" />
      </div>
      <p class="label">{{ task.label }}&hellip;</p>
      <div v-if="task.awaitingClick" class="actions">
        <button @click="cancelPendingSave">Cancel</button>
        <button class="primary" @click="confirmPendingSave">Save file</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba($ink, 0.35);
}

.dialog {
  width: min(360px, calc(100vw - 32px));
  padding: 20px 22px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 16px 40px rgba($ink, 0.3);

  h2 {
    margin: 0 0 14px;
    font-size: 1rem;
  }
}

.bar {
  height: 10px;
  border-radius: 999px;
  background: $toolbar-bg;
  border: 1px solid $toolbar-border;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: $pink;
  transition: width 0.15s ease-out;
}

.label {
  margin: 10px 0 0;
  font-size: 0.8rem;
  color: $muted;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;

  button {
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid $toolbar-border;
    background: #fff;
    color: $ink;
    cursor: pointer;

    &.primary {
      background: $ink;
      border-color: $ink;
      color: #fff;
    }
  }
}
</style>
