<template>
  <div v-if="gameStore.isVictory || gameStore.isGameOver" class="result-overlay">
    <div class="result-card">
      <div v-if="gameStore.isVictory" class="result-title victory">BLACKWALL RESTORED</div>
      <div v-else class="result-title game-over">CORE COMPROMISED</div>

      <div class="result-stats">
        <div class="stat">Waves Survived: <strong>{{ gameStore.currentWave }}</strong></div>
      </div>

      <div class="result-actions">
        <button class="result-btn" @click="emit('restart')">RESTART</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game.store'

const emit = defineEmits<{ restart: [] }>()
const gameStore = useGameStore()
</script>

<style scoped>
.result-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 10, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.result-card {
  background: #020a18;
  border: 2px solid #0066aa;
  padding: 40px 60px;
  text-align: center;
  font-family: monospace;
}
.result-title {
  font-size: 32px;
  font-weight: bold;
  letter-spacing: 4px;
  margin-bottom: 24px;
}
.victory { color: #00ff88; text-shadow: 0 0 20px #00ff88; }
.game-over { color: #ff2244; text-shadow: 0 0 20px #ff2244; }
.result-stats { color: #aaddff; margin-bottom: 24px; font-size: 16px; }
.stat { margin: 8px 0; }
.result-actions { display: flex; gap: 16px; justify-content: center; }
.result-btn {
  padding: 12px 32px;
  font-family: monospace;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  background: #001a33;
  border: 1px solid #0088ff;
  color: #00aaff;
  letter-spacing: 2px;
}
.result-btn:hover { background: #002244; }
</style>
