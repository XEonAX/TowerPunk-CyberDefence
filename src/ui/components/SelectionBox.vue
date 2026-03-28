<template>
  <div
    v-if="ui.isDraggingSelection"
    class="selection-box"
    :style="{
      left: ui.dragBoxX + 'px',
      top: ui.dragBoxY + 'px',
      width: ui.dragBoxW + 'px',
      height: ui.dragBoxH + 'px',
    }"
  />
</template>

<script setup lang="ts">
import { useUiStore } from '../stores/ui.store'
const ui = useUiStore()
</script>

<style scoped>
.selection-box {
  position: fixed;
  border: 1px solid #00aaff;
  background: rgba(0, 100, 255, 0.08);
  pointer-events: none;
  z-index: 50;
}
</style>
