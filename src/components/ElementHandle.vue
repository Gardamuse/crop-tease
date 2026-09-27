<script setup lang="ts">
import { NO_EXPORT_ATTR } from '@/lib/exportImage'

defineProps<{
  type: 'delete'
}>()

defineEmits<{
  grab: [e: PointerEvent]
}>()
</script>

<template>
  <div
    class="handle"
    :class="`handle-${type}`"
    v-bind="{ [NO_EXPORT_ATTR]: '' }"
    @pointerdown.stop.prevent="$emit('grab', $event)"
  >
    <template v-if="type === 'delete'">×</template>
  </div>
</template>

<style scoped lang="scss">
.handle {
  position: absolute;
  z-index: 60;
  width: 20px;
  height: 20px;
  border: 3px solid #fff;
  @include handle-shadow;
}

.handle-delete {
  width: 22px;
  height: 22px;
  right: -12px;
  top: -12px;
  background: $ink;
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
