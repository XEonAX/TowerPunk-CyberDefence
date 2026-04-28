/**
 * Spawn System — §1.10.2
 *
 * Spawns enemies from active Blackwall Gateways during WAVE_ACTIVE phase.
 *
 * Rulebook §2.10.1: At spawn, enemy receives 30-tick immunity window.
 * Rulebook §7.0.6: Gateways are iterated in round-robin order.
 * Rulebook §8.4: Enemy stats scale with wave number.
 */

import { GamePhase, createEnemy, type World } from '../ecs/world'
import * as C from '../ecs/component'
import { SPAWN_INTERVAL_TICKS } from '../wave'
import { DIR_DX, DIR_DY } from './movement.system'
import {
  SPAWN_IMMUNITY_TICKS,
  waveScaling,
  ENEMY_DATA_LEECH,
  ENEMY_CODE_RUNNER,
  ENEMY_FIREWALL_BREACHER,
  ENEMY_GLITCH,
  ENEMY_ORCHESTRATOR,
  ENEMY_VDB_NETRUNNER,
  ENEMY_SABOTEUR,
  ENEMY_AI_OVERLORD,
} from '../constants'
import { idx } from '../pathfinding/grid'
import { AudioEventType, AUDIO_EVENT_CAPACITY } from '../../audio/audioEvents'

// Immunity flag bitmasks per enemy type (§7.1.3, §7.1.4, §7.3, §7.4, §7.5)
const IMMUNITY_FLAGS: readonly number[] = [
  C.IMMUNE_STUN | C.IMMUNE_SLOW,                              // DATA_LEECH (§7.1.3, §7.1.4)
  0,                                                          // CODE_RUNNER
  C.IMMUNE_ICE_SLOW | C.IMMUNE_FIREWALL_STUN,                 // FIREWALL_BREACHER (§7.3)
  C.IMMUNE_ICE_SLOW | C.IMMUNE_FIREWALL_STUN | C.IMMUNE_FIREWALL_DMG, // GLITCH (§7.4.1)
  C.IMMUNE_ICE_DOT  | C.IMMUNE_FIREWALL_DMG,                 // ORCHESTRATOR (§7.5.2)
  0,                                                          // VDB_NETRUNNER
  0,                                                          // SABOTEUR
  0,                                                          // AI_OVERLORD
]

// Base stats per enemy type — Rulebook §7
interface BaseStats {
  readonly damage: number
  readonly health: number
  readonly speedPerSec: number
  readonly tierMultiplier: number
}

const BASE_STATS: readonly BaseStats[] = [
  ENEMY_DATA_LEECH,        // DATA_LEECH = 0
  ENEMY_CODE_RUNNER,       // CODE_RUNNER = 1
  ENEMY_FIREWALL_BREACHER, // FIREWALL_BREACHER = 2
  ENEMY_GLITCH,            // GLITCH = 3
  ENEMY_ORCHESTRATOR,      // ORCHESTRATOR = 4
  ENEMY_VDB_NETRUNNER,     // VDB_NETRUNNER = 5
  ENEMY_SABOTEUR,          // SABOTEUR = 6
  ENEMY_AI_OVERLORD,       // AI_OVERLORD = 7
]

export function spawnSystem(world: World): void {
  // §1.10.2: Only active during WAVE_ACTIVE phase
  if (world.currentPhase !== GamePhase.WAVE_ACTIVE) return

  // No enemies left to spawn this wave
  if (world.waveSpawnIndex >= world.waveEnemyList.length) return

  // Not yet time to spawn
  if (world.tickCount < world.nextSpawnTick) return

  // No active gateways to spawn from — fast-forward spawn index so the wave
  // completion check in eventSystem can detect allSpawned && enemiesAlive === 0
  // and end the wave (avoids the game locking up with no gateways remaining).
  if (world.activeGatewayCount === 0) {
    world.waveSpawnIndex = world.waveEnemyList.length
    return
  }

  // Spawn one enemy, catching up if multiple intervals have elapsed
  while (
    world.waveSpawnIndex < world.waveEnemyList.length &&
    world.tickCount >= world.nextSpawnTick
  ) {
    spawnOneEnemy(world)
    world.nextSpawnTick += SPAWN_INTERVAL_TICKS
  }
}

/**
 * Spawn an enemy of the given type at a specific tile using current-wave stat scaling.
 * Used for AI Overlord walk-spawns (§7.8.2, §7.8.4, §7.8.6).
 */
export function spawnEnemyAtTile(
  world: World,
  enemyType: number,
  x: number,
  y: number,
): void {
  const base = BASE_STATS[enemyType]
  if (base === undefined) return

  const wave         = world.currentWave
  const scaledDamage = waveScaling(base.damage, wave)
  const scaledHealth = waveScaling(base.health, wave)
  const scaledSpeed  = waveScaling(base.speedPerSec, wave)

  const eid = createEnemy(world)

  world.tilePosX[eid]     = x
  world.tilePosY[eid]     = y
  world.tileProgress[eid] = 0

  world.spawnImmunityTicks[eid] = SPAWN_IMMUNITY_TICKS

  const tileIndex = idx(x, y)
  const dir = enemyType === C.EnemyType.GLITCH
    ? world.glitchDir[tileIndex]
    : world.flowDir[tileIndex]
  world.pathDir[eid]     = dir
  world.pathPrevDir[eid] = dir
  world.pathFromX[eid]   = x
  world.pathFromY[eid]   = y
  // toX/Y = first tile the enemy will enter (one step ahead from spawn)
  world.pathToX[eid]     = dir !== 0xff ? x + DIR_DX[dir] : x
  world.pathToY[eid]     = dir !== 0xff ? y + DIR_DY[dir] : y
  world.pathMoveState[eid] = C.MoveState.INTRO

  world.enemyType[eid]   = enemyType
  world.enemyTier[eid]   = base.tierMultiplier
  world.enemyDamage[eid] = scaledDamage
  world.enemySpeed[eid]  = scaledSpeed

  world.healthMax[eid]     = scaledHealth
  world.healthCurrent[eid] = scaledHealth

  world.immunityFlags[eid] = IMMUNITY_FLAGS[enemyType] ?? 0

  world.slowMagnitude[eid] = 0
  world.slowTicks[eid]     = 0
  world.stunTicks[eid]     = 0

  world.enemiesAlive++

  // Audio: emit ENEMY_SPAWNED event
  if (world.audioEventCount < AUDIO_EVENT_CAPACITY) {
    world.audioEventTypeBuf[world.audioEventCount] = AudioEventType.ENEMY_SPAWNED
    world.audioEventDataBuf[world.audioEventCount] = enemyType
    world.audioEventCount++
  }
}

function spawnOneEnemy(world: World): void {
  const enemyType = world.waveEnemyList[world.waveSpawnIndex]
  world.waveSpawnIndex++

  // Round-robin gateway selection (§7.0.6, §9.2.5)
  const gatewayEid = world.activeGateways[world.spawnGatewayIndex % world.activeGatewayCount]
  world.spawnGatewayIndex = (world.spawnGatewayIndex + 1) % world.activeGatewayCount

  // Skip gateways that are actively being closed (§9.2.6)
  if (world.gatewayIsClosing[gatewayEid]) return

  const gx = world.gatewayX[gatewayEid]
  const gy = world.gatewayY[gatewayEid]

  // Wave stat scaling (§8.4.1)
  const wave = world.currentWave
  const base = BASE_STATS[enemyType]
  if (base === undefined) return

  const scaledDamage  = waveScaling(base.damage, wave)
  const scaledHealth  = waveScaling(base.health, wave)
  const scaledSpeed   = waveScaling(base.speedPerSec, wave)

  // Create entity
  const eid = createEnemy(world)

  // TilePos — place at gateway tile (§2.10.1)
  world.tilePosX[eid]    = gx
  world.tilePosY[eid]    = gy
  world.tileProgress[eid] = 0

  // SpawnImmunity — 30 ticks (§2.10.1)
  world.spawnImmunityTicks[eid] = SPAWN_IMMUNITY_TICKS

  // PathState — initialise from flowfield at gateway tile
  const tileIndex = idx(gx, gy)
  // Glitch uses glitch flowfield; others use standard (§7.4.1)
  const dir = enemyType === 3 /* EnemyType.GLITCH */
    ? world.glitchDir[tileIndex]
    : world.flowDir[tileIndex]
  world.pathDir[eid]      = dir
  world.pathPrevDir[eid]  = dir
  world.pathFromX[eid]    = gx
  world.pathFromY[eid]    = gy
  // toX/Y = first tile the enemy will enter (one step ahead from gateway)
  world.pathToX[eid]      = dir !== 0xff ? gx + DIR_DX[dir] : gx
  world.pathToY[eid]      = dir !== 0xff ? gy + DIR_DY[dir] : gy
  world.pathMoveState[eid] = C.MoveState.INTRO

  // Enemy component data
  world.enemyType[eid]   = enemyType
  world.enemyTier[eid]   = base.tierMultiplier
  world.enemyDamage[eid] = scaledDamage
  world.enemySpeed[eid]  = scaledSpeed  // tiles/sec; movement system divides by TICK_RATE

  // Health
  world.healthMax[eid]     = scaledHealth
  world.healthCurrent[eid] = scaledHealth

  // Immunity flags (§7.1–7.8)
  world.immunityFlags[eid] = IMMUNITY_FLAGS[enemyType] ?? 0

  // Status effect initial state
  world.slowMagnitude[eid] = 0
  world.slowTicks[eid]     = 0
  world.stunTicks[eid]     = 0

  // AI Overlord phase initialization (§7.8)
  if (enemyType === C.EnemyType.AI_OVERLORD) {
    world.aiOverlordPhase[eid]          = 1
    world.aiOverlordPhaseStartTick[eid] = world.tickCount
    world.aiOverlordTilesTraveled[eid]  = 0
    world.aiOverlordDamageMult[eid]     = 1.0
  }

  world.enemiesAlive++

  // Audio: emit ENEMY_SPAWNED event
  if (world.audioEventCount < AUDIO_EVENT_CAPACITY) {
    world.audioEventTypeBuf[world.audioEventCount] = AudioEventType.ENEMY_SPAWNED
    world.audioEventDataBuf[world.audioEventCount] = enemyType
    world.audioEventCount++
  }
}
