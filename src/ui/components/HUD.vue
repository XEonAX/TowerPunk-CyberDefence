<template>
  <div class="hud game-panel">
    <div class="hud-resources">
      <span class="resource eddies">€$ <span class="res-num" :class="{ 'res-pop': eddyPopping }">{{ gameStore.eddies }}</span></span>
      <span class="resource components">🔋 <span class="res-num" :class="{ 'res-pop': componentPopping }">{{ gameStore.components }}</span></span>
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

  <!-- Breach alarm overlay -->
  <Transition name="alarm">
    <div v-if="showAlarm" class="wave-alarm breach-open">⚠ BREACH DETECTED</div>
  </Transition>
  <Transition name="alarm">
    <div v-if="showClosed" class="wave-alarm breach-closed">✓ BREACH CLOSED</div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGameStore } from '../stores/game.store'
import { useUiStore } from '../stores/ui.store'

const gameStore = useGameStore()
const uiStore = useUiStore()

// ---- Resource counter pop ----
const eddyPopping = ref(false)
const componentPopping = ref(false)

watch(() => gameStore.eddies, (n, o) => {
  if (n > o) {
    eddyPopping.value = false
    requestAnimationFrame(() => { eddyPopping.value = true })
    setTimeout(() => { eddyPopping.value = false }, 320)
  }
})

watch(() => gameStore.components, (n, o) => {
  if (n > o) {
    componentPopping.value = false
    requestAnimationFrame(() => { componentPopping.value = true })
    setTimeout(() => { componentPopping.value = false }, 320)
  }
})

// ---- Breach alarm ----
const showAlarm = ref(false)
let alarmTimer: ReturnType<typeof setTimeout> | null = null

const showClosed = ref(false)
let closedTimer: ReturnType<typeof setTimeout> | null = null

watch(() => gameStore.activeGatewayCount, (n, o) => {
  if (n > o) {
    showAlarm.value = true
    if (alarmTimer) clearTimeout(alarmTimer)
    alarmTimer = setTimeout(() => { showAlarm.value = false }, 2000)
  } else if (n < o) {
    showClosed.value = true
    if (closedTimer) clearTimeout(closedTimer)
    closedTimer = setTimeout(() => { showClosed.value = false }, 2000)
  }
})
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
.res-num {
  display: inline-block;
  min-width: 4ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
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

/* Resource counter pop — fires when eddies or components increase */
@keyframes res-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.45); filter: brightness(1.8); }
  100% { transform: scale(1); }
}
.res-pop { animation: res-pop 0.32s ease-out; }

/* Breach alarm overlay */
.wave-alarm {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 22px;
  font-weight: bold;
  letter-spacing: 5px;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 200;
  font-family: monospace;
}
.breach-open {
  color: #ff2244;
  text-shadow: 0 0 16px #ff2244, 0 0 32px #ff2244;
}
.breach-closed {
  color: #00ff88;
  text-shadow: 0 0 16px #00ff88, 0 0 32px #00ff88;
}
.alarm-enter-active { animation: alarm-in 0.15s ease-out; }
.alarm-leave-active { animation: alarm-out 1.8s ease-in forwards; }
@keyframes alarm-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(1.3); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@keyframes alarm-out {
  0%   { opacity: 1; }
  60%  { opacity: 1; }
  100% { opacity: 0; }
}
</style>
