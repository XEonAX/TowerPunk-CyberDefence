/**
 * ECS World — Tech.md §4.1, §4.4
 *
 * Central store for all game state. All component data is in pre-allocated
 * typed arrays indexed by entity ID. Zero allocations after createWorld().
 */

import { createEntityPool, type EntityPool, type EntityId } from './entity'
import * as C from './component'

/** Rulebook §2.1 */ const GRID_SIZE = 51
/** Maximum simultaneous entities (enemies + towers + pickups + gateways) */
const MAX_ENTITIES = 4096

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export const enum CommandType {
  PLACE_TOWER = 0,
  PLACE_FIREWALL = 1,
  UPGRADE_TOWER = 2,
  ACTIVATE_ABILITY = 3,
  DISMANTLE_TOWER = 4,
  SKIP_BREAK = 5,
  START_WAVE = 6,
}

export interface PlaceTowerCommand {
  type: CommandType.PLACE_TOWER
  towerType: C.TowerType
  x: number
  y: number
  facing?: number
}

export interface PlaceFirewallCommand {
  type: CommandType.PLACE_FIREWALL
  t1: { x: number; y: number }
  gap: { x: number; y: number }
  t2: { x: number; y: number }
}

export interface UpgradeTowerCommand {
  type: CommandType.UPGRADE_TOWER
  eid: EntityId
}

export interface ActivateAbilityCommand {
  type: CommandType.ACTIVATE_ABILITY
  eid: EntityId
}

export interface DismantleTowerCommand {
  type: CommandType.DISMANTLE_TOWER
  eid: EntityId
}

export interface SkipBreakCommand {
  type: CommandType.SKIP_BREAK
}

export interface StartWaveCommand {
  type: CommandType.START_WAVE
}

export type Command =
  | PlaceTowerCommand
  | PlaceFirewallCommand
  | UpgradeTowerCommand
  | ActivateAbilityCommand
  | DismantleTowerCommand
  | SkipBreakCommand
  | StartWaveCommand

// ---------------------------------------------------------------------------
// Game phase enum
// ---------------------------------------------------------------------------

export const enum GamePhase {
  PRE_GAME = 0,
  WAVE_BREAK = 1,
  WAVE_ACTIVE = 2,
  GAME_OVER = 3,
  VICTORY = 4,
}

// ---------------------------------------------------------------------------
// World type
// ---------------------------------------------------------------------------

export interface World {
  // --- Entity management ---
  pool: EntityPool
  /** Component bitmask for each entity. Uint32Array indexed by entity ID. */
  bitmask: Uint32Array

  // --- Position component (§2.1) ---
  posX: Float32Array
  posY: Float32Array

  // --- Health component ---
  healthCurrent: Float32Array
  healthMax: Float32Array

  // --- TilePos component (§2.10.2) ---
  tilePosX: Uint8Array
  tilePosY: Uint8Array

  // --- TileProgress component ---
  tileProgress: Float32Array

  // --- PathState component ---
  pathFromX: Uint8Array
  pathFromY: Uint8Array
  pathToX: Uint8Array
  pathToY: Uint8Array
  pathDir: Uint8Array        // current direction (Dir enum)
  pathPrevDir: Uint8Array    // direction on previous tile (Dir enum)
  pathMoveState: Uint8Array  // MoveState enum
  pathDirChange: Uint8Array  // DirChange enum
  pathProgressFactor: Float32Array

  // --- SpawnImmunity component ---
  spawnImmunityTicks: Uint16Array

  // --- Tower component ---
  towerType: Uint8Array
  towerLevel: Uint8Array
  towerFacing: Uint8Array    // Dir enum

  // --- Targeting component ---
  targetingMode: Uint8Array  // TargetingMode enum
  targetingCooldown: Float32Array
  targetingTarget: Uint32Array  // entity ID of current target (0 = none)

  // --- Rotation component ---
  rotationAngle: Float32Array
  rotationSpeed: Float32Array  // degrees/tick

  // --- Enemy component ---
  enemyType: Uint8Array
  enemyTier: Uint8Array
  enemyDamage: Float32Array
  enemySpeed: Float32Array  // tiles/tick

  // --- Immunity component ---
  immunityFlags: Uint8Array

  // --- Slow component ---
  slowMagnitude: Float32Array   // 0.0–1.0
  slowTicks: Uint32Array        // remaining ticks (0 = no slow)

  // --- Stun component ---
  stunTicks: Uint32Array        // remaining ticks (0 = no stun)

  // --- Pickup component ---
  pickupEddies: Float32Array
  pickupComponents: Float32Array
  pickupDecayPerTick: Float32Array
  pickupInitialValue: Float32Array  // for decay % calculation

  // --- Harvester component ---
  harvesterEddiesPerTick: Float32Array
  harvesterComponentsPerTick: Float32Array

  // --- PingRange component ---
  pingRange: Float32Array  // Chebyshev radius

  // --- Ability component ---
  abilityType: Uint8Array
  abilityLevel: Uint8Array
  abilityCooldown: Float32Array

  // --- FirewallLink component ---
  firewallPartner: Uint32Array  // partner entity ID
  firewallGapX: Uint8Array
  firewallGapY: Uint8Array

  // --- Gateway component ---
  gatewayHp: Float32Array
  gatewayMaxHp: Float32Array
  gatewayIsClosing: Uint8Array  // bool
  gatewayX: Uint8Array
  gatewayY: Uint8Array

  // --- BlackwallTower component ---
  blackwallAssignedGateway: Uint32Array  // gateway entity ID
  blackwallDamagePerTick: Float32Array

  // --- Grid state ---
  /** Blocked tile map (0 = empty, tower type+1 = occupied). GRID_SIZE×GRID_SIZE. */
  gridBlocked: Uint8Array

  // --- Flowfield arrays (Tech.md §5.4) ---
  /** Standard flowfield cost — Uint16Array[GRID_SIZE×GRID_SIZE] */
  flowCost: Uint16Array
  /** Standard flowfield direction — Uint8Array[GRID_SIZE×GRID_SIZE] */
  flowDir: Uint8Array
  /** Glitch flowfield cost — Uint16Array[GRID_SIZE×GRID_SIZE] */
  glitchCost: Uint16Array
  /** Glitch flowfield direction — Uint8Array[GRID_SIZE×GRID_SIZE] */
  glitchDir: Uint8Array
  /** BFS scratch buffer for placement validation (Tech.md §5.5.4) */
  bfsScratch: Uint16Array

  // --- Status effect queue (§1.10.10) ---
  /** Pending slow applications: [eid, magnitude, ticks, ...] triples */
  statusSlowQueue: Float32Array
  statusSlowQueueLen: number
  /** Pending stun applications: [eid, ticks, ...] pairs */
  statusStunQueue: Float32Array
  statusStunQueueLen: number
  /** Pending tower disables: [eid, ticks, ...] pairs */
  statusDisableQueue: Float32Array
  statusDisableQueueLen: number

  // --- Gateway registry ---
  /** List of active gateway entity IDs */
  activeGateways: Uint32Array
  activeGatewayCount: number
  /** Round-robin index for spawning (Tech.md §3.3.1) */
  spawnGatewayIndex: number

  // --- Wave state ---
  currentWave: number
  currentPhase: GamePhase
  tickCount: number
  /** Enemies remaining to spawn this wave */
  waveEnemiesRemaining: number
  /** Enemies alive on map */
  enemiesAlive: number
  /** Ticks until break ends (wave auto-start) */
  breakTicksRemaining: number
  /** Skip break bonus remaining ticks (§8.3) */
  skipBonusTicks: number

  // --- Wave spawn scheduling (set by eventSystem, consumed by spawnSystem) ---
  /** Ordered list of EnemyType values for the current wave */
  waveEnemyList: number[]
  /** Index of the next enemy to spawn from waveEnemyList */
  waveSpawnIndex: number
  /** tickCount value at which the next spawn should fire */
  nextSpawnTick: number

  // --- Resources ---
  /** Rulebook §4.1, §4.3.1 */
  eddies: number
  /** Rulebook §4.2, §4.3.1 */
  components: number

  // --- Command queue ---
  commandQueue: Command[]

  // --- Core entity ID ---
  coreEid: EntityId

  // --- RNG state (xorshift128) ---
  rngState: Uint32Array  // 4 × uint32

  // --- Removal queue ---
  removalQueue: Uint32Array
  removalQueueLen: number
}

// ---------------------------------------------------------------------------
// createWorld
// ---------------------------------------------------------------------------

/**
 * Allocate the entire game world. All typed arrays are pre-allocated.
 * No allocations during gameplay after this call.
 */
export function createWorld(seed: number = 12345): World {
  const N = MAX_ENTITIES
  const G = GRID_SIZE * GRID_SIZE

  const world: World = {
    pool: createEntityPool(N),
    bitmask: new Uint32Array(N),

    posX: new Float32Array(N),
    posY: new Float32Array(N),

    healthCurrent: new Float32Array(N),
    healthMax: new Float32Array(N),

    tilePosX: new Uint8Array(N),
    tilePosY: new Uint8Array(N),
    tileProgress: new Float32Array(N),

    pathFromX: new Uint8Array(N),
    pathFromY: new Uint8Array(N),
    pathToX: new Uint8Array(N),
    pathToY: new Uint8Array(N),
    pathDir: new Uint8Array(N),
    pathPrevDir: new Uint8Array(N),
    pathMoveState: new Uint8Array(N),
    pathDirChange: new Uint8Array(N),
    pathProgressFactor: new Float32Array(N),

    spawnImmunityTicks: new Uint16Array(N),

    towerType: new Uint8Array(N),
    towerLevel: new Uint8Array(N),
    towerFacing: new Uint8Array(N),

    targetingMode: new Uint8Array(N),
    targetingCooldown: new Float32Array(N),
    targetingTarget: new Uint32Array(N),

    rotationAngle: new Float32Array(N),
    rotationSpeed: new Float32Array(N),

    enemyType: new Uint8Array(N),
    enemyTier: new Uint8Array(N),
    enemyDamage: new Float32Array(N),
    enemySpeed: new Float32Array(N),

    immunityFlags: new Uint8Array(N),

    slowMagnitude: new Float32Array(N),
    slowTicks: new Uint32Array(N),

    stunTicks: new Uint32Array(N),

    pickupEddies: new Float32Array(N),
    pickupComponents: new Float32Array(N),
    pickupDecayPerTick: new Float32Array(N),
    pickupInitialValue: new Float32Array(N),

    harvesterEddiesPerTick: new Float32Array(N),
    harvesterComponentsPerTick: new Float32Array(N),

    pingRange: new Float32Array(N),

    abilityType: new Uint8Array(N),
    abilityLevel: new Uint8Array(N),
    abilityCooldown: new Float32Array(N),

    firewallPartner: new Uint32Array(N),
    firewallGapX: new Uint8Array(N),
    firewallGapY: new Uint8Array(N),

    gatewayHp: new Float32Array(N),
    gatewayMaxHp: new Float32Array(N),
    gatewayIsClosing: new Uint8Array(N),
    gatewayX: new Uint8Array(N),
    gatewayY: new Uint8Array(N),

    blackwallAssignedGateway: new Uint32Array(N),
    blackwallDamagePerTick: new Float32Array(N),

    gridBlocked: new Uint8Array(G),

    flowCost: new Uint16Array(G),
    flowDir: new Uint8Array(G),
    glitchCost: new Uint16Array(G),
    glitchDir: new Uint8Array(G),
    bfsScratch: new Uint16Array(G),

    statusSlowQueue: new Float32Array(N * 3),
    statusSlowQueueLen: 0,
    statusStunQueue: new Float32Array(N * 2),
    statusStunQueueLen: 0,
    statusDisableQueue: new Float32Array(N * 2),
    statusDisableQueueLen: 0,

    activeGateways: new Uint32Array(256),
    activeGatewayCount: 0,
    spawnGatewayIndex: 0,

    currentWave: 0,
    currentPhase: GamePhase.PRE_GAME,
    tickCount: 0,
    waveEnemiesRemaining: 0,
    enemiesAlive: 0,
    breakTicksRemaining: 0,
    skipBonusTicks: 0,

    waveEnemyList: [],
    waveSpawnIndex: 0,
    nextSpawnTick: 0,

    eddies: 400,    // Rulebook §4.3.1
    components: 3,  // Rulebook §4.3.1

    commandQueue: [],

    coreEid: 0,

    rngState: new Uint32Array([seed >>> 0, seed ^ 0xdeadbeef, seed ^ 0xcafebabe, seed ^ 0x12345678]),

    removalQueue: new Uint32Array(N),
    removalQueueLen: 0,
  }

  // Initialize flowfield as unreachable
  world.flowCost.fill(0xffff)
  world.glitchCost.fill(0xffff)

  // Create the Core entity (Rulebook §2.3, §3.3)
  const coreEid = world.pool.create()
  world.bitmask[coreEid] = C.POSITION | C.HEALTH
  world.posX[coreEid] = 25  // 0-indexed center of 51×51 grid (Rulebook §2.9)
  world.posY[coreEid] = 25
  world.healthCurrent[coreEid] = 100  // Rulebook §3.3
  world.healthMax[coreEid] = 100
  world.coreEid = coreEid

  return world
}

// ---------------------------------------------------------------------------
// Entity creation helpers
// ---------------------------------------------------------------------------

/**
 * Mark entity for deferred removal (cleaned up in cleanupSystem §1.10.12).
 */
export function markForRemoval(world: World, eid: EntityId): void {
  if (world.removalQueueLen < world.removalQueue.length) {
    world.removalQueue[world.removalQueueLen++] = eid
    world.bitmask[eid] |= C.PENDING_REMOVAL
  }
}

/**
 * Create an enemy entity with given type and return its ID.
 * Caller must set TilePos, TileProgress, PathState, SpawnImmunity, and stats.
 */
export function createEnemy(world: World): EntityId {
  const eid = world.pool.create()
  world.bitmask[eid] =
    C.TILE_POS |
    C.TILE_PROGRESS |
    C.PATH_STATE |
    C.SPAWN_IMMUNITY |
    C.HEALTH |
    C.ENEMY |
    C.IMMUNITY |
    C.SLOW |
    C.STUN
  return eid
}

/**
 * Create a tower entity. Caller must set Position, Tower, and type-specific components.
 */
export function createTower(
  world: World,
  extraFlags: number = 0,
): EntityId {
  const eid = world.pool.create()
  world.bitmask[eid] = C.POSITION | C.HEALTH | C.TOWER | extraFlags
  return eid
}

/**
 * Create a pickup entity. Caller must set Position and Pickup fields.
 */
export function createPickup(world: World): EntityId {
  const eid = world.pool.create()
  world.bitmask[eid] = C.POSITION | C.PICKUP
  return eid
}

/**
 * Create a gateway entity. Caller must set Position and Gateway fields.
 */
export function createGateway(world: World): EntityId {
  const eid = world.pool.create()
  world.bitmask[eid] = C.POSITION | C.GATEWAY
  return eid
}
