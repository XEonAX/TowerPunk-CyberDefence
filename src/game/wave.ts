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

/**
 * Canonical wave definitions for waves 1–10.
 * Index 0 = wave 1, index 9 = wave 10.
 *
 * Compositions derived from the task spec (which itself references §8.7
 * with the structured 10-wave progression table).
 */
export const WAVE_DEFINITIONS: readonly WaveData[] = [
  // Wave 1 — 5× DATA_LEECH
  {
    waveNumber: 1,
    enemies: [
      EnemyType.DATA_LEECH,
      EnemyType.DATA_LEECH,
      EnemyType.DATA_LEECH,
      EnemyType.DATA_LEECH,
      EnemyType.DATA_LEECH,
    ],
    hasBoss: false,
  },
  // Wave 2 — 4× DATA_LEECH, 3× CODE_RUNNER
  {
    waveNumber: 2,
    enemies: [
      EnemyType.DATA_LEECH,
      EnemyType.DATA_LEECH,
      EnemyType.DATA_LEECH,
      EnemyType.DATA_LEECH,
      EnemyType.CODE_RUNNER,
      EnemyType.CODE_RUNNER,
      EnemyType.CODE_RUNNER,
    ],
    hasBoss: false,
  },
  // Wave 3 — 5× CODE_RUNNER, 2× FIREWALL_BREACHER
  {
    waveNumber: 3,
    enemies: [
      EnemyType.CODE_RUNNER,
      EnemyType.CODE_RUNNER,
      EnemyType.CODE_RUNNER,
      EnemyType.CODE_RUNNER,
      EnemyType.CODE_RUNNER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
    ],
    hasBoss: false,
  },
  // Wave 4 — 4× CODE_RUNNER, 3× FIREWALL_BREACHER, 1× GLITCH
  {
    waveNumber: 4,
    enemies: [
      EnemyType.CODE_RUNNER,
      EnemyType.CODE_RUNNER,
      EnemyType.CODE_RUNNER,
      EnemyType.CODE_RUNNER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.GLITCH,
    ],
    hasBoss: false,
  },
  // Wave 5 — 6× FIREWALL_BREACHER, 2× GLITCH, 2× ORCHESTRATOR (MINI_BOSS)
  {
    waveNumber: 5,
    enemies: [
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.GLITCH,
      EnemyType.GLITCH,
      EnemyType.ORCHESTRATOR,
      EnemyType.ORCHESTRATOR,
    ],
    hasBoss: true,
  },
  // Wave 6 — 4× FIREWALL_BREACHER, 3× GLITCH, 3× VDB_NETRUNNER
  {
    waveNumber: 6,
    enemies: [
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.FIREWALL_BREACHER,
      EnemyType.GLITCH,
      EnemyType.GLITCH,
      EnemyType.GLITCH,
      EnemyType.VDB_NETRUNNER,
      EnemyType.VDB_NETRUNNER,
      EnemyType.VDB_NETRUNNER,
    ],
    hasBoss: false,
  },
  // Wave 7 — 5× GLITCH, 3× VDB_NETRUNNER, 2× SABOTEUR
  {
    waveNumber: 7,
    enemies: [
      EnemyType.GLITCH,
      EnemyType.GLITCH,
      EnemyType.GLITCH,
      EnemyType.GLITCH,
      EnemyType.GLITCH,
      EnemyType.VDB_NETRUNNER,
      EnemyType.VDB_NETRUNNER,
      EnemyType.VDB_NETRUNNER,
      EnemyType.SABOTEUR,
      EnemyType.SABOTEUR,
    ],
    hasBoss: false,
  },
  // Wave 8 — 4× VDB_NETRUNNER, 3× SABOTEUR, 2× ORCHESTRATOR (BOSS at end)
  {
    waveNumber: 8,
    enemies: [
      EnemyType.VDB_NETRUNNER,
      EnemyType.VDB_NETRUNNER,
      EnemyType.VDB_NETRUNNER,
      EnemyType.VDB_NETRUNNER,
      EnemyType.SABOTEUR,
      EnemyType.SABOTEUR,
      EnemyType.SABOTEUR,
      EnemyType.ORCHESTRATOR,
      EnemyType.ORCHESTRATOR,
    ],
    hasBoss: true,
  },
  // Wave 9 — 4× SABOTEUR, 3× ORCHESTRATOR, 2× VDB_NETRUNNER, 1× AI_OVERLORD
  {
    waveNumber: 9,
    enemies: [
      EnemyType.SABOTEUR,
      EnemyType.SABOTEUR,
      EnemyType.SABOTEUR,
      EnemyType.SABOTEUR,
      EnemyType.ORCHESTRATOR,
      EnemyType.ORCHESTRATOR,
      EnemyType.ORCHESTRATOR,
      EnemyType.VDB_NETRUNNER,
      EnemyType.VDB_NETRUNNER,
      EnemyType.AI_OVERLORD,
    ],
    hasBoss: false,
  },
  // Wave 10 — 5× ORCHESTRATOR, 2× SABOTEUR, 3× AI_OVERLORD (BOSS: AI_OVERLORD at end)
  {
    waveNumber: 10,
    enemies: [
      EnemyType.ORCHESTRATOR,
      EnemyType.ORCHESTRATOR,
      EnemyType.ORCHESTRATOR,
      EnemyType.ORCHESTRATOR,
      EnemyType.ORCHESTRATOR,
      EnemyType.SABOTEUR,
      EnemyType.SABOTEUR,
      EnemyType.AI_OVERLORD,
      EnemyType.AI_OVERLORD,
      EnemyType.AI_OVERLORD,
    ],
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
