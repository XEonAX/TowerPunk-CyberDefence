<template>
  <div class="wave-timer game-panel" :class="{ warning: isBossNextWave && gameStore.isWaveBreak }">
    <!-- Wave active: show enemy count + progress bar -->
    <template v-if="gameStore.isWaveActive">
      <div class="wt-label">WAVE {{ gameStore.currentWave }}</div>
      <div class="wt-enemies">{{ gameStore.enemiesAlive }} ENEMIES REMAINING</div>
    </template>

    <!-- Break: show countdown -->
    <template v-else-if="gameStore.isWaveBreak">
      <div v-if="isBossNextWave" class="wt-boss-warning">⚠ BOSS WAVE INCOMING ⚠</div>
      <div class="wt-label">WAVE {{ gameStore.currentWave + 1 }} IN</div>
      <div class="wt-countdown">{{ gameStore.breakSecondsRemaining }}s</div>
      <div class="wt-break-bar">
        <div class="wt-break-fill" :style="{ width: breakProgress + '%' }"></div>
      </div>
    </template>

    <!-- Pre-game -->
    <template v-else-if="gameStore.isPreGame">
      <div class="wt-label">WAVE {{ gameStore.currentWave + 1 }}</div>
      <div class="wt-ready">BLACKWALL BREACH INEVITABLE</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game.store'
import { getWaveData } from '@game/wave'
import { TICK_RATE } from '@game/constants'

const gameStore = useGameStore()

/**
 * Is the *next* wave a boss wave? (§8.6.1 — boss waves have AI Overlord/Orchestrator)
 * Used to show the boss warning banner during the break before a boss wave.
 */
const isBossNextWave = computed(() => {
  const nextWave = gameStore.currentWave + 1
  if (nextWave < 1) return false
  return getWaveData(nextWave).hasBoss
})

/**
 * Progress through the break period (0→100), used to drive the shrinking countdown bar.
 * §8.2.3 — base break = 1800 ticks (30s), scales down to 60 ticks (1s) at wave 40+.
 */
const breakProgress = computed(() => {
  const maxBreak = 30 * TICK_RATE  // §8.2.3 max break ticks
  const remaining = gameStore.breakTicksRemaining
  return (remaining / maxBreak) * 100
})
</script>

<style scoped>
.wave-timer {
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  min-width: 200px;
  pointer-events: none;
  transition: border-color 0.3s;
}
.wave-timer.warning {
  border-color: #ff4400;
  box-shadow: 0 0 12px rgba(255, 68, 0, 0.4);
}
.wt-label {
  font-size: 11px;
  color: #005588;
  letter-spacing: 2px;
}
.wt-countdown {
  font-size: 28px;
  font-weight: bold;
  color: #00aaff;
  line-height: 1.1;
}
.wt-enemies {
  font-size: 13px;
  color: #ff8844;
  letter-spacing: 1px;
}
.wt-ready {
  font-size: 13px;
  color: #ff4400;
  letter-spacing: 2px;
}
.wt-boss-warning {
  font-size: 11px;
  color: #ff4400;
  font-weight: bold;
  letter-spacing: 1px;
  margin-bottom: 4px;
  animation: pulse 0.8s ease-in-out infinite alternate;
}
.wt-break-bar {
  width: 100%;
  height: 3px;
  background: #001133;
  border: 1px solid #002244;
  margin-top: 6px;
  border-radius: 2px;
  overflow: hidden;
}
.wt-break-fill {
  height: 100%;
  background: #0066cc;
  transition: width 0.5s linear;
}
@keyframes pulse {
  from { opacity: 0.7; }
  to   { opacity: 1.0; }
}
</style>
