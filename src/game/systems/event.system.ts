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

import { GamePhase, type World } from '../ecs/world'
import { getWaveData, SPAWN_INTERVAL_TICKS } from '../wave'
import { breakDuration } from '../constants'

export function eventSystem(world: World): void {
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
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** §8.2.1–8.2.2: Decrement break countdown; trigger auto-start when it hits 0. */
function handleWaveBreak(world: World): void {
  // Infinity means manual-start only (waves 1–10 that haven't been triggered)
  if (!isFinite(world.breakTicksRemaining)) return

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
