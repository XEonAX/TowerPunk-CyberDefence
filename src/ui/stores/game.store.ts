/**
 * Game state bridge store — Tech.md §8
 * Synced from simulation each render frame via syncFromWorld().
 * Vue components read from this store only — never directly from ECS (Tech.md §3).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { World } from '@game/ecs/world'
import { GamePhase } from '@game/ecs/world'

export const useGameStore = defineStore('game', () => {
  // Core state (synced from simulation)
  const coreHp = ref(100)
  const coreHpMax = ref(100)
  const eddies = ref(400)
  const components = ref(3)
  const currentWave = ref(0)
  const phase = ref<number>(GamePhase.PRE_GAME)
  const breakTicksRemaining = ref(0)
  const enemiesAlive = ref(0)
  const activeGatewayCount = ref(0)
  const tickCount = ref(0)

  // Derived
  const isWaveActive = computed(() => phase.value === GamePhase.WAVE_ACTIVE)
  const isWaveBreak = computed(() => phase.value === GamePhase.WAVE_BREAK)
  const isPreGame = computed(() => phase.value === GamePhase.PRE_GAME)
  const isGameOver = computed(() => phase.value === GamePhase.GAME_OVER)
  const isVictory = computed(() => phase.value === GamePhase.VICTORY)
  const coreHpPercent = computed(() => coreHpMax.value > 0 ? coreHp.value / coreHpMax.value : 0)
  const breakSecondsRemaining = computed(() => Math.ceil(breakTicksRemaining.value / 60))

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

  return {
    coreHp, coreHpMax, eddies, components, currentWave, phase,
    breakTicksRemaining, enemiesAlive, activeGatewayCount, tickCount,
    isWaveActive, isWaveBreak, isPreGame, isGameOver, isVictory,
    coreHpPercent, breakSecondsRemaining,
    syncFromWorld,
  }
})
