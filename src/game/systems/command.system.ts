/**
 * Command System — Pre-§1.10
 *
 * Drains world.commandQueue and executes each player command in FIFO order.
 * All game-state mutations from player actions happen here — never directly
 * from the UI layer (Tech.md §3 three-layer separation).
 *
 * Supported commands:
 *   PLACE_TOWER     §5      place a new tower on the grid
 *   PLACE_FIREWALL  §5.2    place a linked firewall pair
 *   UPGRADE_TOWER   §5.0.5  upgrade an existing tower by one level
 *   DISMANTLE_TOWER §4.2.6  remove a tower, optional component refund
 *   SKIP_BREAK      §8.3    skip the remaining break time for a bonus
 *   START_WAVE      §8.2.1  start the first wave from PRE_GAME phase
 */
import type { World } from '../ecs/world'
import {
  CommandType,
  GamePhase,
  createTower,
  createPickup,
  markForRemoval,
  type PlaceTowerCommand,
  type PlaceFirewallCommand,
  type UpgradeTowerCommand,
  type DismantleTowerCommand,
} from '../ecs/world'
import * as C from '../ecs/component'
import type { ReadonlyGrid } from '../pathfinding/grid'
import { isEdgeTile, idx } from '../pathfinding/grid'
import { canPlaceTower, canPlaceFirewallPair } from '../pathfinding/placement'
import { computeDualFlowfields } from '../pathfinding/flowfield'
import {
  MAX_TOWER_LEVEL,
  SKIP_BONUS_TICKS,
  ICE_WALL_COST,
  ICE_WALL_HP,
  FIREWALL_COST,
  FIREWALL_HP,
  DATA_SPIKE_COST,
  DATA_SPIKE_HP,
  DATA_SPIKE_COOLDOWN_TICKS,
  DAEMON_TURRET_COST,
  DAEMON_TURRET_HP,
  DAEMON_TURRET_COOLDOWN,
  DAEMON_TURRET_ROT_SPEED,
  ICE_SNIPER_COST,
  ICE_SNIPER_HP,
  ICE_SNIPER_COOLDOWN,
  ICE_SNIPER_ROT_SPEED,
  BLACKWALL_TOWER_COST,
  BLACKWALL_TOWER_HP,
  BLACKWALL_TOWER_DPT,
  PING_TOWER_COST,
  PING_TOWER_HP,
  PING_TOWER_RANGE,
  HARVESTER_COST,
  HARVESTER_HP,
  HARVESTER_EDDIES_PER_TICK,
  HARVESTER_COMPONENTS_PER_TICK,
} from '../constants'

// ---------------------------------------------------------------------------
// Lookup tables indexed by TowerType enum value
// ---------------------------------------------------------------------------

/** HP table per level, indexed by TowerType value (0–7). Rulebook §5. */
const TOWER_HP_TABLES: ReadonlyArray<ReadonlyArray<number>> = [
  ICE_WALL_HP,        // 0 = ICE_WALL
  FIREWALL_HP,        // 1 = FIREWALL
  DATA_SPIKE_HP,      // 2 = DATA_SPIKE
  DAEMON_TURRET_HP,   // 3 = DAEMON_TURRET
  ICE_SNIPER_HP,      // 4 = ICE_SNIPER
  BLACKWALL_TOWER_HP, // 5 = BLACKWALL
  PING_TOWER_HP,      // 6 = PING
  HARVESTER_HP,       // 7 = HARVESTER
]

/** Cost table [eddies, components] per level, indexed by TowerType value. Rulebook §5. */
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

// ---------------------------------------------------------------------------
// System entry point
// ---------------------------------------------------------------------------

/** Pre-§1.10 — Process all queued player commands. */
export function commandSystem(world: World): void {
  // Process in FIFO order (shift = oldest first)
  while (world.commandQueue.length > 0) {
    const cmd = world.commandQueue.shift()!
    switch (cmd.type) {
      case CommandType.PLACE_TOWER:
        _handlePlaceTower(world, cmd)
        break
      case CommandType.PLACE_FIREWALL:
        _handlePlaceFirewall(world, cmd)
        break
      case CommandType.UPGRADE_TOWER:
        _handleUpgradeTower(world, cmd)
        break
      case CommandType.DISMANTLE_TOWER:
        _handleDismantleTower(world, cmd)
        break
      case CommandType.SKIP_BREAK:
        _handleSkipBreak(world)
        break
      case CommandType.START_WAVE:
        _handleStartWave(world)
        break
      case CommandType.ACTIVATE_ABILITY:
        // TODO: Phase 9
        break
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a ReadonlyGrid view from the world's grid arrays. Zero-allocation. */
function _worldGrid(world: World): ReadonlyGrid {
  return { blocked: world.gridBlocked, towerType: world.gridTowerType }
}

/** Collect active gateway tile positions for pathfinding validation. */
function _gatewayTiles(
  world: World,
): ReadonlyArray<readonly [number, number]> {
  const tiles: Array<readonly [number, number]> = []
  for (let i = 0; i < world.activeGatewayCount; i++) {
    const gwEid = world.activeGateways[i]
    tiles.push([world.gatewayX[gwEid], world.gatewayY[gwEid]])
  }
  return tiles
}

/** Check Chebyshev distance between two tile positions (§2.8). */
function _chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

/** Return true if (x, y) is within any active, non-disabled Ping Tower range. */
function _isInPingRange(world: World, x: number, y: number): boolean {
  const N = world.bitmask.length
  for (let eid = 1; eid < N; eid++) {
    const m = world.bitmask[eid]
    if ((m & C.PING_RANGE) === 0) continue
    if ((m & C.PENDING_REMOVAL) !== 0) continue
    if ((m & C.TOWER_DISABLED) !== 0) continue
    if (_chebyshev(x, y, world.posX[eid], world.posY[eid]) <= world.pingRange[eid]) {
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

/** §5 — Place a tower on the grid. */
function _handlePlaceTower(world: World, cmd: PlaceTowerCommand): void {
  const { towerType: tt, x, y } = cmd

  // §2.6.3 — edge tiles cannot be built on
  if (isEdgeTile(x, y)) return

  const grid    = _worldGrid(world)
  const gwTiles = _gatewayTiles(world)

  // §2.6 — validate placement (path must remain reachable)
  if (!canPlaceTower(grid, gwTiles, x, y)) return

  // Check resources (L1 cost)
  const [eddyCost, compCost] = TOWER_COST_TABLES[tt][0]
  if (world.eddies < eddyCost || world.components < compCost) return

  // Deduct resources
  world.eddies     -= eddyCost
  world.components -= compCost

  // Build component flag set
  let extraFlags = 0
  if (
    tt === C.TowerType.DATA_SPIKE ||
    tt === C.TowerType.DAEMON_TURRET ||
    tt === C.TowerType.ICE_SNIPER
  ) {
    extraFlags |= C.TARGETING
  }
  if (tt === C.TowerType.DAEMON_TURRET || tt === C.TowerType.ICE_SNIPER) {
    extraFlags |= C.ROTATION
  }
  if (tt === C.TowerType.HARVESTER)  extraFlags |= C.HARVESTER
  if (tt === C.TowerType.PING)       extraFlags |= C.PING_RANGE
  if (tt === C.TowerType.BLACKWALL)  extraFlags |= C.BLACKWALL_TOWER

  const eid = createTower(world, extraFlags)
  world.towerType[eid]  = tt
  world.towerLevel[eid] = 1
  world.posX[eid]       = x
  world.posY[eid]       = y

  const hp = TOWER_HP_TABLES[tt][0]
  world.healthCurrent[eid] = hp
  world.healthMax[eid]     = hp

  // Type-specific initialisation
  if (tt === C.TowerType.DATA_SPIKE) {
    world.towerFacing[eid]        = cmd.facing ?? 0
    world.targetingMode[eid]      = C.TargetingMode.CLOSEST
    world.targetingCooldown[eid]  = DATA_SPIKE_COOLDOWN_TICKS

  } else if (tt === C.TowerType.DAEMON_TURRET) {
    world.targetingMode[eid]     = C.TargetingMode.CLOSEST
    world.targetingCooldown[eid] = DAEMON_TURRET_COOLDOWN[0]
    world.rotationSpeed[eid]     = DAEMON_TURRET_ROT_SPEED[0]

  } else if (tt === C.TowerType.ICE_SNIPER) {
    world.targetingMode[eid]     = C.TargetingMode.CLOSEST
    world.targetingCooldown[eid] = ICE_SNIPER_COOLDOWN[0]
    world.rotationSpeed[eid]     = ICE_SNIPER_ROT_SPEED[0]

  } else if (tt === C.TowerType.PING) {
    world.pingRange[eid] = PING_TOWER_RANGE[0]  // §5.7: 3 tiles base

  } else if (tt === C.TowerType.HARVESTER) {
    world.harvesterEddiesPerTick[eid]     = HARVESTER_EDDIES_PER_TICK[0]
    world.harvesterComponentsPerTick[eid] = HARVESTER_COMPONENTS_PER_TICK[0]

  } else if (tt === C.TowerType.BLACKWALL) {
    world.blackwallDamagePerTick[eid] = BLACKWALL_TOWER_DPT[0]
    // §5.6.1 — find adjacent gateway within Chebyshev 1
    for (let i = 0; i < world.activeGatewayCount; i++) {
      const gwEid = world.activeGateways[i]
      if (_chebyshev(x, y, world.gatewayX[gwEid], world.gatewayY[gwEid]) <= 1) {
        world.blackwallAssignedGateway[eid] = gwEid
        break
      }
    }
  }

  // Update grid
  const tileIdx = idx(x, y)
  world.gridBlocked[tileIdx]  = tt + 1  // §2.6.1 — 1-indexed so 0 = empty
  world.gridTowerType[tileIdx] = tt

  // Recompute both flowfields with new grid state
  computeDualFlowfields(
    _worldGrid(world),
    world.flowCost, world.flowDir,
    world.glitchCost, world.glitchDir,
  )
}

/** §5.2 — Place a linked Firewall pair. */
function _handlePlaceFirewall(world: World, cmd: PlaceFirewallCommand): void {
  const { t1, gap, t2 } = cmd
  const grid    = _worldGrid(world)
  const gwTiles = _gatewayTiles(world)

  if (!canPlaceFirewallPair(grid, gwTiles, t1, gap, t2)) return

  // Check resources (single cost for the pair — §5.2)
  const [eddyCost, compCost] = FIREWALL_COST[0]
  if (world.eddies < eddyCost || world.components < compCost) return

  world.eddies     -= eddyCost
  world.components -= compCost

  const hp = FIREWALL_HP[0]

  const eid1 = createTower(world, C.FIREWALL_LINK)
  world.towerType[eid1]  = C.TowerType.FIREWALL
  world.towerLevel[eid1] = 1
  world.posX[eid1]       = t1.x
  world.posY[eid1]       = t1.y
  world.healthCurrent[eid1] = hp
  world.healthMax[eid1]     = hp
  world.firewallGapX[eid1]  = gap.x
  world.firewallGapY[eid1]  = gap.y

  const eid2 = createTower(world, C.FIREWALL_LINK)
  world.towerType[eid2]  = C.TowerType.FIREWALL
  world.towerLevel[eid2] = 1
  world.posX[eid2]       = t2.x
  world.posY[eid2]       = t2.y
  world.healthCurrent[eid2] = hp
  world.healthMax[eid2]     = hp
  world.firewallGapX[eid2]  = gap.x
  world.firewallGapY[eid2]  = gap.y

  // §5.2.1 — link both entities
  world.firewallPartner[eid1] = eid2
  world.firewallPartner[eid2] = eid1

  // Update grid for both tower tiles
  const i1 = idx(t1.x, t1.y)
  world.gridBlocked[i1]  = C.TowerType.FIREWALL + 1
  world.gridTowerType[i1] = C.TowerType.FIREWALL

  const i2 = idx(t2.x, t2.y)
  world.gridBlocked[i2]  = C.TowerType.FIREWALL + 1
  world.gridTowerType[i2] = C.TowerType.FIREWALL

  computeDualFlowfields(
    _worldGrid(world),
    world.flowCost, world.flowDir,
    world.glitchCost, world.glitchDir,
  )
}

/** §5.0.5 — Upgrade a tower by one level. */
function _handleUpgradeTower(world: World, cmd: UpgradeTowerCommand): void {
  const { eid } = cmd
  const mask = world.bitmask[eid]

  if ((mask & C.TOWER) === 0) return
  if ((mask & C.PENDING_REMOVAL) !== 0) return

  const currentLevel = world.towerLevel[eid]
  if (currentLevel >= MAX_TOWER_LEVEL) return  // §5.0.5

  const tt           = world.towerType[eid]
  const [eddyCost, compCost] = TOWER_COST_TABLES[tt][currentLevel]  // upgrade cost

  if (world.eddies < eddyCost || world.components < compCost) return

  world.eddies     -= eddyCost
  world.components -= compCost

  const newLevel = currentLevel + 1
  world.towerLevel[eid] = newLevel

  // Update max HP and restore the HP delta gained
  const hpTable   = TOWER_HP_TABLES[tt]
  const oldMaxHp  = hpTable[currentLevel - 1]
  const newMaxHp  = hpTable[newLevel - 1]
  const hpDelta   = newMaxHp - oldMaxHp
  world.healthMax[eid]     = newMaxHp
  world.healthCurrent[eid] = Math.min(world.healthCurrent[eid] + hpDelta, newMaxHp)

  // Update type-specific level-dependent stats
  if (tt === C.TowerType.DAEMON_TURRET) {
    world.targetingCooldown[eid] = DAEMON_TURRET_COOLDOWN[newLevel - 1]
    world.rotationSpeed[eid]     = DAEMON_TURRET_ROT_SPEED[newLevel - 1]
  } else if (tt === C.TowerType.ICE_SNIPER) {
    world.targetingCooldown[eid] = ICE_SNIPER_COOLDOWN[newLevel - 1]
    world.rotationSpeed[eid]     = ICE_SNIPER_ROT_SPEED[newLevel - 1]
  } else if (tt === C.TowerType.PING) {
    world.pingRange[eid] = PING_TOWER_RANGE[newLevel - 1]
  } else if (tt === C.TowerType.HARVESTER) {
    world.harvesterEddiesPerTick[eid]     = HARVESTER_EDDIES_PER_TICK[newLevel - 1]
    world.harvesterComponentsPerTick[eid] = HARVESTER_COMPONENTS_PER_TICK[newLevel - 1]
  } else if (tt === C.TowerType.BLACKWALL) {
    world.blackwallDamagePerTick[eid] = BLACKWALL_TOWER_DPT[newLevel - 1]
  }
}

/** §4.2.6–4.2.7 — Dismantle a tower, with optional component refund. */
function _handleDismantleTower(
  world: World,
  cmd: DismantleTowerCommand,
): void {
  const { eid } = cmd
  const mask = world.bitmask[eid]

  if ((mask & C.TOWER) === 0) return
  if ((mask & C.PENDING_REMOVAL) !== 0) return

  const x = world.posX[eid]
  const y = world.posY[eid]

  // §4.2.6 — refund 100% Components if within Ping Tower range
  if (_isInPingRange(world, x, y)) {
    const tt           = world.towerType[eid]
    const level        = world.towerLevel[eid]
    const costTable    = TOWER_COST_TABLES[tt]
    let totalComponents = 0
    for (let l = 0; l < level; l++) totalComponents += costTable[l][1]

    if (totalComponents > 0) {
      const pickupEid = createPickup(world)
      world.posX[pickupEid]             = x
      world.posY[pickupEid]             = y
      world.pickupEddies[pickupEid]     = 0
      world.pickupComponents[pickupEid] = totalComponents
      // Decay relative to equivalent Eddie value (100 eddies per component)
      const initVal = totalComponents * 100
      world.pickupInitialValue[pickupEid]  = initVal
      world.pickupDecayPerTick[pickupEid]  = (5 / 60 / 100) * initVal
    }
  }
  // §4.2.7 — outside Ping range: no refund, resources are lost

  // Free grid tile(s)
  const tileIdx = idx(x, y)
  world.gridBlocked[tileIdx]   = 0
  world.gridTowerType[tileIdx] = 0

  // §5.2.4 — Firewall: also free partner's tile
  if ((mask & C.FIREWALL_LINK) !== 0) {
    const partnerEid = world.firewallPartner[eid]
    if (
      partnerEid !== 0 &&
      (world.bitmask[partnerEid] & C.PENDING_REMOVAL) === 0
    ) {
      const pi = idx(world.posX[partnerEid], world.posY[partnerEid])
      world.gridBlocked[pi]   = 0
      world.gridTowerType[pi] = 0
      // cleanup.system will cascade the partner removal
    }
  }

  markForRemoval(world, eid)

  computeDualFlowfields(
    _worldGrid(world),
    world.flowCost, world.flowDir,
    world.glitchCost, world.glitchDir,
  )
}

/** §8.3 — Skip the remaining break for a speed bonus. */
function _handleSkipBreak(world: World): void {
  if (world.currentPhase !== GamePhase.WAVE_BREAK) return
  world.breakTicksRemaining = 0
  world.skipBonusTicks      = SKIP_BONUS_TICKS
}

/** §8.2.1 — Manually start first wave from PRE_GAME phase. */
function _handleStartWave(world: World): void {
  if (world.currentPhase !== GamePhase.PRE_GAME) return
  world.currentPhase        = GamePhase.WAVE_BREAK
  world.breakTicksRemaining = 1800  // 30 s — eventSystem picks this up
}
