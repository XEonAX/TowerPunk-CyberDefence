/**
 * Event System — §1.10.1
 *
 * Processes scheduled events: phase transitions and wave scheduling.
 *
 * Responsibilities:
 *  - WAVE_BREAK: count down breakTicksRemaining; start next wave when it
 *    reaches 0 (auto-start for waves > 10, §8.2.2).
 *  - WAVE_ACTIVE: detect when all enemies have been spawned and none remain
 *    alive, then transition back to WAVE_BREAK (or VICTORY §10.1).
 *  - PRE_GAME / GAME_OVER / VICTORY: no-op.
 */

import { GamePhase, spawnInteriorGateway, type World } from '../ecs/world'
import * as C from '../ecs/component'
import { getWaveData, SPAWN_INTERVAL_TICKS } from '../wave'
import { breakDuration, GRID_SIZE, AI_OVERLORD_PHASE_DURATION_TICKS } from '../constants'
import { rngRange } from '../rng'

export function eventSystem(world: World): void {
  // §10.2: Lose condition — Core HP reaches 0
  if (
    world.healthCurrent[world.coreEid] <= 0 &&
    world.currentPhase !== GamePhase.GAME_OVER &&
    world.currentPhase !== GamePhase.VICTORY
  ) {
    world.currentPhase = GamePhase.GAME_OVER
    return
  }

  // §7.8.7/7.8.8: AI Overlord phase transitions (every 1800 ticks)
  checkAiOverlordPhases(world)

  switch (world.currentPhase) {
    case GamePhase.WAVE_BREAK:
      handleWaveBreak(world)
      break
    case GamePhase.WAVE_ACTIVE:
      handleWaveActive(world)
      break
    default:
      // PRE_GAME, GAME_OVER, VICTORY — nothing to do
      break
  }

  // §8.3.1 — Decrement skip-break bonus countdown each tick
  if (world.skipBonusTicks > 0) {
    world.skipBonusTicks--
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** §8.2.1–8.2.2: Decrement break countdown; trigger auto-start when it hits 0. */
function handleWaveBreak(world: World): void {
  // §10.1: Win condition — all gateways closed and no bosses alive.
  // Only checked once at least one gateway has been created and destroyed (§8.5.1).
  if (world.totalGatewaysCreated > 0 && world.activeGatewayCount === 0) {
    let bossAlive = false
    const N = world.bitmask.length
    for (let eid = 1; eid < N; eid++) {
      const mask = world.bitmask[eid]
      if ((mask & C.ENEMY) === 0) continue
      if ((mask & C.PENDING_REMOVAL) !== 0) continue
      const type = world.enemyType[eid]
      if (type === C.EnemyType.ORCHESTRATOR || type === C.EnemyType.AI_OVERLORD) {
        bossAlive = true
        break
      }
    }
    if (!bossAlive) {
      world.currentPhase = GamePhase.VICTORY
      return
    }
  }

  if (world.breakTicksRemaining > 0) {
    world.breakTicksRemaining--
    return
  }

  // breakTicksRemaining === 0 → auto-start next wave
  startNextWave(world)
}

/** §1.10.1: Check wave completion; end wave when all enemies spawned and dead. */
function handleWaveActive(world: World): void {
  const allSpawned = world.waveSpawnIndex >= world.waveEnemyList.length
  if (allSpawned && world.enemiesAlive === 0) {
    endWave(world)
  }
}

/**
 * Transition into WAVE_ACTIVE for the next wave.
 * Sets up the enemy list and spawn schedule consumed by spawnSystem (§1.10.2).
 */
function startNextWave(world: World): void {
  const wave = world.currentWave + 1
  world.currentWave = wave

  // §8.5.1: Blackwall degrades every 5 waves starting from wave 1 (wave 1, 5, 10, 15, ...)
  if (wave === 1 || wave % 5 === 0) {
    createBoundaryGateway(world)
  }

  const waveData = getWaveData(wave)
  world.waveEnemyList = waveData.enemies.slice()
  world.waveSpawnIndex = 0
  world.waveEnemiesRemaining = waveData.enemies.length
  // First spawn fires after one interval from wave start
  world.nextSpawnTick = world.tickCount + SPAWN_INTERVAL_TICKS

  world.currentPhase = GamePhase.WAVE_ACTIVE
}

/**
 * Transition out of WAVE_ACTIVE at the end of a completed wave.
 * §8.2.3: break duration scales with wave number.
 */
function endWave(world: World): void {
  const breakTicks = breakDuration(world.currentWave)
  world.breakTicksRemaining = isFinite(breakTicks) ? breakTicks : Infinity
  world.currentPhase = GamePhase.WAVE_BREAK
}

// ---------------------------------------------------------------------------
// AI Overlord phase transitions
// ---------------------------------------------------------------------------

/**
 * Check all AI Overlord entities and advance phases on timer (§7.8.7–8).
 */
function checkAiOverlordPhases(world: World): void {
  const N = world.bitmask.length
  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if ((mask & C.ENEMY) === 0) continue
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    if (world.enemyType[eid] !== C.EnemyType.AI_OVERLORD) continue

    const elapsed = world.tickCount - world.aiOverlordPhaseStartTick[eid]
    if (world.aiOverlordPhase[eid] === 1 && elapsed >= AI_OVERLORD_PHASE_DURATION_TICKS) {
      world.aiOverlordPhase[eid]          = 2  // §7.8.3: becomes vulnerable
      world.aiOverlordPhaseStartTick[eid] = world.tickCount
    } else if (world.aiOverlordPhase[eid] === 2 && elapsed >= AI_OVERLORD_PHASE_DURATION_TICKS) {
      world.aiOverlordPhase[eid]          = 3  // §7.8.5: 50% extra damage taken
      world.aiOverlordPhaseStartTick[eid] = world.tickCount
      world.aiOverlordDamageMult[eid]     = 1.5
    }
  }
}

// ---------------------------------------------------------------------------
// Boundary gateway creation
// ---------------------------------------------------------------------------

/**
 * Create a Gateway on a random edge tile using seeded RNG (§8.5.1, §9.2.2).
 */
function createBoundaryGateway(world: World): void {
  const LAST = GRID_SIZE - 1  // 50
  const edge = rngRange(world, 0, 4)  // 0=N, 1=S, 2=E, 3=W
  let gx: number
  let gy: number
  switch (edge) {
    case 0:  // North (y=0)
      gx = rngRange(world, 0, GRID_SIZE)
      gy = 0
      break
    case 1:  // South (y=50)
      gx = rngRange(world, 0, GRID_SIZE)
      gy = LAST
      break
    case 2:  // East (x=50)
      gx = LAST
      gy = rngRange(world, 0, GRID_SIZE)
      break
    default: // West (x=0)
      gx = 0
      gy = rngRange(world, 0, GRID_SIZE)
      break
  }
  spawnInteriorGateway(world, gx, gy)
}
