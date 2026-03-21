/**
 * Game Constants — derived from Rulebook.
 * Every constant references the rulebook section it implements.
 * These MUST match the rulebook exactly — do not change without updating tests.
 */

// ---------------------------------------------------------------------------
// §1 — Game Overview
// ---------------------------------------------------------------------------

/** Rulebook §1.8 — fixed simulation rate */
export const TICK_RATE = 10


/** Rulebook §1.8 — duration of one tick in milliseconds */
export const TICK_DURATION = 1000 / TICK_RATE

/** Tech.md §3.1.3 — max ticks processed per animation frame */
export const MAX_TICKS_PER_FRAME = 4

// ---------------------------------------------------------------------------
// §2 — Map & Grid
// ---------------------------------------------------------------------------

/** Rulebook §2.1 — grid dimensions */
export const GRID_SIZE = 51

/** Rulebook §2.9 — Core position (0-indexed) */
export const CORE_X = Math.floor(GRID_SIZE / 2)  // 0-indexed center of GRID_SIZE×GRID_SIZE grid (Rulebook §2.9)

/** Rulebook §2.9 — Core position (0-indexed) */
export const CORE_Y = Math.floor(GRID_SIZE / 2)

/** Rulebook §2.10.1 — spawn immunity duration in ticks (0.5 s) */
export const SPAWN_IMMUNITY_TICKS = TICK_RATE / 2

// ---------------------------------------------------------------------------
// §3 — Core
// ---------------------------------------------------------------------------

/** Rulebook §3.3 */
export const CORE_STARTING_HP = 100

// ---------------------------------------------------------------------------
// §4 — Resources
// ---------------------------------------------------------------------------

/** Rulebook §4.3.1 */
export const INITIAL_EDDIES = 500

/** Rulebook §4.3.1 */
export const INITIAL_COMPONENTS = 10

/** Rulebook §4.2.5 — decay rate = 5% per second / 100 per tick as fraction of initial value */
export const PICKUP_DECAY_RATE = 5 / TICK_RATE / 100

/** Rulebook §4.2.9 — Eddies conversion rate */
export const EDDIES_PER_COMPONENT = 100

// ---------------------------------------------------------------------------
// §5 — Towers (costs, HP, stats per level)
// ---------------------------------------------------------------------------

/** Rulebook §5.0.5 */
export const MAX_TOWER_LEVEL = 10

/** Rulebook §5.0.7 */
export const MAX_ABILITY_LEVEL = 5

/**
 * ICE Wall cost table — Rulebook §5.1
 * Index = level-1 (0 = level 1)
 * Each entry: [eddies, components]
 */
export const ICE_WALL_COST: ReadonlyArray<readonly [number, number]> = [
  [50, 0],   // L1
  [0, 1],    // L2
  [0, 2],    // L3
  [0, 4],    // L4
  [0, 8],    // L5
  [0, 16],   // L6
  [0, 32],   // L7
  [0, 64],   // L8
  [0, 128],  // L9
  [0, 256],  // L10
]

/** ICE Wall HP per level — Rulebook §5.1 (+200 HP per level) */
export const ICE_WALL_HP: ReadonlyArray<number> = [
  200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000,
]

/** ICE Wall DPS per level — Rulebook §5.1 (1 DPS base, +1/level) */
export const ICE_WALL_DPS: ReadonlyArray<number> = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
]

/** ICE Wall slow magnitude per level — Rulebook §5.1 */
export const ICE_WALL_SLOW: ReadonlyArray<number> = [
  0.20, 0.30, 0.39, 0.47, 0.54, 0.60, 0.65, 0.69, 0.72, 0.74,
]

/**
 * Firewall cost table — Rulebook §5.2
 */
export const FIREWALL_COST: ReadonlyArray<readonly [number, number]> = [
  [75, 1],    // L1
  [50, 3],    // L2
  [0, 7],     // L3
  [0, 14],    // L4
  [0, 28],    // L5
  [0, 56],    // L6
  [0, 112],   // L7
  [0, 224],   // L8
  [0, 448],   // L9
  [0, 896],   // L10
]

/** Firewall HP per tower per level — Rulebook §5.2 */
export const FIREWALL_HP: ReadonlyArray<number> = [
  500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000,
]

/** Firewall DPS per level — Rulebook §5.2 (+10/level) */
export const FIREWALL_DPS: ReadonlyArray<number> = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
]

/** Firewall stun duration — Rulebook §5.2 (1 s) */
export const FIREWALL_STUN_TICKS = TICK_RATE

/**
 * Data Spike cost table — Rulebook §5.3
 */
export const DATA_SPIKE_COST: ReadonlyArray<readonly [number, number]> = [
  [150, 2],    // L1
  [0, 7],      // L2
  [0, 14],     // L3
  [0, 28],     // L4
  [0, 56],     // L5
  [0, 112],    // L6
  [0, 224],    // L7
  [0, 448],    // L8
  [0, 896],    // L9
  [0, 1792],   // L10
]

/** Data Spike HP per level — Rulebook §5.3 */
export const DATA_SPIKE_HP: ReadonlyArray<number> = [
  500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000,
]

/** Data Spike damage per spike per level — Rulebook §5.3 */
export const DATA_SPIKE_DAMAGE: ReadonlyArray<number> = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
]

/** Data Spike range per level — Rulebook §5.3 */
export const DATA_SPIKE_RANGE: ReadonlyArray<number> = [
  2, 3, 4, 5, 5, 5, 5, 5, 5, 5,
]

/** Data Spike fire rate — Rulebook §5.3 (2 s) */
export const DATA_SPIKE_COOLDOWN_TICKS = 2 * TICK_RATE

/**
 * Daemon Turret cost table — Rulebook §5.4
 */
export const DAEMON_TURRET_COST: ReadonlyArray<readonly [number, number]> = [
  [0, 5],     // L1
  [0, 10],    // L2
  [0, 20],    // L3
  [0, 40],    // L4
  [0, 80],    // L5
  [0, 160],   // L6
  [0, 320],   // L7
  [0, 640],   // L8
  [0, 1280],  // L9
  [0, 2560],  // L10
]

/** Daemon Turret HP per level — Rulebook §5.4 (+100 HP per level) */
export const DAEMON_TURRET_HP: ReadonlyArray<number> = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
]

/** Daemon Turret fire cooldown per level — Rulebook §5.4 (2 s → 1 s) */
export const DAEMON_TURRET_COOLDOWN: ReadonlyArray<number> = [
  2 * TICK_RATE, 2 * TICK_RATE, 2 * TICK_RATE, 2 * TICK_RATE, 2 * TICK_RATE,
  Math.round(1.8 * TICK_RATE), Math.round(1.6 * TICK_RATE), Math.round(1.4 * TICK_RATE),
  Math.round(1.2 * TICK_RATE), Math.round(0.5 * TICK_RATE),
]

/** Daemon Turret damage per daemon per level — Rulebook §5.4 */
export const DAEMON_TURRET_DAMAGE: ReadonlyArray<number> = [
  10, 15, 20, 25, 30, 30, 30, 30, 30, 30,
]

/** Daemon Turret rotation speed per level (deg/tick, 30–60 deg/s) — Rulebook §5.4 */
export const DAEMON_TURRET_ROT_SPEED: ReadonlyArray<number> = [
  30 / TICK_RATE, 30 / TICK_RATE, 30 / TICK_RATE, 30 / TICK_RATE,
  60 / TICK_RATE, 60 / TICK_RATE, 60 / TICK_RATE, 60 / TICK_RATE, 60 / TICK_RATE, 60 / TICK_RATE,
]

/**
 * Daemon Turret range per level — Rulebook §5.4
 */
export const DAEMON_TURRET_RANGE: ReadonlyArray<number> = [
  3, 3, 3, 3, 3, 4, 5, 5, 5, 5,
]

/**
 * ICE Sniper cost table — Rulebook §5.5
 */
export const ICE_SNIPER_COST: ReadonlyArray<readonly [number, number]> = [
  [0, 10],    // L1
  [0, 15],    // L2
  [0, 30],    // L3
  [0, 60],    // L4
  [0, 120],   // L5
  [0, 240],   // L6
  [0, 480],   // L7
  [0, 960],   // L8
  [0, 1920],  // L9
  [0, 3840],  // L10
]

/** ICE Sniper HP per level — Rulebook §5.5 (+100 HP per level) */
export const ICE_SNIPER_HP: ReadonlyArray<number> = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
]

/** ICE Sniper rotation speed per level (deg/tick, 30–120 deg/s) — Rulebook §5.5 */
export const ICE_SNIPER_ROT_SPEED: ReadonlyArray<number> = [
  30 / TICK_RATE, 30 / TICK_RATE, 30 / TICK_RATE, 30 / TICK_RATE, 30 / TICK_RATE,
  60 / TICK_RATE, 60 / TICK_RATE, 60 / TICK_RATE, 60 / TICK_RATE, 120 / TICK_RATE,
]

/** ICE Sniper damage per level — Rulebook §5.5 */
export const ICE_SNIPER_DAMAGE: ReadonlyArray<number> = [
  50, 60, 70, 80, 90, 120, 150, 180, 220, 300,
]

/** ICE Sniper slow % per level — Rulebook §5.5 */
export const ICE_SNIPER_SLOW: ReadonlyArray<number> = [
  0.20, 0.20, 0.20, 0.20, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70,
]

/** ICE Sniper fire cooldown per level — Rulebook §5.5 (3 s → 2 s) */
export const ICE_SNIPER_COOLDOWN: ReadonlyArray<number> = [
  3 * TICK_RATE, 3 * TICK_RATE, 3 * TICK_RATE, 3 * TICK_RATE, 3 * TICK_RATE,
  Math.round(2.8 * TICK_RATE), Math.round(2.6 * TICK_RATE), Math.round(2.4 * TICK_RATE),
  Math.round(2.2 * TICK_RATE), 2 * TICK_RATE,
]

/** ICE Sniper min range — Rulebook §5.5.2 */
export const ICE_SNIPER_MIN_RANGE: ReadonlyArray<number> = [
  3, 3, 3, 4, 4, 4, 5, 5, 5, 6,
]

/** ICE Sniper max range — Rulebook §5.5 */
export const ICE_SNIPER_MAX_RANGE: ReadonlyArray<number> = [
  5, 5, 5, 6, 6, 6, 7, 7, 7, 8,
]

/** ICE Sniper slow duration ticks — Rulebook §5.5.3 (2 s) */
export const ICE_SNIPER_SLOW_TICKS = 2 * TICK_RATE

// ---------------------------------------------------------------------------
// Visual FX durations (renderer)
// ---------------------------------------------------------------------------

/** Ticks a Daemon Turret / ICE Sniper shot-beam entity remains visible. */
export const SHOT_BEAM_TICKS = 5

/** Ticks a Data Spike cone wave entity takes to sweep its full range. */
export const CONE_FX_TICKS = 5

/**
 * Blackwall Tower cost table — Rulebook §5.6
 */
export const BLACKWALL_TOWER_COST: ReadonlyArray<readonly [number, number]> = [
  [0, 20],    // L1
  [0, 40],    // L2
  [0, 80],    // L3
  [0, 160],   // L4
  [0, 320],   // L5
  [0, 640],   // L6
  [0, 1280],  // L7
  [0, 2560],  // L8
  [0, 5120],  // L9
  [0, 10240], // L10
]

/** Blackwall Tower HP per level — Rulebook §5.6 */
export const BLACKWALL_TOWER_HP: ReadonlyArray<number> = [
  1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
]

/** Blackwall Tower damage to gateway per tick per level — Rulebook §5.6.2 (kills in 120 s at L1) */
export const BLACKWALL_TOWER_DPT: ReadonlyArray<number> = Array.from(
  { length: 10 },
  (_, i) => (1000 / (120 * TICK_RATE)) * (i + 1),
)

/** Blackwall Tower passive damage taken from gateway per tick — Rulebook §5.6.6 (120 s to kill) */
export const BLACKWALL_PASSIVE_DPT = 1000 / (120 * TICK_RATE)

/** Blackwall repair cost (full restore) — Rulebook §5.6.7 */
export const BLACKWALL_REPAIR_COMPONENTS = 10

/** HP fraction at which auto-repair triggers — Rulebook §5.6.7 */
export const BLACKWALL_REPAIR_THRESHOLD = 0.1

/**
 * Ping Tower cost table — Rulebook §5.7
 */
export const PING_TOWER_COST: ReadonlyArray<readonly [number, number]> = [
  [0, 2],     // L1
  [0, 4],     // L2
  [0, 8],     // L3
  [0, 16],    // L4
  [0, 32],    // L5
  [0, 64],    // L6
  [0, 128],   // L7
  [0, 256],   // L8
  [0, 512],   // L9
  [0, 1024],  // L10
]

/** Ping Tower HP per level — Rulebook §5.7 (+100 HP per level) */
export const PING_TOWER_HP: ReadonlyArray<number> = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
]

/** Ping Tower range per level — Rulebook §5.7 */
export const PING_TOWER_RANGE: ReadonlyArray<number> = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
]

/**
 * Harvester cost table — Rulebook §5.8
 */
export const HARVESTER_COST: ReadonlyArray<readonly [number, number]> = [
  [0, 2],    // L1
  [0, 4],    // L2
  [0, 8],    // L3
  [0, 16],   // L4
  [0, 32],   // L5
  [0, 64],   // L6
  [0, 128],  // L7
  [0, 256],  // L8
  [0, 512],  // L9
  [0, 1024], // L10
]

/** Harvester HP per level — Rulebook §5.8 (+100 HP per level) */
export const HARVESTER_HP: ReadonlyArray<number> = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
]

/** Harvester Eddie generation per tick per level — Rulebook §5.8 (1–10 Eddies/s) */
export const HARVESTER_EDDIES_PER_TICK: ReadonlyArray<number> = [
  1 / TICK_RATE, 2 / TICK_RATE, 3 / TICK_RATE, 4 / TICK_RATE, 5 / TICK_RATE,
  6 / TICK_RATE, 7 / TICK_RATE, 8 / TICK_RATE, 9 / TICK_RATE, 10 / TICK_RATE,
]

/** Harvester Component generation per tick (from level 3) — Rulebook §5.8.2 (1–8 per 10 s) */
export const HARVESTER_COMPONENTS_PER_TICK: ReadonlyArray<number> = [
  0, 0, 1 / (10 * TICK_RATE), 2 / (10 * TICK_RATE), 3 / (10 * TICK_RATE),
  4 / (10 * TICK_RATE), 5 / (10 * TICK_RATE), 6 / (10 * TICK_RATE), 7 / (10 * TICK_RATE), 8 / (10 * TICK_RATE),
]

// ---------------------------------------------------------------------------
// §7 — Enemies
// ---------------------------------------------------------------------------

/** Rulebook §7.1 — Data Leech base stats */
export const ENEMY_DATA_LEECH = {
  damage: 5,
  health: 10,
  speedPerSec: 0.5,
  tierMultiplier: 1,
} as const

/** Rulebook §7.2 — Code Runner base stats */
export const ENEMY_CODE_RUNNER = {
  damage: 10,
  health: 5,
  speedPerSec: 1.0,
  tierMultiplier: 2,
} as const

/** Rulebook §7.3 — Firewall Breacher base stats */
export const ENEMY_FIREWALL_BREACHER = {
  damage: 20,
  health: 50,
  speedPerSec: 0.5,
  tierMultiplier: 3,
} as const

/** Rulebook §7.4 — Glitch base stats */
export const ENEMY_GLITCH = {
  damage: 20,
  health: 50,
  speedPerSec: 0.5,
  tierMultiplier: 4,
} as const

/** Rulebook §7.5 — Orchestrator base stats */
export const ENEMY_ORCHESTRATOR = {
  damage: 100,
  health: 200,
  speedPerSec: 0.5,
  tierMultiplier: 5,
} as const

/** Rulebook §7.6 — VDB Netrunner base stats */
export const ENEMY_VDB_NETRUNNER = {
  damage: 30,
  health: 750,
  speedPerSec: 0.5,
  tierMultiplier: 6,
} as const

/** Rulebook §7.7 — Saboteur base stats */
export const ENEMY_SABOTEUR = {
  damage: 20,
  health: 500,
  speedPerSec: 0.5,
  tierMultiplier: 7,
  disableRadius: 1,
  disableDuration: 5 * TICK_RATE,
  disableCooldown: 10 * TICK_RATE,
} as const

/** Rulebook §7.8 — AI Overlord base stats */
export const ENEMY_AI_OVERLORD = {
  damage: 50,
  health: 1000,
  speedPerSec: 0.5,
  tierMultiplier: 8,
  phaseDuration: 30 * TICK_RATE,
} as const

/** Rulebook §8.4.1 — wave stat scaling formula */
export function waveScaling(baseStat: number, wave: number): number {
  return baseStat * (1 + 0.1 * wave)
}

// ---------------------------------------------------------------------------
// §8 — Waves
// ---------------------------------------------------------------------------

/** Break duration — fixed at 60 s for every wave (auto-start). */
export function breakDuration(_wave: number): number {
  return 60 * TICK_RATE
}

/** Rulebook §8.3.1 — skip bonus duration (10 s) */
export const SKIP_BONUS_TICKS = 10 * TICK_RATE

/** Rulebook §8.3.1 — skip bonus multiplier */
export const SKIP_BONUS_MULTIPLIER = 2

/** Rulebook §9.2.9 — Gateway HP */
export const GATEWAY_HP = 10000

// ---------------------------------------------------------------------------
// §7.7 — Saboteur timing constants
// ---------------------------------------------------------------------------

/** Rulebook §7.7.1 — ticks between Saboteur disable pulses (10 s) */
export const SABOTEUR_PULSE_INTERVAL_TICKS = 10 * TICK_RATE

/** Rulebook §7.7.1 — duration of tower disable from Saboteur pulse (5 s) */
export const SABOTEUR_DISABLE_DURATION_TICKS = 5 * TICK_RATE

// ---------------------------------------------------------------------------
// §7.8 — AI Overlord phase constants
// ---------------------------------------------------------------------------

/** Rulebook §7.8.7 — ticks per AI Overlord phase (30 s) */
export const AI_OVERLORD_PHASE_DURATION_TICKS = 30 * TICK_RATE

/** Rulebook §7.8.2 — AI Overlord spawns an entity every Nth tile walked */
export const AI_OVERLORD_SPAWN_EVERY_N_TILES = 5

// ---------------------------------------------------------------------------
// §6 — Abilities
// ---------------------------------------------------------------------------

/**
 * §6.1–6.5 — All abilities share this upgrade cost progression (Components).
 * Index = current abilityLevel (0 = cost to unlock L1, 1 = cost to reach L2 …).
 */
export const ABILITY_UPGRADE_COST: ReadonlyArray<number> = [1, 2, 4, 8, 16]

/** §6.1 — EMP Blast stun duration at level 1 (2 s) */
export const EMP_BLAST_STUN_TICKS_BASE = 2 * TICK_RATE

/** §6.1 — EMP Blast stun duration increase per ability level (2 s) */
export const EMP_BLAST_STUN_TICKS_PER_LEVEL = 2 * TICK_RATE

/** §6.1 — EMP Blast activation cooldown at level 1 (10 s) */
export const EMP_BLAST_COOLDOWN_BASE = 10 * TICK_RATE

/** §6.1.5 — EMP Blast cooldown increase per ability level beyond L1 (1 s) */
export const EMP_BLAST_COOLDOWN_PER_LEVEL = TICK_RATE

/** §6.2 — Overclock active duration (5 s) */
export const OVERCLOCK_DURATION_TICKS = 5 * TICK_RATE

/** §6.2 — Overclock activation cooldown (20 s) */
export const OVERCLOCK_COOLDOWN_TICKS = 20 * TICK_RATE

/** §6.2 — Overclock fire-rate / generation multiplier at level 1 (+50%) */
export const OVERCLOCK_MULTIPLIER_BASE = 1.5

/** §6.2 — Overclock multiplier increase per ability level (+25% per level) */
export const OVERCLOCK_MULTIPLIER_PER_LEVEL = 0.25

/** §6.3 — Tuned target-switch cooldown at level 1 (20 s) */
export const TUNED_COOLDOWN_BASE = 20 * TICK_RATE

/** §6.3 — Tuned target-switch cooldown reduction per ability level (3 s) */
export const TUNED_COOLDOWN_PER_LEVEL = 3 * TICK_RATE

/** §6.3 — Minimum Tuned target-switch cooldown (5 s) */
export const TUNED_COOLDOWN_MIN = 5 * TICK_RATE

/**
 * §6.4 — Boosted Eddie-generation multiplier per ability level.
 * Index = abilityLevel - 1.  Values: +50% / +100% / +133% / +166% / +200%.
 */
export const BOOSTED_MULTIPLIER: ReadonlyArray<number> = [
  1.5,       // L1: +50%
  2.0,       // L2: +100%
  7 / 3,     // L3: +133%
  8 / 3,     // L4: +166%
  3.0,       // L5: +200%
]

/**
 * §6.5 — Oracle range multiplier per ability level.
 * Index = abilityLevel - 1.  Values: +50% / +100% / +133% / +166% / +200%.
 */
export const ORACLE_MULTIPLIER: ReadonlyArray<number> = [
  1.5,       // L1: +50%
  2.0,       // L2: +100%
  7 / 3,     // L3: +133%
  8 / 3,     // L4: +166%
  3.0,       // L5: +200%
]
