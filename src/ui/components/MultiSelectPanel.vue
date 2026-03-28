<template>
  <div v-if="ui.selectedTowerEids.length > 1" class="multi-panel game-panel">
    <div class="mp-header">
      <span class="mp-title">{{ ui.selectedTowerEids.length }} TOWERS SELECTED</span>
    </div>
    <div class="mp-actions">
      <button class="mp-btn" @click="upgradeAll">[U] Upgrade All</button>
      <button class="mp-btn mp-btn-danger" @click="dismantleAll">[Del] Dismantle All</button>
      <button class="mp-btn" @click="activateAll">Activate All</button>
    </div>
    <div class="mp-hint">Click empty tile or [Esc] to deselect</div>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '../stores/ui.store'
import { CommandType } from '@game/ecs/world'

const emit = defineEmits<{ (e: 'command', cmd: object): void }>()
const ui = useUiStore()

function upgradeAll(): void {
  for (const eid of ui.selectedTowerEids) {
    emit('command', { type: CommandType.UPGRADE_TOWER, eid })
  }
}

function dismantleAll(): void {
  for (const eid of ui.selectedTowerEids) {
    emit('command', { type: CommandType.DISMANTLE_TOWER, eid })
  }
  ui.clearInspection()
}

function activateAll(): void {
  for (const eid of ui.selectedTowerEids) {
    emit('command', { type: CommandType.ACTIVATE_ABILITY, eid })
  }
}
</script>

<style scoped>
.multi-panel {
  bottom: 16px;
  right: 16px;
  width: 200px;
}
.mp-header {
  margin-bottom: 6px;
  border-bottom: 1px solid #002244;
  padding-bottom: 4px;
}
.mp-title {
  font-size: 12px;
  font-weight: bold;
  color: #00bbff;
  letter-spacing: 0.5px;
}
.mp-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}
.mp-btn {
  background: #001a33;
  border: 1px solid #0044aa;
  color: #00ccff;
  font-family: monospace;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 2px;
  cursor: pointer;
  text-align: left;
}
.mp-btn:hover {
  background: #002244;
  border-color: #0066cc;
}
.mp-btn-danger {
  border-color: #660033;
  color: #ff6688;
}
.mp-btn-danger:hover {
  background: #1a0011;
  border-color: #880044;
}
.mp-hint {
  font-size: 9px;
  color: #334455;
  letter-spacing: 0.4px;
}
</style>
