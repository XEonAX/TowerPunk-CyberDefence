<template>
  <div id="app-root">
    <div id="pixi-container"></div>
    <HUD />
    <TowerPanel @command="handleCommand" />
    <AbilityBar @command="handleCommand" />
    <InspectPanel />
    <WaveTimer />
    <GameResult @restart="handleRestart" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import HUD from './components/HUD.vue'
import TowerPanel from './components/TowerPanel.vue'
import AbilityBar from './components/AbilityBar.vue'
import InspectPanel from './components/InspectPanel.vue'
import WaveTimer from './components/WaveTimer.vue'
import GameResult from './components/GameResult.vue'
import { useUiStore } from './stores/ui.store'

const uiStore = useUiStore()

function handleCommand(cmd: object): void {
  // Commands are dispatched to the simulation command queue via window event
  window.dispatchEvent(new CustomEvent('game:command', { detail: cmd }))
}

function handleRestart(): void {
  window.dispatchEvent(new CustomEvent('game:restart'))
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent): void {
  // Ignore shortcuts when typing in an input/textarea
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  // 1–8  →  select tower type for placement
  if (e.key >= '1' && e.key <= '8' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    const type = Number(e.key) - 1  // maps '1'→0 … '8'→7
    if (uiStore.selectedTowerType === type) {
      uiStore.selectTowerType(null)
    } else {
      uiStore.selectTowerType(type)
    }
    return
  }

  switch (e.key) {
    // U  →  upgrade selected tower
    case 'u':
    case 'U':
      if (uiStore.selectedTowerEid !== null) {
        e.preventDefault()
        handleCommand({ type: 2, eid: uiStore.selectedTowerEid })
      }
      break

    // Delete / Backspace  →  dismantle selected tower
    case 'Delete':
    case 'Backspace':
      if (uiStore.selectedTowerEid !== null) {
        e.preventDefault()
        handleCommand({ type: 4, eid: uiStore.selectedTowerEid })
        uiStore.clearInspection()
      }
      break

    // R  →  rotate Data Spike facing
    case 'r':
    case 'R':
      if (uiStore.selectedTowerType !== null) {
        e.preventDefault()
        uiStore.rotatePlacementFacing()
      }
      break

    // Escape  →  cancel placement / deselect
    case 'Escape':
      if (uiStore.selectedTowerType !== null) {
        e.preventDefault()
        uiStore.selectTowerType(null)
      } else if (uiStore.inspectedKind !== null) {
        e.preventDefault()
        uiStore.clearInspection()
      }
      break
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0a0a0f; overflow: hidden; }
#app-root { width: 100vw; height: 100vh; position: relative; }
#pixi-container { position: absolute; inset: 0; }

/** Shared panel chrome — applied to every floating UI panel */
.game-panel {
  position: fixed;
  background: rgba(0, 4, 20, 0.92);
  border: 1px solid #0044aa;
  border-radius: 2px;
  font-family: monospace;
  font-size: 12px;
  color: #00ccff;
  padding: 8px;
  z-index: 100;
  user-select: none;
}
</style>