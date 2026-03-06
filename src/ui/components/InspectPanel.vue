<template>
  <!-- Shown when any entity is being inspected -->
  <div v-if="uiStore.inspectedKind !== null" class="inspect-panel game-panel">

    <!-- ── TOWER ── -->
    <template v-if="uiStore.inspectedKind === 'tower' && info">
      <div class="ip-header">
        <span class="ip-title">{{ towerName }}</span>
        <span class="ip-badge">LVL {{ info.towerLevel }}</span>
      </div>
      <div class="ip-hp">
        <div class="ip-bar-bg">
          <div class="ip-bar-fill ip-bar-tower" :style="{ width: towerHpPct + '%' }"></div>
        </div>
        <span class="ip-bar-label">{{ Math.ceil(info.hp) }} / {{ info.hpMax }} HP</span>
      </div>
      <div class="ip-stats">
        <div v-for="stat in towerStats" :key="stat.label" class="ip-stat">
          <span class="ip-stat-label">{{ stat.label }}</span>
          <span class="ip-stat-value">{{ stat.value }}</span>
        </div>
      </div>
      <div class="ip-kb-hints">
        <span class="ip-kb-hint">[U] Upgrade</span>
        <span class="ip-kb-hint ip-kb-hint-danger">[Del] Dismantle</span>
      </div>
    </template>

    <!-- ── ENEMY ── -->
    <template v-else-if="uiStore.inspectedKind === 'enemy' && enemy">
      <div class="ip-header">
        <span class="ip-title">{{ enemyName }}</span>
        <span class="ip-badge ip-badge-enemy">T{{ enemy.tier }}</span>
      </div>
      <div class="ip-hp">
        <div class="ip-bar-bg">
          <div class="ip-bar-fill ip-bar-enemy" :style="{ width: enemyHpPct + '%' }"></div>
        </div>
        <span class="ip-bar-label">{{ Math.ceil(enemy.hp) }} / {{ Math.ceil(enemy.hpMax) }} HP</span>
      </div>
      <div class="ip-stats">
        <div class="ip-stat">
          <span class="ip-stat-label">Speed</span>
          <span class="ip-stat-value">{{ enemy.speedTilesPerSec.toFixed(2) }} t/s</span>
        </div>
        <div class="ip-stat">
          <span class="ip-stat-label">Core DMG</span>
          <span class="ip-stat-value">{{ enemy.damage }}</span>
        </div>
        <div v-if="enemy.stunTicksRemaining > 0" class="ip-stat ip-status-stun">
          <span class="ip-stat-label">STUNNED</span>
          <span class="ip-stat-value">{{ (enemy.stunTicksRemaining / 60).toFixed(1) }}s</span>
        </div>
        <div v-if="enemy.slowTicksRemaining > 0" class="ip-stat ip-status-slow">
          <span class="ip-stat-label">SLOWED</span>
          <span class="ip-stat-value">{{ Math.round(enemy.slowMagnitude * 100) }}% / {{ (enemy.slowTicksRemaining / 60).toFixed(1) }}s</span>
        </div>
        <div v-if="enemy.spawnImmunityTicksRemaining > 0" class="ip-stat ip-status-immune">
          <span class="ip-stat-label">IMMUNE</span>
          <span class="ip-stat-value">{{ (enemy.spawnImmunityTicksRemaining / 60).toFixed(1) }}s</span>
        </div>
      </div>
      <div v-if="enemyImmunityLabels.length > 0" class="ip-immunities">
        <span v-for="label in enemyImmunityLabels" :key="label" class="ip-immunity-tag">{{ label }}</span>
      </div>
    </template>

    <!-- ── GATEWAY ── -->
    <template v-else-if="uiStore.inspectedKind === 'gateway' && gateway">
      <div class="ip-header">
        <span class="ip-title">BLACKWALL GATEWAY</span>
        <span v-if="gateway.isClosing" class="ip-badge ip-badge-closing">CLOSING</span>
        <span v-else class="ip-badge ip-badge-enemy">OPEN</span>
      </div>
      <div class="ip-hp">
        <div class="ip-bar-bg">
          <div class="ip-bar-fill ip-bar-gateway" :style="{ width: gatewayHpPct + '%' }"></div>
        </div>
        <span class="ip-bar-label">{{ Math.ceil(gateway.hp) }} / {{ gateway.hpMax }} HP</span>
      </div>
      <div class="ip-stats">
        <div class="ip-stat">
          <span class="ip-stat-label">Position</span>
          <span class="ip-stat-value">({{ gateway.x }}, {{ gateway.y }})</span>
        </div>
        <div class="ip-stat">
          <span class="ip-stat-label">Status</span>
          <span class="ip-stat-value" :class="gateway.isClosing ? 'ip-closing' : 'ip-open'">
            {{ gateway.isClosing ? 'Being sealed' : 'Spawning enemies' }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game.store'
import { useUiStore } from '../stores/ui.store'
import * as C from '@game/ecs/component'
import {
  TICK_RATE,
  ICE_WALL_DPS, ICE_WALL_SLOW,
  FIREWALL_DPS, FIREWALL_STUN_TICKS,
  DATA_SPIKE_DAMAGE, DATA_SPIKE_RANGE, DATA_SPIKE_COOLDOWN_TICKS,
  DAEMON_TURRET_DAMAGE, DAEMON_TURRET_RANGE, DAEMON_TURRET_COOLDOWN,
  ICE_SNIPER_DAMAGE, ICE_SNIPER_MIN_RANGE, ICE_SNIPER_MAX_RANGE, ICE_SNIPER_SLOW, ICE_SNIPER_COOLDOWN,
  BLACKWALL_TOWER_DPT,
  PING_TOWER_RANGE,
  HARVESTER_EDDIES_PER_TICK,
} from '@game/constants'

const gameStore = useGameStore()
const uiStore = useUiStore()

// Convenience aliases
const info    = computed(() => gameStore.selectedTowerInfo)
const enemy   = computed(() => gameStore.inspectedEnemyInfo)
const gateway = computed(() => gameStore.inspectedGatewayInfo)

// ── Tower helpers ────────────────────────────────────────────────────────────

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

const towerName = computed(() =>
  TOWER_TYPE_NAMES[info.value?.towerType ?? -1] ?? 'Tower'
)

const towerHpPct = computed(() => {
  if (!info.value || info.value.hpMax === 0) return 0
  return Math.max(0, Math.min(100, (info.value.hp / info.value.hpMax) * 100))
})

/** Per-tower-type stat rows shown in the inspect panel */
const towerStats = computed((): { label: string; value: string }[] => {
  const i = info.value
  if (!i) return []
  const lvl = Math.max(0, Math.min(9, i.towerLevel - 1))
  const t = i.towerType
  const stats: { label: string; value: string }[] = []

  if (t === C.TowerType.ICE_WALL) {
    stats.push({ label: 'DPS', value: String(ICE_WALL_DPS[lvl] ?? '—') })
    stats.push({ label: 'Slow', value: Math.round((ICE_WALL_SLOW[lvl] ?? 0) * 100) + '%' })
  } else if (t === C.TowerType.FIREWALL) {
    stats.push({ label: 'DPS', value: String(FIREWALL_DPS[lvl] ?? '—') })
    stats.push({ label: 'Stun', value: (FIREWALL_STUN_TICKS / TICK_RATE).toFixed(1) + 's' })
  } else if (t === C.TowerType.DATA_SPIKE) {
    stats.push({ label: 'Damage', value: String(DATA_SPIKE_DAMAGE[lvl] ?? '—') })
    stats.push({ label: 'Range', value: String(DATA_SPIKE_RANGE[lvl] ?? '—') + ' tiles' })
    stats.push({ label: 'Cooldown', value: (DATA_SPIKE_COOLDOWN_TICKS / TICK_RATE).toFixed(1) + 's' })
  } else if (t === C.TowerType.DAEMON_TURRET) {
    stats.push({ label: 'Damage', value: String(DAEMON_TURRET_DAMAGE[lvl] ?? '—') })
    stats.push({ label: 'Range', value: String(DAEMON_TURRET_RANGE[lvl] ?? '—') + ' tiles' })
    stats.push({ label: 'Cooldown', value: ((DAEMON_TURRET_COOLDOWN[lvl] ?? 120) / TICK_RATE).toFixed(1) + 's' })
  } else if (t === C.TowerType.ICE_SNIPER) {
    stats.push({ label: 'Damage', value: String(ICE_SNIPER_DAMAGE[lvl] ?? '—') })
    stats.push({ label: 'Range', value: ICE_SNIPER_MIN_RANGE + '–' + ICE_SNIPER_MAX_RANGE + ' tiles' })
    stats.push({ label: 'Cooldown', value: ((ICE_SNIPER_COOLDOWN[lvl] ?? 180) / TICK_RATE).toFixed(1) + 's' })
    stats.push({ label: 'Slow', value: Math.round((ICE_SNIPER_SLOW[lvl] ?? 0) * 100) + '%' })
  } else if (t === C.TowerType.BLACKWALL) {
    const dpt = BLACKWALL_TOWER_DPT[lvl] ?? 0
    stats.push({ label: 'GW DMG/s', value: (dpt * TICK_RATE).toFixed(2) })
  } else if (t === C.TowerType.PING) {
    stats.push({ label: 'Range', value: String(PING_TOWER_RANGE[lvl] ?? '—') + ' tiles' })
  } else if (t === C.TowerType.HARVESTER) {
    const ept = HARVESTER_EDDIES_PER_TICK[lvl] ?? 0
    stats.push({ label: 'Eddies/s', value: (ept * TICK_RATE).toFixed(1) })
  }
  return stats
})

// ── Enemy helpers ────────────────────────────────────────────────────────────

const ENEMY_TYPE_NAMES: Record<number, string> = {
  [C.EnemyType.DATA_LEECH]:          'Data Leech',
  [C.EnemyType.CODE_RUNNER]:         'Code Runner',
  [C.EnemyType.FIREWALL_BREACHER]:   'Firewall Breacher',
  [C.EnemyType.GLITCH]:              'Glitch',
  [C.EnemyType.ORCHESTRATOR]:        'Orchestrator',
  [C.EnemyType.VDB_NETRUNNER]:       'VDB Netrunner',
  [C.EnemyType.SABOTEUR]:            'Saboteur',
  [C.EnemyType.AI_OVERLORD]:         'AI Overlord',
}

const enemyName = computed(() =>
  ENEMY_TYPE_NAMES[enemy.value?.enemyType ?? -1] ?? 'Enemy'
)

const enemyHpPct = computed(() => {
  if (!enemy.value || enemy.value.hpMax === 0) return 0
  return Math.max(0, Math.min(100, (enemy.value.hp / enemy.value.hpMax) * 100))
})

const enemyImmunityLabels = computed((): string[] => {
  const flags = enemy.value?.immunityFlags ?? 0
  const labels: string[] = []
  if (flags & C.IMMUNE_STUN)           labels.push('Stun-immune')
  if (flags & C.IMMUNE_SLOW)           labels.push('Slow-immune')
  if (flags & C.IMMUNE_ICE_SLOW)       labels.push('ICE slow-immune')
  if (flags & C.IMMUNE_FIREWALL_STUN)  labels.push('FW stun-immune')
  if (flags & C.IMMUNE_ICE_DOT)        labels.push('ICE DoT-immune')
  if (flags & C.IMMUNE_FIREWALL_DMG)   labels.push('FW dmg-immune')
  return labels
})

// ── Gateway helpers ──────────────────────────────────────────────────────────

const gatewayHpPct = computed(() => {
  if (!gateway.value || gateway.value.hpMax === 0) return 0
  return Math.max(0, Math.min(100, (gateway.value.hp / gateway.value.hpMax) * 100))
})
</script>

<style scoped>
.inspect-panel {
  bottom: 16px;
  right: 16px;
  width: 200px;
}
.ip-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
  border-bottom: 1px solid #002244;
  padding-bottom: 4px;
}
.ip-title {
  font-size: 12px;
  font-weight: bold;
  color: #00aaff;
  letter-spacing: 0.5px;
}
.ip-badge {
  font-size: 10px;
  background: #001a33;
  border: 1px solid #0044aa;
  padding: 1px 5px;
  border-radius: 2px;
  color: #00aaff;
}
.ip-badge-enemy  { border-color: #880000; color: #ff4444; background: #1a0000; }
.ip-badge-closing { border-color: #006600; color: #00ff88; background: #001a0d; }

/* HP bar */
.ip-hp { margin-bottom: 6px; }
.ip-bar-bg {
  height: 6px;
  background: #111;
  border: 1px solid #002244;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 2px;
}
.ip-bar-fill { height: 100%; transition: width 0.15s linear; }
.ip-bar-tower   { background: #0088ff; }
.ip-bar-enemy   { background: #ff4444; }
.ip-bar-gateway { background: #cc0022; }
.ip-bar-label { font-size: 10px; color: #668899; }

/* Stat rows */
.ip-stats { display: flex; flex-direction: column; gap: 3px; margin-bottom: 4px; }
.ip-stat {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}
.ip-stat-label { color: #556677; }
.ip-stat-value { color: #88ccee; font-weight: bold; }
.ip-status-stun .ip-stat-label { color: #ff8800; }
.ip-status-stun .ip-stat-value { color: #ffaa44; }
.ip-status-slow .ip-stat-label { color: #4488ff; }
.ip-status-slow .ip-stat-value { color: #88aaff; }
.ip-status-immune .ip-stat-label { color: #aa44aa; }
.ip-status-immune .ip-stat-value { color: #cc88cc; }

/* Immunity tags */
.ip-immunities {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 3px;
}
.ip-immunity-tag {
  font-size: 9px;
  padding: 1px 4px;
  background: #100020;
  border: 1px solid #440066;
  color: #aa66cc;
  border-radius: 2px;
}

/* Status text */
.ip-closing { color: #00ff88; }
.ip-open    { color: #ff4444; }

/* Keyboard hint row */
.ip-kb-hints {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px solid #002244;
}
.ip-kb-hint {
  font-size: 9px;
  color: #336677;
  letter-spacing: 0.5px;
}
.ip-kb-hint-danger { color: #663344; }

</style>
