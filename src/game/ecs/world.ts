/**
 * ECS World — Tech.md §4.1, §4.4
 *
 * Central store for all game state. All component data is in pre-allocated
 * typed arrays indexed by entity ID. Zero allocations after createWorld().
 */

import { createEntityPool, type EntityPool, type EntityId } from './entity'
import * as C from './component'
import { GATEWAY_HP, INITIAL_COMPONENTS, INITIAL_EDDIES } from '../constants'

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
  /** §6.0.2 — Spend Components to upgrade an unlocked ability by one level. */
  UPGRADE_ABILITY = 7,
  /** §4.2.9 — Convert 100 Eddies into 1 Component. */
  CONVERT_EDDIES = 8,
}

export interface PlaceTowerCommand {
  type: CommandType.PLACE_TOWER
  towerType: C.TowerType
  x: number
  y: number
  facing?: number
  /** Target level to place at (1–10). Tower is placed at L1 then upgraded to this level. Rulebook §5.0.4 */
  level?: number
}

export interface PlaceFirewallCommand {
  type: CommandType.PLACE_FIREWALL
  t1: { x: number; y: number }
  gap: { x: number; y: number }
  t2: { x: number; y: number }
  /** Target level to place at (1–10). Rulebook §5.0.4 */
  level?: number
}

export interface UpgradeTowerCommand {
  type: CommandType.UPGRADE_TOWER
  eid: EntityId
}

export interface ActivateAbilityCommand {
  type: CommandType.ACTIVATE_ABILITY
  eid: EntityId
  /** Optional enemy type to tune against — used by TUNED ability switch (§6.3.2) */
  targetType?: number
}

export interface UpgradeAbilityCommand {
  type: CommandType.UPGRADE_ABILITY
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

/** §4.2.9 — Convert 100 Eddies into 1 Component. */
export interface ConvertEddiesCommand {
  type: CommandType.CONVERT_EDDIES
}

export type Command =
  | PlaceTowerCommand
  | PlaceFirewallCommand
  | UpgradeTowerCommand
  | ActivateAbilityCommand
  | DismantleTowerCommand
  | SkipBreakCommand
  | StartWaveCommand
  | UpgradeAbilityCommand
  | ConvertEddiesCommand

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

  // --- Tower disable (§7.7 Saboteur) ---
  /** Remaining disable ticks per entity. 0 = not disabled. */
  towerDisableTicks: Uint32Array

  // --- Saboteur pulse state (§7.7.1) ---
  /** Tick when each Saboteur last fired its disable pulse (0 = never pulsed). */
  saboteurPulseTick: Uint32Array

  // --- AI Overlord phase state (§7.8) ---
  /** Current boss phase (1, 2, or 3). 0 for non-AI Overlord entities. */
  aiOverlordPhase: Uint8Array
  /** World tick when the current phase started. */
  aiOverlordPhaseStartTick: Uint32Array
  /** Total tiles walked since creation (used for every-5-tile spawning). */
  aiOverlordTilesTraveled: Uint32Array
  /** Damage taken multiplier — 1.0 for phases 1 and 2, 1.5 for phase 3 (§7.8.5). */
  aiOverlordDamageMult: Float32Array

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

  // --- Overclock state (§6.2) ---
  /** 1 = overclock currently active, 0 = inactive */
  overclockActive: Uint8Array
  /** Remaining overclock ticks (countdown to 0) */
  overclockTicks: Uint32Array
  /** Current fire-rate / generation multiplier while overclocked */
  overclockMultiplier: Float32Array

  // --- Tuned state (§6.3) ---
  /** EnemyType that receives the bonus damage (set via ACTIVATE_ABILITY command) */
  tunedTargetType: Uint8Array
  /** Bonus DPS applied to enemies matching tunedTargetType */
  tunedDamageBonus: Float32Array

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
  /** Tower type per tile (0 = empty). Used by flowfield for Glitch passability. */
  gridTowerType: Uint8Array

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
  /** Total gateways ever registered in this game (never decremented). Used for win condition. */
  totalGatewaysCreated: number
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

    towerDisableTicks: new Uint32Array(N),

    saboteurPulseTick: new Uint32Array(N),

    aiOverlordPhase: new Uint8Array(N),
    aiOverlordPhaseStartTick: new Uint32Array(N),
    aiOverlordTilesTraveled: new Uint32Array(N),
    aiOverlordDamageMult: new Float32Array(N),

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

    overclockActive: new Uint8Array(N),
    overclockTicks: new Uint32Array(N),
    overclockMultiplier: new Float32Array(N),

    tunedTargetType: new Uint8Array(N),
    tunedDamageBonus: new Float32Array(N),

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
    gridTowerType: new Uint8Array(G),

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
    totalGatewaysCreated: 0,
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

    eddies: INITIAL_EDDIES,    // Rulebook §4.3.1
    components: INITIAL_COMPONENTS,  // Rulebook §4.3.1

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
 * Return the entity ID of the tower occupying the given tile, or null if empty.
 */
export function towerAtTile(world: World, tileX: number, tileY: number): EntityId | null {
  const N = world.bitmask.length
  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.TOWER)) continue
    if (mask & C.PENDING_REMOVAL) continue
    if ((world.posX[eid] | 0) === tileX && (world.posY[eid] | 0) === tileY) return eid
  }
  return null
}

/**
 * Return the entity ID of the enemy currently on (or closest to) the given tile, or null.
 * Matches enemies whose discrete tilePos equals the clicked tile.
 */
export function enemyAtTile(world: World, tileX: number, tileY: number): EntityId | null {
  const N = world.bitmask.length
  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY)) continue
    if (mask & C.PENDING_REMOVAL) continue
    if (world.tilePosX[eid] === tileX && world.tilePosY[eid] === tileY) return eid
  }
  return null
}

/**
 * Return the entity ID of the gateway occupying the given tile, or null.
 */
export function gatewayAtTile(world: World, tileX: number, tileY: number): EntityId | null {
  const N = world.bitmask.length
  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.GATEWAY)) continue
    if (mask & C.PENDING_REMOVAL) continue
    if (world.gatewayX[eid] === tileX && world.gatewayY[eid] === tileY) return eid
  }
  return null
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

/**
 * Create and register a Gateway entity at the given tile.
 * Used by Orchestrator death (§7.5.1) and AI Overlord movement (§7.8.2).
 */
export function spawnInteriorGateway(world: World, x: number, y: number): void {
  // Don't spawn on a tile already occupied by a tower
  if (world.gridBlocked[y * GRID_SIZE + x] !== 0) return

  // Don't spawn on a tile that already has a gateway
  for (let i = 0; i < world.activeGatewayCount; i++) {
    const existing = world.activeGateways[i]
    if (world.gatewayX[existing] === x && world.gatewayY[existing] === y) return
  }

  const gwEid = createGateway(world)
  world.gatewayX[gwEid] = x
  world.gatewayY[gwEid] = y
  world.posX[gwEid] = x
  world.posY[gwEid] = y
  world.gatewayHp[gwEid] = GATEWAY_HP
  world.gatewayMaxHp[gwEid] = GATEWAY_HP
  world.gatewayIsClosing[gwEid] = 0
  if (world.activeGatewayCount < world.activeGateways.length) {
    world.activeGateways[world.activeGatewayCount++] = gwEid
  }
  world.totalGatewaysCreated++

  // §5.6.1 — assign any adjacent Blackwall Tower that doesn't yet have a gateway
  const N = world.bitmask.length
  for (let eid = 1; eid < N; eid++) {
    const m = world.bitmask[eid]
    if ((m & C.BLACKWALL_TOWER) === 0) continue
    if ((m & C.PENDING_REMOVAL) !== 0) continue
    if (world.blackwallAssignedGateway[eid] !== 0) continue
    const dx = Math.abs(world.posX[eid] - x)
    const dy = Math.abs(world.posY[eid] - y)
    if (Math.max(dx, dy) <= 1) {
      world.blackwallAssignedGateway[eid] = gwEid
    }
  }
}
