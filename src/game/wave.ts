/**
 * Wave Definitions — Rulebook §8
 *
 * Defines wave compositions, spawn intervals, and utility functions for
 * accessing wave data. Waves 1–10 are explicitly defined; beyond wave 10
 * the composition repeats wave 10 with wave-number-based stat scaling.
 */

import { EnemyType } from './ecs/component'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Rulebook §8.4 — ticks between each successive enemy spawn within a wave.
 * One enemy is spawned (across all active gateways in round-robin) every
 * SPAWN_INTERVAL_TICKS ticks.
 */
export const SPAWN_INTERVAL_TICKS = 30

// ---------------------------------------------------------------------------
// WaveData interface
// ---------------------------------------------------------------------------

export interface WaveData {
  /** 1-indexed wave number (used for stat scaling via waveScaling()). */
  waveNumber: number
  /** Ordered list of EnemyType enum values, one entry per enemy to spawn. */
  enemies: number[]
  /** True when the wave contains a named boss (Orchestrator or AI Overlord). */
  hasBoss: boolean
}

// ---------------------------------------------------------------------------
// Wave compositions — Rulebook §8.7
// ---------------------------------------------------------------------------

/** Module-init helper: build a repeating enemy-type array. Not in hot path. */
function rpt(type: EnemyType, n: number): number[] {
  const arr: number[] = []
  for (let i = 0; i < n; i++) arr.push(type as number)
  return arr
}

/**
 * Canonical wave definitions for waves 1–10.
 * Index 0 = wave 1, index 9 = wave 10.
 *
 * Compositions match Rulebook §8.7 exactly.
 */
export const WAVE_DEFINITIONS: readonly WaveData[] = [
  // Wave 1 — 5× DATA_LEECH (§8.7)
  {
    waveNumber: 1,
    enemies: rpt(EnemyType.DATA_LEECH, 5),
    hasBoss: false,
  },
  // Wave 2 — 10× DATA_LEECH (§8.7)
  {
    waveNumber: 2,
    enemies: rpt(EnemyType.DATA_LEECH, 10),
    hasBoss: false,
  },
  // Wave 3 — 5× DATA_LEECH, 5× CODE_RUNNER (§8.7)
  {
    waveNumber: 3,
    enemies: [
      ...rpt(EnemyType.DATA_LEECH, 5),
      ...rpt(EnemyType.CODE_RUNNER, 5),
    ],
    hasBoss: false,
  },
  // Wave 4 — 10× DATA_LEECH, 10× CODE_RUNNER (§8.7)
  {
    waveNumber: 4,
    enemies: [
      ...rpt(EnemyType.DATA_LEECH, 10),
      ...rpt(EnemyType.CODE_RUNNER, 10),
    ],
    hasBoss: false,
  },
  // Wave 5 — 20× DATA_LEECH, 20× CODE_RUNNER, 1× FIREWALL_BREACHER (§8.7)
  {
    waveNumber: 5,
    enemies: [
      ...rpt(EnemyType.DATA_LEECH, 20),
      ...rpt(EnemyType.CODE_RUNNER, 20),
      EnemyType.FIREWALL_BREACHER as number,
    ],
    hasBoss: false,
  },
  // Wave 6 — 5× FIREWALL_BREACHER (§8.7)
  {
    waveNumber: 6,
    enemies: rpt(EnemyType.FIREWALL_BREACHER, 5),
    hasBoss: false,
  },
  // Wave 7 — 50× DATA_LEECH (§8.7)
  {
    waveNumber: 7,
    enemies: rpt(EnemyType.DATA_LEECH, 50),
    hasBoss: false,
  },
  // Wave 8 — 20× CODE_RUNNER, 20× FIREWALL_BREACHER (§8.7)
  {
    waveNumber: 8,
    enemies: [
      ...rpt(EnemyType.CODE_RUNNER, 20),
      ...rpt(EnemyType.FIREWALL_BREACHER, 20),
    ],
    hasBoss: false,
  },
  // Wave 9 — 10× CODE_RUNNER, 10× FIREWALL_BREACHER, 1× GLITCH (§8.7)
  {
    waveNumber: 9,
    enemies: [
      ...rpt(EnemyType.CODE_RUNNER, 10),
      ...rpt(EnemyType.FIREWALL_BREACHER, 10),
      EnemyType.GLITCH as number,
    ],
    hasBoss: false,
  },
  // Wave 10 — 1× ORCHESTRATOR (§8.7)
  {
    waveNumber: 10,
    enemies: [EnemyType.ORCHESTRATOR as number],
    hasBoss: true,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return wave data for any wave number.
 * Waves 1–10 use the explicit definition table.
 * Wave > 10: uses wave 10's enemy composition with the actual waveNumber
 *   for stat scaling purposes (§8.4.1, §8.2.2).
 */
export function getWaveData(wave: number): WaveData {
  if (wave <= 10) {
    const def = WAVE_DEFINITIONS[wave - 1]
    // Return a shallow copy with a fresh enemies array so callers can mutate it
    return { waveNumber: wave, enemies: def.enemies.slice(), hasBoss: def.hasBoss }
  }
  // Beyond wave 10: repeat wave 10 composition
  const base = WAVE_DEFINITIONS[9]
  return { waveNumber: wave, enemies: base.enemies.slice(), hasBoss: base.hasBoss }
}

/**
 * Return the total number of enemies that will spawn in a given wave.
 */
export function getTotalEnemiesInWave(wave: number): number {
  return getWaveData(wave).enemies.length
}
