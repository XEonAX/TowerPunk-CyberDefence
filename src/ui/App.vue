<template>
  <div id="app-root">
    <!-- Landing page overlay — shown before the game starts -->
    <Transition name="landing-fade">
      <LandingPage v-if="showLanding" @start="onStart" />
    </Transition>

    <div id="pixi-container"></div>
    <HUD />
    <TowerPanel @command="handleCommand" />
    <AbilityBar @command="handleCommand" />
    <InspectPanel />
    <MultiSelectPanel @command="handleCommand" />
    <SelectionBox />
    <WaveTimer />
    <GameResult @restart="handleRestart" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import LandingPage from './components/LandingPage.vue'
import HUD from './components/HUD.vue'
import TowerPanel from './components/TowerPanel.vue'
import AbilityBar from './components/AbilityBar.vue'
import InspectPanel from './components/InspectPanel.vue'
import MultiSelectPanel from './components/MultiSelectPanel.vue'
import SelectionBox from './components/SelectionBox.vue'
import WaveTimer from './components/WaveTimer.vue'
import GameResult from './components/GameResult.vue'
import { useUiStore } from './stores/ui.store'
import { useGameStore } from './stores/game.store'
import { CommandType } from '@game/ecs/world'

const gameStore = useGameStore()
const uiStore = useUiStore()

// ── Landing page ────────────────────────────────────────────────────────────
const showLanding = ref(true)
function onStart(): void {
  showLanding.value = false
}

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
    const type = Number(e.key) - 1 // maps '1'→0 … '8'→7
    if (uiStore.selectedTowerType === type) {
      uiStore.selectTowerType(null)
    } else {
      uiStore.selectTowerType(type)
    }
    return
  }

  switch (e.key) {
    // U  →  upgrade selected tower(s)
    case 'u':
    case 'U':
      if (uiStore.selectedTowerEids.length > 1) {
        e.preventDefault()
        for (const eid of uiStore.selectedTowerEids) {
          handleCommand({ type: CommandType.UPGRADE_TOWER, eid })
        }
      } else if (uiStore.selectedTowerEid !== null) {
        e.preventDefault()
        handleCommand({ type: CommandType.UPGRADE_TOWER, eid: uiStore.selectedTowerEid })
      }
      break

    // Delete / Backspace  →  dismantle selected tower(s)
    case 'Delete':
    case 'Backspace':
      if (uiStore.selectedTowerEids.length > 1) {
        e.preventDefault()
        for (const eid of uiStore.selectedTowerEids) {
          handleCommand({ type: CommandType.DISMANTLE_TOWER, eid })
        }
        uiStore.clearInspection()
      } else if (uiStore.selectedTowerEid !== null) {
        e.preventDefault()
        handleCommand({ type: CommandType.DISMANTLE_TOWER, eid: uiStore.selectedTowerEid })
        uiStore.clearInspection()
      }
      break

    // R  →  rotate Data Spike facing (8-way) or toggle Firewall axis (2-way)
    case 'r':
    case 'R':
      if (uiStore.selectedTowerType !== null) {
        e.preventDefault()
        uiStore.rotatePlacementFacing()
      }
      break

    // Enter / Space  →  dismiss landing, start wave, or skip break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (showLanding.value) {
        onStart()
      }
      if (gameStore.isPreGame) {
        handleCommand({ type: CommandType.START_WAVE }) // start wave
      } else if (gameStore.isWaveBreak) {
        handleCommand({ type: CommandType.SKIP_BREAK }) // skip break
      }
      break

    // Escape  →  cancel placement / deselect / clear multi-selection
    case 'Escape':
      if (uiStore.selectedTowerType !== null) {
        e.preventDefault()
        uiStore.selectTowerType(null)
      } else if (uiStore.selectedTowerEids.length > 0 || uiStore.inspectedKind !== null) {
        e.preventDefault()
        uiStore.clearInspection()
      }
      break
    case '+':
    case '=':
      e.preventDefault()
      uiStore.increaseSpeed()
      break
    case '-':
      e.preventDefault()
      uiStore.decreaseSpeed()
      break
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  background: #0a0a0f;
  overflow: hidden;
}
#app-root {
  width: 100vw;
  height: 100vh;
  position: relative;
}
#pixi-container {
  position: absolute;
  inset: 0;
}

/* ── Landing page transition ────────────────────────────────────────────── */
.landing-fade-leave-active {
  transition: opacity 0.8s ease;
}
.landing-fade-leave-to {
  opacity: 0;
}

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
