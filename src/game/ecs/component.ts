/**
 * Component Type Definitions — Tech.md §4.2, §4.1.4–4.1.5
 *
 * All game state is stored in typed arrays indexed by entity ID.
 * Each component type has a corresponding bit flag for fast bitmask queries.
 */

// ---------------------------------------------------------------------------
// Component bit flags (one bit per component type)
// ---------------------------------------------------------------------------

/** Rulebook §2.1 — position on 51×51 grid (towers, pickups, gateways, Core) */
export const POSITION = 1 << 0

/** Rulebook §3.3, §5.0.2 — health pool */
export const HEALTH = 1 << 1

/** Rulebook §2.10.2 — discrete tile the enemy is "on" */
export const TILE_POS = 1 << 2

/** Rulebook §2.10.2 — 0=boundary, 0.5=center, 1=next tile */
export const TILE_PROGRESS = 1 << 3

/** Rulebook §2.10.4–2.10.8 — path state for enemy movement */
export const PATH_STATE = 1 << 4

/** Rulebook §2.10.1 — 30-tick spawn immunity countdown */
export const SPAWN_IMMUNITY = 1 << 5

/** Rulebook §5.0.1 — tower type, level, and facing */
export const TOWER = 1 << 6

/** Rulebook §1.10.7 — tower targeting mode and cooldown */
export const TARGETING = 1 << 7

/** Rulebook §5.4.1, §5.5.1 — rotational targeting */
export const ROTATION = 1 << 8

/** Rulebook §7 — enemy type, tier, and damage value */
export const ENEMY = 1 << 9

/** Rulebook §7.0.5, §7.0.14 — immunity bitmask */
export const IMMUNITY = 1 << 10

/** Rulebook §7.0.10, §7.0.15 — slow status effect */
export const SLOW = 1 << 11

/** Rulebook §7.0.11, §7.0.16 — stun status effect */
export const STUN = 1 << 12

/** Rulebook §4.2.3 — resource pickup on map */
export const PICKUP = 1 << 13

/** Rulebook §5.8 — Eddie/Component generation */
export const HARVESTER = 1 << 14

/** Rulebook §5.7 — Chebyshev pickup collection radius */
export const PING_RANGE = 1 << 15

/** Rulebook §6.0.1 — tower ability (unlocked at level 5) */
export const ABILITY = 1 << 16

/** Rulebook §5.2.1 — links two Firewall tower entities */
export const FIREWALL_LINK = 1 << 17

/** Rulebook §9.2 — Blackwall Gateway spawn point */
export const GATEWAY = 1 << 18

/** Rulebook §5.6 — Blackwall restoration tower */
export const BLACKWALL_TOWER = 1 << 19

/** Marks entity as pending removal (cleaned up by cleanupSystem §1.10.12) */
export const PENDING_REMOVAL = 1 << 20

/** Rulebook §7.7 — Saboteur tower-disable aura */
export const TOWER_DISABLED = 1 << 21

// ---------------------------------------------------------------------------
// Immunity flag masks (stored in Immunity.flags Uint8)
// ---------------------------------------------------------------------------

/** Rulebook §7.1.3 — immune to stun */
export const IMMUNE_STUN = 1 << 0

/** Rulebook §7.1.4 — immune to slow */
export const IMMUNE_SLOW = 1 << 1

/** Rulebook §7.3.1 — immune to ICE Wall slow */
export const IMMUNE_ICE_SLOW = 1 << 2

/** Rulebook §7.3.1 — immune to Firewall stun */
export const IMMUNE_FIREWALL_STUN = 1 << 3

/** Rulebook §7.5.2 — immune to ICE Wall DoT */
export const IMMUNE_ICE_DOT = 1 << 4

/** Rulebook §7.5.2 — immune to Firewall damage */
export const IMMUNE_FIREWALL_DMG = 1 << 5

// ---------------------------------------------------------------------------
// Tower type enum
// ---------------------------------------------------------------------------

/** Rulebook §5 */
export const enum TowerType {
  ICE_WALL = 0,
  FIREWALL = 1,
  DATA_SPIKE = 2,
  DAEMON_TURRET = 3,
  ICE_SNIPER = 4,
  BLACKWALL = 5,
  PING = 6,
  HARVESTER = 7,
}

// ---------------------------------------------------------------------------
// Enemy type enum
// ---------------------------------------------------------------------------

/** Rulebook §7 */
export const enum EnemyType {
  DATA_LEECH = 0,
  CODE_RUNNER = 1,
  FIREWALL_BREACHER = 2,
  GLITCH = 3,
  ORCHESTRATOR = 4,
  VDB_NETRUNNER = 5,
  SABOTEUR = 6,
  AI_OVERLORD = 7,
}

// ---------------------------------------------------------------------------
// Targeting mode enum
// ---------------------------------------------------------------------------

/** Rulebook §5.4.2, §5.5.4 */
export const enum TargetingMode {
  CLOSEST = 0,
  HIGHEST_HP = 1,
  LOWEST_HP = 2,
}

// ---------------------------------------------------------------------------
// Ability type enum
// ---------------------------------------------------------------------------

/** Rulebook §6 */
export const enum AbilityType {
  EMP_BLAST = 0,
  OVERCLOCK = 1,
  TUNED = 2,
  BOOSTED = 3,
  ORACLE = 4,
}

// ---------------------------------------------------------------------------
// Direction enum (flowfield)
// ---------------------------------------------------------------------------

/** Rulebook §2.10.5, Tech.md §5.4 */
export const enum Dir {
  N = 0,
  S = 1,
  E = 2,
  W = 3,
  NONE = 0xff,
}

// ---------------------------------------------------------------------------
// Direction change enum
// ---------------------------------------------------------------------------

/** Rulebook §2.10.6, Tech.md §5.4 */
export const enum DirChange {
  NONE = 0,
  TURN_RIGHT = 1,
  TURN_LEFT = 2,
  TURN_AROUND = 3,
}

// ---------------------------------------------------------------------------
// Movement state enum
// ---------------------------------------------------------------------------

/** Rulebook §2.10.8, Tech.md §5.4 */
export const enum MoveState {
  INTRO = 0,
  FORWARD = 1,
  TURN_RIGHT = 2,
  TURN_LEFT = 3,
  TURN_AROUND = 4,
  OUTRO = 5,
}
