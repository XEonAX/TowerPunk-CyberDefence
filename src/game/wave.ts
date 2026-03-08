/**
 * Wave Generator — Rulebook §8
 *
 * Waves are generated procedurally for every wave number using the §8.1
 * seven-step escalation cycle. EnemyType enum values are difficulty tiers:
 *
 *   0 DATA_LEECH · 1 CODE_RUNNER · 2 FIREWALL_BREACHER · 3 GLITCH
 *   4 ORCHESTRATOR · 5 VDB_NETRUNNER · 6 SABOTEUR · 7 AI_OVERLORD
 *
 * Every 7 waves form one **band**. Each band promotes the previous hard
 * tier to easy and introduces the next EnemyType as the new threat.
 *
 * Enemy counts grow **quadratically** with band — early waves are small and
 * learnable; late waves are overwhelming floods that demand full defences.
 *
 * **Chaff mixing** (band ≥ 2): lower-tier enemies are sprinkled into mid/late
 * steps to create visual chaos and stress test multi-target defences.
 *
 * AI Overlord boss injections follow §8.6.1 (every 10 waves from wave 50).
 *
 * Count formulas (b = band):
 *   small      =  5 + b×5                        →   5, 10, 15, 20, 25 …
 *   large      = 10 + b×8 + b²                   →  10, 19, 30, 43, 58, 75 …
 *   fewHard    =  1 + b                           →   1,  2,  3,  4,  5 …
 *   moreHard   =  2 + b×2 + ⌊b²/2⌋              →   2,  4,  8, 12, 18, 24 …
 *   bossCount  = max(1, b)                        →   1,  1,  2,  3,  4 …
 *   chaffCount = max(0, (b−1)×5)                 →   0,  0,  5, 10, 15, 20 …
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
export const SPAWN_INTERVAL_TICKS = 1 // spawn one enemy per tick for maximum pacing; can be increased for testing

/**
 * Number of wave steps per escalation band (§8.1).
 * Steps 0–6 map to §8.1.1 – §8.1.7.
 */
export const BAND_SIZE = 7

/**
 * EnemyType value at and above which an enemy is considered a named boss
 * for the hasBoss flag (Orchestrator = 4, AI Overlord = 7).
 */
const BOSS_TIER = 4 // EnemyType.ORCHESTRATOR

// ---------------------------------------------------------------------------
// WaveData interface
// ---------------------------------------------------------------------------

export interface WaveData {
  /** 1-indexed wave number (used for stat scaling via §8.4.1). */
  waveNumber: number
  /** Ordered list of EnemyType enum values, one entry per enemy to spawn. */
  enemies: number[]
  /** True when the wave contains a named boss (Orchestrator or AI Overlord). */
  hasBoss: boolean
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a repeating enemy-type array. Not called in the tick hot path. */
function rpt(type: number, n: number): number[] {
  const arr: number[] = []
  for (let i = 0; i < n; i++) arr.push(type)
  return arr
}

// ---------------------------------------------------------------------------
// Procedural wave generator
// ---------------------------------------------------------------------------

/**
 * Generate WaveData for any wave number ≥ 1.
 *
 * Band  = floor((wave − 1) / BAND_SIZE)   — 0-indexed difficulty band
 * Step  = (wave − 1) % BAND_SIZE          — position in §8.1 cycle (0–6)
 *
 * Step compositions (easy/hard/boss shift each band; chaff is one tier below easy):
 *
 *   Step 0 §8.1.1 — breather:     small easy
 *   Step 1 §8.1.2 — flood:        large easy
 *   Step 2 §8.1.3 — first glimpse: small easy + fewHard hard + chaff
 *   Step 3 §8.1.4 — pressure:     large easy + moreHard hard + chaff
 *   Step 4 §8.1.5 — elite sprint: small hard + chaff
 *   Step 5 §8.1.6 — elite flood:  large hard + 2× chaff
 *   Step 6 §8.1.7 — boss climax:  large hard + bossCount boss + chaff easy
 */
export function getWaveData(wave: number): WaveData {
  const b    = Math.floor((wave - 1) / BAND_SIZE)
  const step = (wave - 1) % BAND_SIZE

  const easyType  = Math.min(b,     6) // DATA_LEECH(0) … SABOTEUR(6)
  const hardType  = Math.min(b + 1, 7) // CODE_RUNNER(1) … AI_OVERLORD(7)
  const bossType  = Math.min(b + 2, 7) // FIREWALL_BREACHER(2) … AI_OVERLORD(7)
  const chaffType = Math.max(0, b - 1) // one tier below easy; used as filler noise

  // Quadratic count scaling — gentle start, overwhelming finish
  const small      = 5 + b * 5                          //  5, 10, 15, 20, 25 …
  const large      = 10 + b * 8 + b * b                 // 10, 19, 30, 43, 58, 75 …
  const fewHard    = 1 + b                              //  1,  2,  3,  4,  5 …
  const moreHard   = 2 + b * 2 + Math.floor(b * b / 2) //  2,  4,  8, 12, 18, 24 …
  const bossCount  = Math.max(1, b)                     //  1,  1,  2,  3,  4 …
  const chaffCount = Math.max(0, (b - 1) * 5)           //  0,  0,  5, 10, 15 …

  let enemies: number[]
  let hasBoss = false

  switch (step) {
    case 0: // §8.1.1 breather — small easy only
      enemies = rpt(easyType, small)
      break

    case 1: // §8.1.2 flood — large easy only
      enemies = rpt(easyType, large)
      break

    case 2: // §8.1.3 first glimpse — small easy + few hard + chaff noise
      enemies = [
        ...rpt(easyType, small),
        ...rpt(hardType, fewHard),
        ...rpt(chaffType, chaffCount),
      ]
      break

    case 3: // §8.1.4 pressure — large easy + more hard + chaff noise
      enemies = [
        ...rpt(easyType, large),
        ...rpt(hardType, moreHard),
        ...rpt(chaffType, chaffCount),
      ]
      break

    case 4: // §8.1.5 elite sprint — small hard + chaff noise
      enemies = [
        ...rpt(hardType, small),
        ...rpt(chaffType, chaffCount),
      ]
      break

    case 5: // §8.1.6 elite flood — large hard + heavy chaff for visual chaos
      enemies = [
        ...rpt(hardType, large),
        ...rpt(chaffType, chaffCount * 2),
      ]
      break

    default: { // §8.1.7 boss climax — hard bulk + boss pack + easy flood
      enemies = [
        ...rpt(hardType, large),
        ...rpt(bossType, bossCount),
        ...rpt(easyType, chaffCount), // easy flood makes the boss harder to reach
      ]
      hasBoss = hardType >= BOSS_TIER || bossType >= BOSS_TIER
      break
    }
  }

  // §8.6.1 — AI Overlord appears every 10 waves from wave 50 (50, 60, 70 …)
  // Count grows by 1 each decade: 1 at wave 50, 2 at wave 60, 3 at wave 70 …
  if (wave >= 50 && wave % 10 === 0) {
    const overlordCount = 1 + Math.floor((wave - 50) / 10)
    for (let i = 0; i < overlordCount; i++) {
      enemies.push(EnemyType.AI_OVERLORD as number)
    }
    hasBoss = true
  }

  return { waveNumber: wave, enemies, hasBoss }
}

/**
 * Return the total number of enemies that will spawn in a given wave.
 */
export function getTotalEnemiesInWave(wave: number): number {
  return getWaveData(wave).enemies.length
}
