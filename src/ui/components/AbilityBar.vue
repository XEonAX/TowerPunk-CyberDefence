<template>
  <!-- Only shown when a tower instance is selected -->
  <div
    v-if="uiStore.selectedTowerEid !== null && gameStore.selectedTowerInfo"
    class="ability-bar game-panel"
  >
    <div class="ab-header">
      {{ towerTypeName }} <span class="ab-level">LVL {{ gameStore.selectedTowerInfo.towerLevel }}</span>
    </div>

    <!-- Upgrade Tower button (§5.0.5) -->
    <button
      v-if="upgradeTowerCost !== null"
      class="ab-upgrade-btn ab-upgrade-tower-btn"
      :disabled="!canAffordTowerUpgrade"
      @click="upgradeTower"
      :title="`Upgrade tower to level ${(gameStore.selectedTowerInfo?.towerLevel ?? 0) + 1}`"
    >
      UPGRADE
      <span v-if="upgradeTowerCost[0] > 0">€${{ upgradeTowerCost[0] }}</span>
      <span v-if="upgradeTowerCost[1] > 0">🔋{{ upgradeTowerCost[1] }}</span>
    </button>
    <div v-else class="ab-maxlevel">MAX LEVEL</div>

    <!-- Ability locked: show level requirement -->
    <div v-if="!gameStore.selectedTowerInfo.hasAbility" class="ab-locked">
      ABILITY LOCKED — REACH LEVEL 5
    </div>

    <!-- Ability unlocked: show activation button + cooldown -->
    <div v-else class="ab-ability">
      <span class="ab-name">{{ abilityName }}</span>
      <span class="ab-lvl-badge">L{{ gameStore.selectedTowerInfo.abilityLevel }}</span>

      <!-- Ready to activate -->
      <button
        v-if="isAbilityReady"
        class="ab-activate-btn"
        @click="activateAbility"
      >
        ACTIVATE
      </button>

      <!-- On cooldown -->
      <div v-else class="ab-cooldown">
        <div class="ab-cooldown-bar">
          <div class="ab-cooldown-fill" :style="{ width: cooldownPercent + '%' }"></div>
        </div>
        <span class="ab-cooldown-text">{{ cooldownSeconds }}s</span>
      </div>
    </div>

    <!-- Upgrade ability button -->
    <button
      v-if="gameStore.selectedTowerInfo.hasAbility && gameStore.selectedTowerInfo.abilityLevel < 5"
      class="ab-upgrade-btn"
      :disabled="gameStore.components < upgradeAbilityCost"
      @click="upgradeAbility"
      :title="`Upgrade ability — costs ${upgradeAbilityCost} components`"
    >
      UPGRADE ABILITY (🔋{{ upgradeAbilityCost }})
    </button>

    <!-- Dismantle button (§4.2.6) -->
    <button class="ab-dismantle-btn" @click="dismantleTower">DISMANTLE</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game.store'
import { useUiStore } from '../stores/ui.store'
import * as C from '@game/ecs/component'
import {
  ABILITY_UPGRADE_COST,
  MAX_TOWER_LEVEL,
  ICE_WALL_COST,
  FIREWALL_COST,
  DATA_SPIKE_COST,
  DAEMON_TURRET_COST,
  ICE_SNIPER_COST,
  BLACKWALL_TOWER_COST,
  PING_TOWER_COST,
  HARVESTER_COST,
} from '@game/constants'
import { CommandType } from '@game/ecs/world'

const emit = defineEmits<{ command: [cmd: object] }>()

const gameStore = useGameStore()
const uiStore = useUiStore()

/** Cost tables indexed by TowerType — mirrors command.system.ts §5 */
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

const TOWER_TYPE_NAMES: Record<number, string> = {
  [C.TowerType.ICE_WALL]:      'ICE Wall',
  [C.TowerType.FIREWALL]:      'Firewall',
  [C.TowerType.DATA_SPIKE]:    'Data Spike',
  [C.TowerType.DAEMON_TURRET]: 'Daemon Turret',
  [C.TowerType.ICE_SNIPER]:    'ICE Sniper',
  [C.TowerType.BLACKWALL]:     'Blackwall Tower',
  [C.TowerType.PING]:          'Ping Tower',
  [C.TowerType.HARVESTER]:     'Harvester',
}

const ABILITY_NAMES: Record<number, string> = {
  [C.AbilityType.EMP_BLAST]:  'EMP Blast',
  [C.AbilityType.OVERCLOCK]:  'Overclock',
  [C.AbilityType.TUNED]:      'Tuned',
  [C.AbilityType.BOOSTED]:    'Boosted',
  [C.AbilityType.ORACLE]:     'Oracle',
}

/** Base max cooldown (ticks) per ability type at level 1 — Rulebook §6 */
const ABILITY_MAX_COOLDOWN_TICKS: Record<number, number> = {
  [C.AbilityType.EMP_BLAST]:  600,   // §6.1
  [C.AbilityType.OVERCLOCK]:  1200,  // §6.2
  [C.AbilityType.TUNED]:      1200,  // §6.3
  [C.AbilityType.BOOSTED]:    0,     // passive — no cooldown
  [C.AbilityType.ORACLE]:     0,     // passive — no cooldown
}

const towerTypeName = computed(() =>
  TOWER_TYPE_NAMES[gameStore.selectedTowerInfo?.towerType ?? -1] ?? 'Tower'
)

const abilityName = computed(() =>
  ABILITY_NAMES[gameStore.selectedTowerInfo?.abilityType ?? -1] ?? 'Ability'
)

const isAbilityReady = computed(() =>
  (gameStore.selectedTowerInfo?.abilityCooldownTicks ?? 1) <= 0
)

/** Cooldown visual progress — 0% = just activated, 100% = ready */
const cooldownPercent = computed(() => {
  const info = gameStore.selectedTowerInfo
  if (!info) return 100
  const maxCd = ABILITY_MAX_COOLDOWN_TICKS[info.abilityType] ?? 600
  if (maxCd <= 0) return 100
  const remaining = info.abilityCooldownTicks
  return Math.max(0, Math.min(100, ((maxCd - remaining) / maxCd) * 100))
})

const cooldownSeconds = computed(() => {
  const ticks = gameStore.selectedTowerInfo?.abilityCooldownTicks ?? 0
  return Math.ceil(ticks / 60)
})

const upgradeAbilityCost = computed(() => {
  const level = gameStore.selectedTowerInfo?.abilityLevel ?? 0
  return ABILITY_UPGRADE_COST[level] ?? 99
})

/** [eddies, components] cost to upgrade to next tower level, or null if at max. */
const upgradeTowerCost = computed((): readonly [number, number] | null => {
  const info = gameStore.selectedTowerInfo
  if (!info) return null
  if (info.towerLevel >= MAX_TOWER_LEVEL) return null
  return TOWER_COST_TABLES[info.towerType]?.[info.towerLevel] ?? null
})

const canAffordTowerUpgrade = computed(() => {
  const cost = upgradeTowerCost.value
  if (!cost) return false
  return gameStore.eddies >= cost[0] && gameStore.components >= cost[1]
})

function activateAbility(): void {
  const eid = uiStore.selectedTowerEid
  if (eid === null) return
  emit('command', { type: CommandType.ACTIVATE_ABILITY as number, eid })
}

function upgradeAbility(): void {
  const eid = uiStore.selectedTowerEid
  if (eid === null) return
  emit('command', { type: CommandType.UPGRADE_ABILITY as number, eid })
}

function upgradeTower(): void {
  const eid = uiStore.selectedTowerEid
  if (eid === null) return
  emit('command', { type: CommandType.UPGRADE_TOWER as number, eid })
}

function dismantleTower(): void {
  const eid = uiStore.selectedTowerEid
  if (eid === null) return
  emit('command', { type: CommandType.DISMANTLE_TOWER as number, eid })
  uiStore.selectTowerInstance(null)
}
</script>

<style scoped>
.ability-bar {
  bottom: 16px;
  left: 16px;
  min-width: 180px;
}
.ab-header {
  font-size: 12px;
  font-weight: bold;
  color: #00aaff;
  margin-bottom: 6px;
  border-bottom: 1px solid #002244;
  padding-bottom: 4px;
}
.ab-level {
  color: #ffaa00;
  font-size: 10px;
  margin-left: 4px;
}
.ab-locked {
  color: #445566;
  font-size: 10px;
  text-align: center;
  padding: 4px 0;
}
.ab-ability {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.ab-name { color: #88ddff; font-weight: bold; }
.ab-lvl-badge {
  background: #001a33;
  border: 1px solid #003355;
  color: #4499cc;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 9px;
}
.ab-activate-btn {
  padding: 3px 10px;
  background: #001a33;
  border: 1px solid #0088ff;
  color: #00aaff;
  font-family: monospace;
  font-size: 11px;
  cursor: pointer;
  border-radius: 2px;
  font-weight: bold;
}
.ab-activate-btn:hover { background: #002244; color: #44ccff; }
.ab-cooldown {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.ab-cooldown-bar {
  flex: 1;
  height: 4px;
  background: #001133;
  border: 1px solid #002244;
  border-radius: 2px;
  overflow: hidden;
}
.ab-cooldown-fill {
  height: 100%;
  background: #0066cc;
  transition: width 0.2s linear;
}
.ab-cooldown-text { color: #668899; font-size: 10px; }
.ab-upgrade-btn {
  width: 100%;
  padding: 4px;
  background: #0a1a0d;
  border: 1px solid #22aa44;
  color: #44cc66;
  font-family: monospace;
  font-size: 10px;
  cursor: pointer;
  border-radius: 2px;
}
.ab-upgrade-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ab-upgrade-btn:not(:disabled):hover { background: #122015; }
.ab-upgrade-tower-btn {
  background: #0a1020;
  border-color: #2266cc;
  color: #44aaff;
  margin-bottom: 4px;
}
.ab-upgrade-tower-btn:not(:disabled):hover { background: #101830; }
.ab-maxlevel {
  text-align: center;
  font-size: 9px;
  color: #ffaa00;
  letter-spacing: 1px;
  padding: 2px 0 4px;
}
.ab-dismantle-btn {
  width: 100%;
  margin-top: 4px;
  padding: 4px;
  background: #1a0008;
  border: 1px solid #660022;
  color: #ff4466;
  font-family: monospace;
  font-size: 10px;
  cursor: pointer;
  border-radius: 2px;
}
.ab-dismantle-btn:hover { background: #220010; border-color: #880033; }
</style>
