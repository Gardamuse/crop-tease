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
  background: rgba($shade, 0.55);
  backdrop-filter: blur(2px);
}

.dialog {
  position: relative;
  width: min(380px, calc(100vw - 32px));
  padding: 20px 22px;
  border-radius: $radius;
  background: $bg-panel;
  border: 1px solid $line;
  box-shadow: 0 16px 40px rgba($shade, 0.4);
  font-family: $font-mono;
  color: $text-main;
  animation: dialog-in 0.28s ease-out;
  @include corner-brackets;

  h2 {
    @include bar-heading;
    margin: 0 0 16px;
    font-size: 1.05rem;
  }
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
}

.bar {
  height: 4px;
  border-radius: 2px;
  background: $line;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: $accent;
  box-shadow: 0 0 10px $accent-dim;
  transition: width 0.15s ease-out;
}

.label {
  @include micro-label;
  margin: 10px 0 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;

  button {
    @include ghost-button;
    font-size: 0.82rem;
    padding: 8px 14px;

    &.primary {
      @include accent-button;
    }
  }
}
</style>
