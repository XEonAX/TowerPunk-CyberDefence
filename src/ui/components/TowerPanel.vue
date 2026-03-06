<template>
  <div class="tower-panel game-panel">
    <div class="panel-header">BUILD</div>

    <!-- Tower type selector grid -->
    <div class="tower-grid">
      <button
        v-for="tower in towerTypes"
        :key="tower.type"
        class="tower-btn"
        :class="{ selected: uiStore.selectedTowerType === tower.type, affordable: canAfford(tower) }"
        :title="tower.name"
        @click="selectTower(tower.type)"
      >
        <span class="tower-key">[{{ tower.type + 1 }}]</span>
        <span class="tower-abbr">{{ tower.abbr }}</span>
        <span class="tower-cost">{{ formatCost(tower) }}</span>
      </button>
    </div>

    <!-- Placement info -->
    <div v-if="uiStore.selectedTowerType !== null" class="placement-info">
      <div class="tower-name">{{ selectedTowerName }}</div>
      <div class="tower-desc">{{ selectedTowerDesc }}</div>
      <div v-if="uiStore.selectedTowerType === 2" class="facing-control">
        <span>Facing: {{ facingName }}</span>
        <button @click="uiStore.rotatePlacementFacing()">Rotate [R]</button>
      </div>
      <button class="cancel-btn" @click="uiStore.selectTowerType(null)">Cancel [Esc]</button>
    </div>

    <!-- Skip Break / Start Wave button -->
    <div class="wave-actions">
      <button
        v-if="gameStore.isPreGame"
        class="wave-btn start"
        @click="emit('command', { type: 6 })"
      >
        START WAVE
      </button>
      <button
        v-else-if="gameStore.isWaveBreak"
        class="wave-btn skip"
        @click="emit('command', { type: 5 })"
      >
        SKIP BREAK ⚡
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game.store'
import { useUiStore } from '../stores/ui.store'

const emit = defineEmits<{ command: [cmd: object] }>()

const gameStore = useGameStore()
const uiStore = useUiStore()

const FACING_NAMES = ['North', 'South', 'East', 'West']
const facingName = computed(() => FACING_NAMES[uiStore.placementFacing])

interface TowerInfo {
  type: number
  name: string
  abbr: string
  baseEddieCost: number
  baseCompCost: number
  desc: string
}

const towerTypes: TowerInfo[] = [
  { type: 0, name: 'ICE Wall',      abbr: 'ICE', baseEddieCost: 50,  baseCompCost: 0,  desc: 'Obstacle with slow DoT' },
  { type: 1, name: 'Firewall',      abbr: 'FW',  baseEddieCost: 75,  baseCompCost: 1,  desc: 'Pair trap — stuns + damages' },
  { type: 2, name: 'Data Spike',    abbr: 'DS',  baseEddieCost: 150, baseCompCost: 2,  desc: 'Piercing line attack' },
  { type: 3, name: 'Daemon Turret', abbr: 'DT',  baseEddieCost: 0,   baseCompCost: 5,  desc: 'Multi-target rotary' },
  { type: 4, name: 'ICE Sniper',    abbr: 'SN',  baseEddieCost: 0,   baseCompCost: 10, desc: 'Long-range with slow' },
  { type: 5, name: 'Blackwall',     abbr: 'BW',  baseEddieCost: 0,   baseCompCost: 20, desc: 'Closes gateways' },
  { type: 6, name: 'Ping Tower',    abbr: 'PG',  baseEddieCost: 0,   baseCompCost: 2,  desc: 'Collects resources' },
  { type: 7, name: 'Harvester',     abbr: 'HV',  baseEddieCost: 0,   baseCompCost: 2,  desc: 'Generates eddies' },
]

const selectedTowerName = computed(() => {
  const t = towerTypes.find(t => t.type === uiStore.selectedTowerType)
  return t?.name ?? ''
})

const selectedTowerDesc = computed(() => {
  const t = towerTypes.find(t => t.type === uiStore.selectedTowerType)
  return t?.desc ?? ''
})

function canAfford(t: TowerInfo): boolean {
  return gameStore.eddies >= t.baseEddieCost && gameStore.components >= t.baseCompCost
}

function formatCost(t: TowerInfo): string {
  const parts: string[] = []
  if (t.baseEddieCost > 0) parts.push(`€${t.baseEddieCost}`)
  if (t.baseCompCost > 0) parts.push(`🔋${t.baseCompCost}`)
  return parts.join(' ') || 'Free'
}

function selectTower(type: number): void {
  if (uiStore.selectedTowerType === type) {
    uiStore.selectTowerType(null)
  } else {
    uiStore.selectTowerType(type)
  }
}
</script>

<style scoped>
.tower-panel {
  top: 42px;
  right: 0;
  width: 180px;
  /* flush to right edge — override global border */
  border: none;
  border-left: 1px solid #0044aa;
  border-bottom: 1px solid #0044aa;
  border-radius: 0;
}
.panel-header {
  font-size: 11px;
  color: #0055bb;
  letter-spacing: 2px;
  margin-bottom: 8px;
  border-bottom: 1px solid #002244;
  padding-bottom: 4px;
}
.tower-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-bottom: 8px;
}
.tower-btn {
  background: #050d1a;
  border: 1px solid #00335a;
  color: #4499cc;
  padding: 6px 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: monospace;
  font-size: 11px;
  border-radius: 2px;
  transition: all 0.1s;
}
.tower-btn:hover { border-color: #0088cc; color: #88ddff; }
.tower-btn.selected { border-color: #00aaff; background: #001a33; color: #00ccff; }
.tower-btn.affordable { border-color: #004466; }
.tower-key  { font-size: 9px; color: #334455; margin-bottom: 1px; }
.tower-abbr { font-weight: bold; font-size: 13px; }
.tower-cost { font-size: 9px; color: #ffaa00; margin-top: 2px; }
.placement-info { border-top: 1px solid #002244; padding-top: 8px; margin-bottom: 8px; }
.tower-name { font-weight: bold; color: #00ccff; margin-bottom: 4px; }
.tower-desc { font-size: 10px; color: #668899; margin-bottom: 6px; }
.facing-control { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.facing-control button {
  font-size: 10px; padding: 2px 6px; cursor: pointer;
  background: #050d1a; border: 1px solid #003355;
  color: #00aacc; font-family: monospace;
}
.cancel-btn {
  width: 100%; padding: 4px; cursor: pointer;
  background: #1a0010; border: 1px solid #440022;
  color: #ff4466; font-family: monospace; font-size: 11px;
}
.wave-actions { border-top: 1px solid #002244; padding-top: 8px; }
.wave-btn {
  width: 100%; padding: 8px 4px; cursor: pointer;
  font-family: monospace; font-size: 12px; font-weight: bold;
  border-radius: 2px; letter-spacing: 1px;
}
.wave-btn.start { background: #001a33; border: 1px solid #0088ff; color: #00aaff; }
.wave-btn.start:hover { background: #002244; }
.wave-btn.skip { background: #1a1a00; border: 1px solid #aaaa00; color: #ffdd00; }
.wave-btn.skip:hover { background: #222200; }
</style>
