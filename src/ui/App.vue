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
import HUD from './components/HUD.vue'
import TowerPanel from './components/TowerPanel.vue'
import AbilityBar from './components/AbilityBar.vue'
import InspectPanel from './components/InspectPanel.vue'
import WaveTimer from './components/WaveTimer.vue'
import GameResult from './components/GameResult.vue'

function handleCommand(cmd: object): void {
  // Commands are dispatched to the simulation command queue via window event
  window.dispatchEvent(new CustomEvent('game:command', { detail: cmd }))
}

function handleRestart(): void {
  window.dispatchEvent(new CustomEvent('game:restart'))
}
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