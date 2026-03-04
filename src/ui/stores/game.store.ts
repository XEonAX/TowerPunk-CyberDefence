/**
 * Game state bridge store — Tech.md §8
 * Synced from simulation each render frame via syncFromWorld().
 * Vue components read from this store only — never directly from ECS (Tech.md §3).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { World } from '@game/ecs/world'
import { GamePhase } from '@game/ecs/world'
import * as C from '@game/ecs/component'
import { CORE_STARTING_HP, INITIAL_EDDIES, INITIAL_COMPONENTS, TICK_RATE } from '@game/constants'

export interface SelectedTowerInfo {
  eid: number
  towerType: number
  towerLevel: number
  hp: number
  hpMax: number
  hasAbility: boolean
  abilityType: number
  abilityLevel: number
  /** Remaining cooldown in ticks (0 = ready) */
  abilityCooldownTicks: number
}

export interface EnemyInspectInfo {
  eid: number
  enemyType: number
  tier: number
  hp: number
  hpMax: number
  /** Effective speed in tiles/sec (tile progress/tick × 60) */
  speedTilesPerSec: number
  /** Damage dealt to Core on breach */
  damage: number
  immunityFlags: number
  slowMagnitude: number
  slowTicksRemaining: number
  stunTicksRemaining: number
  spawnImmunityTicksRemaining: number
}

export interface GatewayInspectInfo {
  eid: number
  x: number
  y: number
  hp: number
  hpMax: number
  isClosing: boolean
}

export const useGameStore = defineStore('game', () => {
  // Core state (synced from simulation)
  const coreHp = ref(CORE_STARTING_HP)
  const coreHpMax = ref(CORE_STARTING_HP)
  const eddies = ref(INITIAL_EDDIES)
  const components = ref(INITIAL_COMPONENTS)
  const currentWave = ref(0)
  const phase = ref<number>(GamePhase.PRE_GAME)
  const breakTicksRemaining = ref(0)
  const enemiesAlive = ref(0)
  const activeGatewayCount = ref(0)
  const tickCount = ref(0)

  /** Per-tower ability state for the currently selected tower instance. */
  const selectedTowerInfo = ref<SelectedTowerInfo | null>(null)

  /** Stats for the currently inspected enemy, or null. */
  const inspectedEnemyInfo = ref<EnemyInspectInfo | null>(null)

  /** Stats for the currently inspected gateway, or null. */
  const inspectedGatewayInfo = ref<GatewayInspectInfo | null>(null)

  // Derived
  const isWaveActive = computed(() => phase.value === GamePhase.WAVE_ACTIVE)
  const isWaveBreak = computed(() => phase.value === GamePhase.WAVE_BREAK)
  const isPreGame = computed(() => phase.value === GamePhase.PRE_GAME)
  const isGameOver = computed(() => phase.value === GamePhase.GAME_OVER)
  const isVictory = computed(() => phase.value === GamePhase.VICTORY)
  const coreHpPercent = computed(() => coreHpMax.value > 0 ? coreHp.value / coreHpMax.value : 0)
  const breakSecondsRemaining = computed(() => Math.ceil(breakTicksRemaining.value / TICK_RATE))

  /**
   * Sync from ECS world — called once per render frame (Tech.md §8).
   * Uses dirty-flag pattern to avoid unnecessary reactivity updates.
   */
  function syncFromWorld(world: World): void {
    const hp = world.healthCurrent[world.coreEid]
    if (coreHp.value !== hp) coreHp.value = hp
    const hpMax = world.healthMax[world.coreEid]
    if (coreHpMax.value !== hpMax) coreHpMax.value = hpMax
    const floorEddies = Math.floor(world.eddies)
    if (eddies.value !== floorEddies) eddies.value = floorEddies
    const floorComps = Math.floor(world.components)
    if (components.value !== floorComps) components.value = floorComps
    if (currentWave.value !== world.currentWave) currentWave.value = world.currentWave
    if (phase.value !== world.currentPhase) phase.value = world.currentPhase
    if (breakTicksRemaining.value !== world.breakTicksRemaining) breakTicksRemaining.value = world.breakTicksRemaining
    if (enemiesAlive.value !== world.enemiesAlive) enemiesAlive.value = world.enemiesAlive
    if (activeGatewayCount.value !== world.activeGatewayCount) activeGatewayCount.value = world.activeGatewayCount
    if (tickCount.value !== world.tickCount) tickCount.value = world.tickCount
  }

  /**
   * Sync selected tower ability state — called from main.ts once per frame.
   * Pass null to deselect.
   */
  function syncSelectedTower(world: World, eid: number | null): void {
    if (eid === null) {
      if (selectedTowerInfo.value !== null) selectedTowerInfo.value = null
      return
    }
    const mask = world.bitmask[eid]
    if (!(mask & C.TOWER) || (mask & C.PENDING_REMOVAL)) {
      if (selectedTowerInfo.value !== null) selectedTowerInfo.value = null
      return
    }
    const hasAbility = !!(mask & C.ABILITY)
    const cooldown = hasAbility ? world.abilityCooldown[eid] : 0
    const hp = world.healthCurrent[eid]
    const hpMax = world.healthMax[eid]
    // Dirty-flag update to avoid triggering unnecessary reactivity
    const prev = selectedTowerInfo.value
    if (
      !prev ||
      prev.eid !== eid ||
      prev.towerLevel !== world.towerLevel[eid] ||
      prev.hasAbility !== hasAbility ||
      prev.abilityLevel !== world.abilityLevel[eid] ||
      Math.abs(prev.abilityCooldownTicks - cooldown) >= 1 ||
      Math.abs(prev.hp - hp) >= 0.5
    ) {
      selectedTowerInfo.value = {
        eid,
        towerType: world.towerType[eid],
        towerLevel: world.towerLevel[eid],
        hp,
        hpMax,
        hasAbility,
        abilityType: world.abilityType[eid],
        abilityLevel: world.abilityLevel[eid],
        abilityCooldownTicks: cooldown,
      }
    }
  }

  /**
   * Sync inspected enemy stats — called once per frame while an enemy is selected.
   * Pass null to clear.
   */
  function syncInspectedEnemy(world: World, eid: number | null): void {
    if (eid === null) {
      if (inspectedEnemyInfo.value !== null) inspectedEnemyInfo.value = null
      return
    }
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY) || (mask & C.PENDING_REMOVAL)) {
      if (inspectedEnemyInfo.value !== null) inspectedEnemyInfo.value = null
      return
    }
    const hp = world.healthCurrent[eid]
    const prev = inspectedEnemyInfo.value
    if (!prev || prev.eid !== eid || Math.abs(prev.hp - hp) >= 0.5 ||
        prev.stunTicksRemaining !== world.stunTicks[eid] ||
        prev.slowTicksRemaining !== world.slowTicks[eid]) {
      inspectedEnemyInfo.value = {
        eid,
        enemyType: world.enemyType[eid],
        tier: world.enemyTier[eid],
        hp,
        hpMax: world.healthMax[eid],
        speedTilesPerSec: world.enemySpeed[eid] * 60,
        damage: world.enemyDamage[eid],
        immunityFlags: world.immunityFlags[eid],
        slowMagnitude: world.slowMagnitude[eid],
        slowTicksRemaining: world.slowTicks[eid],
        stunTicksRemaining: world.stunTicks[eid],
        spawnImmunityTicksRemaining: world.spawnImmunityTicks[eid],
      }
    }
  }

  /**
   * Sync inspected gateway stats — called once per frame while a gateway is selected.
   * Pass null to clear.
   */
  function syncInspectedGateway(world: World, eid: number | null): void {
    if (eid === null) {
      if (inspectedGatewayInfo.value !== null) inspectedGatewayInfo.value = null
      return
    }
    const mask = world.bitmask[eid]
    if (!(mask & C.GATEWAY) || (mask & C.PENDING_REMOVAL)) {
      if (inspectedGatewayInfo.value !== null) inspectedGatewayInfo.value = null
      return
    }
    const hp = world.gatewayHp[eid]
    const prev = inspectedGatewayInfo.value
    if (!prev || prev.eid !== eid || Math.abs(prev.hp - hp) >= 0.5 ||
        prev.isClosing !== !!world.gatewayIsClosing[eid]) {
      inspectedGatewayInfo.value = {
        eid,
        x: world.gatewayX[eid],
        y: world.gatewayY[eid],
        hp,
        hpMax: world.gatewayMaxHp[eid],
        isClosing: !!world.gatewayIsClosing[eid],
      }
    }
  }

  return {
    coreHp, coreHpMax, eddies, components, currentWave, phase,
    breakTicksRemaining, enemiesAlive, activeGatewayCount, tickCount,
    selectedTowerInfo, inspectedEnemyInfo, inspectedGatewayInfo,
    isWaveActive, isWaveBreak, isPreGame, isGameOver, isVictory,
    coreHpPercent, breakSecondsRemaining,
    syncFromWorld, syncSelectedTower, syncInspectedEnemy, syncInspectedGateway,
  }
})
