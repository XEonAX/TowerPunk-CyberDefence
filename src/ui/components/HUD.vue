<template>
  <div class="hud game-panel">
    <div class="hud-resources">
      <span class="resource eddies">€$ {{ gameStore.eddies }}</span>
      <span class="resource components">🔋 {{ gameStore.components }}</span>
    </div>
    <div class="hud-core">
      <div class="core-label">CORE</div>
      <div class="core-hp-bar">
        <div class="core-hp-fill" :style="{ width: (gameStore.coreHpPercent * 100) + '%' }"></div>
      </div>
      <span class="core-hp-text">{{ Math.ceil(gameStore.coreHp) }} / {{ gameStore.coreHpMax }}</span>
    </div>
    <div class="hud-wave">
      <span v-if="gameStore.isPreGame">WAVE {{ gameStore.currentWave + 1 }} — READY</span>
      <span v-else-if="gameStore.isWaveBreak">WAVE {{ gameStore.currentWave }} COMPLETE — {{ gameStore.breakSecondsRemaining }}s</span>
      <span v-else-if="gameStore.isWaveActive">WAVE {{ gameStore.currentWave }} — {{ gameStore.enemiesAlive }} ENEMIES</span>
      <span v-else-if="gameStore.isVictory" class="victory">BLACKWALL RESTORED — VICTORY!</span>
      <span v-else-if="gameStore.isGameOver" class="game-over">CORE COMPROMISED</span>
    </div>
    <div class="speed-picker">
      <button class="sp-arrow" @click="uiStore.decreaseSpeed()" :disabled="uiStore.gameSpeed <= 0">◀</button>
      <span class="sp-value">{{ uiStore.gameSpeed }}×</span>
      <button class="sp-arrow" @click="uiStore.increaseSpeed()" :disabled="uiStore.gameSpeed >= 16">▶</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game.store'
import { useUiStore } from '../stores/ui.store'

const gameStore = useGameStore()
const uiStore = useUiStore()
</script>

<style scoped>
.hud {
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border: none;
  border-bottom: 1px solid #0044aa;
  border-radius: 0;
  font-size: 14px;
  pointer-events: none;
}
.hud-resources { display: flex; gap: 16px; }
.resource { font-weight: bold; }
.eddies { color: #ffdd00; }
.components { color: #00aaff; }
.hud-core { display: flex; align-items: center; gap: 8px; }
.core-label { color: #0088ff; font-weight: bold; }
.core-hp-bar {
  width: 120px;
  height: 10px;
  background: #111;
  border: 1px solid #0044aa;
  border-radius: 3px;
  overflow: hidden;
}
.core-hp-fill {
  height: 100%;
  background: #0088ff;
  transition: width 0.1s linear;
}
.core-hp-text { color: #aaddff; font-size: 11px; }
.hud-wave { color: #aaff88; }
.victory { color: #00ff88; font-weight: bold; }
.game-over { color: #ff2244; font-weight: bold; }
.speed-picker {
  pointer-events: all;
  display: flex;
  align-items: center;
  gap: 2px;
}
.sp-arrow {
  background: none;
  border: 1px solid #002244;
  color: #0077cc;
  font-size: 8px;
  padding: 1px 4px;
  cursor: pointer;
  font-family: monospace;
  border-radius: 2px;
  line-height: 1;
}
.sp-arrow:disabled { opacity: 0.25; cursor: default; }
.sp-arrow:not(:disabled):hover { border-color: #0088ff; color: #44aaff; }
.sp-value {
  font-size: 12px;
  color: #00ccff;
  min-width: 36px;
  text-align: center;
  font-family: monospace;
}
</style>
