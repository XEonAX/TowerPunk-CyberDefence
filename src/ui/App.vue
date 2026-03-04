<template>
  <div id="app-root">
    <div id="pixi-container"></div>
    <HUD />
    <TowerPanel @command="handleCommand" />
    <AbilityBar @command="handleCommand" />
    <WaveTimer />
    <GameResult @restart="handleRestart" />
  </div>
</template>

<script setup lang="ts">
import HUD from './components/HUD.vue'
import TowerPanel from './components/TowerPanel.vue'
import AbilityBar from './components/AbilityBar.vue'
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
</style>