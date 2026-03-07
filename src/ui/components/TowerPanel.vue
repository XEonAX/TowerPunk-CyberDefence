<template>
  <div class="tower-panel game-panel">
    <div class="panel-header">
      <span>BUILD</span>
      <div class="level-picker">
        <button class="lv-arrow" @click="uiStore.setPlacementLevel(uiStore.placementLevel - 1)" :disabled="uiStore.placementLevel <= 1">◀</button>
        <span class="lv-value">LV{{ uiStore.placementLevel }}</span>
        <button class="lv-arrow" @click="uiStore.setPlacementLevel(uiStore.placementLevel + 1)" :disabled="uiStore.placementLevel >= 10">▶</button>
      </div>
    </div>

    <!-- Tower type selector grid -->
    <div class="tower-grid">
      <button
        v-for="tower in towerTypes"
        :key="tower.type"
        class="tower-btn"
        :class="{
          selected: uiStore.selectedTowerType === tower.type,
          affordable: canAfford(tower),
        }"
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
      <div v-if="uiStore.selectedTowerType === 1" class="facing-control">
        <span>Axis: {{ firewallAxisName }}</span>
        <button @click="uiStore.rotatePlacementFacing()">Rotate [R]</button>
      </div>
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
        @click="emit('command', { type: CommandType.START_WAVE })"
      >
        [⏎] START WAVE
      </button>
      <button
        v-else-if="gameStore.isWaveBreak"
        class="wave-btn skip"
        @click="emit('command', { type: CommandType.SKIP_BREAK })"
      >
        [␣] SKIP BREAK
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game.store'
import { useUiStore } from '../stores/ui.store'
import { CommandType } from '@game/ecs/world'
import {
  ICE_WALL_COST,
  FIREWALL_COST,
  DATA_SPIKE_COST,
  DAEMON_TURRET_COST,
  ICE_SNIPER_COST,
  BLACKWALL_TOWER_COST,
  PING_TOWER_COST,
  HARVESTER_COST,
} from '@game/constants'

/** Cost tables indexed by TowerType (same order as towerTypes array). Rulebook §5 */
const TOWER_COST_TABLES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  ICE_WALL_COST,
  FIREWALL_COST,
  DATA_SPIKE_COST,
  DAEMON_TURRET_COST,
  ICE_SNIPER_COST,
  BLACKWALL_TOWER_COST,
  PING_TOWER_COST,
  HARVESTER_COST,
]

/**
 * Cumulative [eddies, components] cost to place a tower at `level` (1-based).
 * Sums all level costs from index 0 up to level-1. Rulebook §5.0.4.
 */
function cumulativeCost(towerType: number, level: number): readonly [number, number] {
  const table = TOWER_COST_TABLES[towerType]
  if (!table) return [0, 0]
  let eddies = 0
  let comps = 0
  for (let i = 0; i < level; i++) {
    eddies += table[i]?.[0] ?? 0
    comps  += table[i]?.[1] ?? 0
  }
  return [eddies, comps] as const
}

const emit = defineEmits<{ command: [cmd: object] }>()

const gameStore = useGameStore()
const uiStore = useUiStore()

const FACING_NAMES = ['North', 'South', 'East', 'West', 'North-East', 'South-East', 'South-West', 'North-West']
const facingName = computed(() => FACING_NAMES[uiStore.placementFacing] ?? 'North')

// Firewall cycles through 4 axis orientations
const firewallAxisName = computed(() => {
  if (uiStore.placementFacing === 2) return 'Horizontal'
  if (uiStore.placementFacing === 4) return 'Diagonal ↗↙'
  if (uiStore.placementFacing === 7) return 'Diagonal ↘↖'
  return 'Vertical'
})

interface TowerInfo {
  type: number
  name: string
  abbr: string
  desc: string
}

const towerTypes: TowerInfo[] = [
  { type: 0, name: 'ICE Wall',       abbr: 'ICE', desc: 'Obstacle with slow DoT' },
  { type: 1, name: 'Firewall',       abbr: 'FW',  desc: 'Pair trap — stuns + damages' },
  { type: 2, name: 'Data Spike',     abbr: 'DS',  desc: 'Piercing line attack' },
  { type: 3, name: 'Daemon Turret',  abbr: 'DT',  desc: 'Multi-target rotary' },
  { type: 4, name: 'ICE Sniper',     abbr: 'SN',  desc: 'Long-range with slow' },
  { type: 5, name: 'Blackwall',      abbr: 'BW',  desc: 'Closes gateways' },
  { type: 6, name: 'Ping Tower',     abbr: 'PG',  desc: 'Collects resources' },
  { type: 7, name: 'Harvester',      abbr: 'HV',  desc: 'Generates eddies' },
]

const selectedTowerName = computed(() => {
  const t = towerTypes.find((t) => t.type === uiStore.selectedTowerType)
  return t?.name ?? ''
})

const selectedTowerDesc = computed(() => {
  const t = towerTypes.find((t) => t.type === uiStore.selectedTowerType)
  return t?.desc ?? ''
})

function canAfford(t: TowerInfo): boolean {
  const [e, c] = cumulativeCost(t.type, uiStore.placementLevel)
  return gameStore.eddies >= e && gameStore.components >= c
}

function formatCost(t: TowerInfo): string {
  const [e, c] = cumulativeCost(t.type, uiStore.placementLevel)
  const parts: string[] = []
  if (e > 0) parts.push(`€${e}`)
  if (c > 0) parts.push(`🔋${c}`)
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
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.level-picker {
  display: flex;
  align-items: center;
  gap: 2px;
}
.lv-arrow {
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
.lv-arrow:disabled { opacity: 0.25; cursor: default; }
.lv-arrow:not(:disabled):hover { border-color: #0088ff; color: #44aaff; }
.lv-value {
  font-size: 10px;
  color: #ffaa00;
  min-width: 28px;
  text-align: center;
  letter-spacing: 0;
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
.tower-btn:hover {
  border-color: #0088cc;
  color: #88ddff;
}
.tower-btn.selected {
  border-color: #00aaff;
  background: #001a33;
  color: #00ccff;
}
.tower-btn.affordable {
  border-color: #004466;
}
.tower-key {
  font-size: 9px;
  color: #334455;
  margin-bottom: 1px;
}
.tower-abbr {
  font-weight: bold;
  font-size: 13px;
}
.tower-cost {
  font-size: 9px;
  color: #ffaa00;
  margin-top: 2px;
}
.placement-info {
  border-top: 1px solid #002244;
  padding-top: 8px;
  margin-bottom: 8px;
}
.tower-name {
  font-weight: bold;
  color: #00ccff;
  margin-bottom: 4px;
}
.tower-desc {
  font-size: 10px;
  color: #668899;
  margin-bottom: 6px;
}
.facing-control {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.facing-control button {
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
  background: #050d1a;
  border: 1px solid #003355;
  color: #00aacc;
  font-family: monospace;
}
.cancel-btn {
  width: 100%;
  padding: 4px;
  cursor: pointer;
  background: #1a0010;
  border: 1px solid #440022;
  color: #ff4466;
  font-family: monospace;
  font-size: 11px;
}
.wave-actions {
  border-top: 1px solid #002244;
  padding-top: 8px;
}
.wave-btn {
  width: 100%;
  padding: 8px 4px;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
  font-weight: bold;
  border-radius: 2px;
  letter-spacing: 1px;
}
.wave-btn.start {
  background: #001a33;
  border: 1px solid #0088ff;
  color: #00aaff;
}
.wave-btn.start:hover {
  background: #002244;
}
.wave-btn.skip {
  background: #1a1a00;
  border: 1px solid #aaaa00;
  color: #ffdd00;
}
.wave-btn.skip:hover {
  background: #222200;
}
</style>
