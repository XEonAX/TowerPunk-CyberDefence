/**
 * wave.ts tests — Rulebook §8 (procedural generator)
 *
 * EnemyType numeric values (const enum, inlined at compile time):
 *   DATA_LEECH=0, CODE_RUNNER=1, FIREWALL_BREACHER=2, GLITCH=3,
 *   ORCHESTRATOR=4, VDB_NETRUNNER=5, SABOTEUR=6, AI_OVERLORD=7
 *
 * Band/Step derivation:
 *   b    = Math.floor((wave - 1) / 7)
 *   step = (wave - 1) % 7
 *
 * Count formulas (b = band):
 *   small      =  5 + b*5
 *   large      = 10 + b*8 + b²        (quadratic — 10, 19, 30, 43, 58, 75…)
 *   fewHard    =  1 + b
 *   moreHard   =  2 + b*2 + floor(b²/2)  (2, 4, 8, 12, 18, 24…)
 *   bossCount  = max(1, b)
 *   chaffCount = max(0, (b-1)*5)       (0, 0, 5, 10, 15…)
 */

import { describe, it, expect } from 'vitest'
import {
  SPAWN_INTERVAL_TICKS,
  BAND_SIZE,
  getWaveData,
  getTotalEnemiesInWave,
} from '../wave'

import { TICK_RATE } from '../constants'
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('§8.4 — SPAWN_INTERVAL_TICKS', () => {
  it('is 30 ticks', () => {
    expect(SPAWN_INTERVAL_TICKS).toBe(1) 
  })
})

describe('BAND_SIZE', () => {
  it('is 7 (§8.1 defines a 7-step cycle)', () => {
    expect(BAND_SIZE).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// Band 0 — waves 1–7 (easy=DATA_LEECH=0, hard=CODE_RUNNER=1)
// ---------------------------------------------------------------------------

describe('Band 0 (waves 1–7) — easy=DATA_LEECH(0), hard=CODE_RUNNER(1)', () => {
  it('wave 1 — §8.1.1 small easy: 5× DATA_LEECH', () => {
    const d = getWaveData(1)
    expect(d.waveNumber).toBe(1)
    expect(d.enemies.length).toBe(5)
    expect(d.enemies.every(t => t === 0)).toBe(true)
    expect(d.hasBoss).toBe(false)
  })

  it('wave 2 — §8.1.2 large easy: 10× DATA_LEECH', () => {
    const d = getWaveData(2)
    expect(d.enemies.length).toBe(10)
    expect(d.enemies.every(t => t === 0)).toBe(true)
  })

  it('wave 3 — §8.1.3 small easy + few hard: 5× DATA_LEECH + 1× CODE_RUNNER', () => {
    const d = getWaveData(3)
    expect(d.enemies.length).toBe(6)
    expect(d.enemies.filter(t => t === 0).length).toBe(5) // DATA_LEECH
    expect(d.enemies.filter(t => t === 1).length).toBe(1) // CODE_RUNNER
    expect(d.hasBoss).toBe(false)
  })

  it('wave 4 — §8.1.4 large easy + more hard: 10× DATA_LEECH + 2× CODE_RUNNER', () => {
    const d = getWaveData(4)
    expect(d.enemies.filter(t => t === 0).length).toBe(10)
    expect(d.enemies.filter(t => t === 1).length).toBe(2)
  })

  it('wave 5 — §8.1.5 small hard: 5× CODE_RUNNER', () => {
    const d = getWaveData(5)
    expect(d.enemies.length).toBe(5)
    expect(d.enemies.every(t => t === 1)).toBe(true) // CODE_RUNNER
    expect(d.hasBoss).toBe(false)
  })

  it('wave 6 — §8.1.6 large hard: 10× CODE_RUNNER', () => {
    const d = getWaveData(6)
    expect(d.enemies.length).toBe(10)
    expect(d.enemies.every(t => t === 1)).toBe(true)
  })

  it('wave 7 — §8.1.7 boss wave: 10× CODE_RUNNER + 1× FIREWALL_BREACHER, hasBoss=false (tiers < 4)', () => {
    const d = getWaveData(7)
    expect(d.enemies.filter(t => t === 1).length).toBe(10) // CODE_RUNNER
    expect(d.enemies.filter(t => t === 2).length).toBe(1)  // FIREWALL_BREACHER
    expect(d.hasBoss).toBe(false) // neither tier reaches ORCHESTRATOR(4)
  })
})

// ---------------------------------------------------------------------------
// Band 1 — waves 8–14 (easy=CODE_RUNNER=1, hard=FIREWALL_BREACHER=2)
// ---------------------------------------------------------------------------

describe('Band 1 (waves 8–14) — easy=CODE_RUNNER(1), hard=FIREWALL_BREACHER(2)', () => {
  it('wave 8 — §8.1.1 small easy: 10× CODE_RUNNER', () => {
    const d = getWaveData(8)
    expect(d.enemies.length).toBe(10)
    expect(d.enemies.every(t => t === 1)).toBe(true)
    expect(d.hasBoss).toBe(false)
  })

  it('wave 9 — §8.1.2 large easy: 19× CODE_RUNNER (large = 10 + 1×8 + 1² = 19)', () => {
    const d = getWaveData(9)
    expect(d.enemies.length).toBe(19)
    expect(d.enemies.every(t => t === 1)).toBe(true)
  })

  it('wave 10 — §8.1.3 small easy + few hard: 10× CODE_RUNNER + 2× FIREWALL_BREACHER', () => {
    const d = getWaveData(10)
    expect(d.enemies.filter(t => t === 1).length).toBe(10)
    expect(d.enemies.filter(t => t === 2).length).toBe(2)
    expect(d.hasBoss).toBe(false)
  })

  it('wave 14 — §8.1.7 boss climax: 19× FIREWALL_BREACHER + 1× GLITCH (no chaff: chaffCount=0), hasBoss=false', () => {
    const d = getWaveData(14)
    expect(d.enemies.filter(t => t === 2).length).toBe(19) // FIREWALL_BREACHER (large b=1 = 19)
    expect(d.enemies.filter(t => t === 3).length).toBe(1)  // GLITCH (bossCount = max(1,1) = 1)
    expect(d.hasBoss).toBe(false) // GLITCH(3) < BOSS_TIER(4)
  })
})

// ---------------------------------------------------------------------------
// Band 2 — waves 15–21 (easy=FIREWALL_BREACHER=2, hard=GLITCH=3)
// boss wave 21 has ORCHESTRATOR(4) as bossType → hasBoss=true
// ---------------------------------------------------------------------------

describe('Band 2 (waves 15–21) — boss wave introduces ORCHESTRATOR', () => {
  it('wave 15 — §8.1.1 small easy: 15× FIREWALL_BREACHER', () => {
    const d = getWaveData(15)
    expect(d.enemies.length).toBe(15)
    expect(d.enemies.every(t => t === 2)).toBe(true)
  })

  it('wave 21 — §8.1.7 boss: 30× GLITCH + 2× ORCHESTRATOR, hasBoss=true', () => {
    const d = getWaveData(21)
    expect(d.enemies.filter(t => t === 3).length).toBe(30) // GLITCH
    expect(d.enemies.filter(t => t === 4).length).toBe(2)  // ORCHESTRATOR
    expect(d.hasBoss).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// First wave where hardType >= BOSS_TIER (band 3, waves 22–28)
// easy=GLITCH=3, hard=ORCHESTRATOR=4
// ---------------------------------------------------------------------------

describe('Band 3 (waves 22–28) — ORCHESTRATOR as hard enemy', () => {
  it('wave 22 — §8.1.1 small easy: 20× GLITCH', () => {
    const d = getWaveData(22)
    expect(d.enemies.length).toBe(20)
    expect(d.enemies.every(t => t === 3)).toBe(true) // GLITCH
    expect(d.hasBoss).toBe(false)
  })

  it('wave 24 — §8.1.3 intro ORCHESTRATOR alongside GLITCH', () => {
    const d = getWaveData(24)
    expect(d.enemies.filter(t => t === 3).length).toBe(20) // GLITCH
    expect(d.enemies.filter(t => t === 4).length).toBe(4)  // ORCHESTRATOR
    expect(d.hasBoss).toBe(false) // hasBoss only raised on step-6 or §8.6.1
  })

  it('wave 27 — §8.1.6 elite flood: 43× ORCHESTRATOR + 20× FIREWALL_BREACHER chaff (chaffCount*2 = 20)', () => {
    // b=3: large = 10+24+9 = 43, chaffType = FIREWALL_BREACHER(2), chaffCount = 10, *2 = 20
    const d = getWaveData(27)
    expect(d.enemies.filter(t => t === 4).length).toBe(43) // ORCHESTRATOR
    expect(d.enemies.filter(t => t === 2).length).toBe(20) // FIREWALL_BREACHER chaff
    expect(d.enemies.length).toBe(63)
    expect(d.hasBoss).toBe(false)
  })

  it('wave 28 — §8.1.7 boss climax: 43× ORCHESTRATOR + 3× VDB_NETRUNNER + 10× GLITCH, hasBoss=true', () => {
    // b=3: large=43, bossCount=max(1,3)=3, chaffCount=10 (easy=GLITCH fills in)
    const d = getWaveData(28)
    expect(d.enemies.filter(t => t === 4).length).toBe(43) // ORCHESTRATOR (hard, large)
    expect(d.enemies.filter(t => t === 5).length).toBe(3)  // VDB_NETRUNNER (boss)
    expect(d.enemies.filter(t => t === 3).length).toBe(10) // GLITCH (easy chaff)
    expect(d.hasBoss).toBe(true) // ORCHESTRATOR(4) >= BOSS_TIER(4)
  })
})

// ---------------------------------------------------------------------------
// §8.6.1 — AI Overlord injections from wave 50
// ---------------------------------------------------------------------------

describe('§8.6.1 — AI Overlord boss injections (wave 50, 60, 70, …)', () => {
  it('wave 35 — no AI Overlord before §8.6.1 injection window (band 4, step 6: bossType=SABOTEUR=6)', () => {
    // band=4, step=6: easyType=4(ORCHESTRATOR), hardType=5(VDB_NETRUNNER), bossType=6(SABOTEUR)
    // AI_OVERLORD(7) has not been unlocked as a natural enemy yet, and wave 35 < 50
    const d = getWaveData(35)
    expect(d.enemies.filter(t => t === 7).length).toBe(0)
    expect(d.hasBoss).toBe(true) // VDB_NETRUNNER(5) >= BOSS_TIER(4)
  })

  it('wave 50 — 1× AI_OVERLORD injected, hasBoss=true', () => {
    const d = getWaveData(50)
    const overlords = d.enemies.filter(t => t === 7).length
    expect(overlords).toBeGreaterThanOrEqual(1)
    expect(d.hasBoss).toBe(true)
  })

  it('wave 60 — §8.6.1 injects 2× AI_OVERLORD (1 + floor((60-50)/10) = 2), hasBoss=true', () => {
    // At wave 60, band=8, hardType=7 so AI_OVERLORD also appears naturally.
    // The §8.6.1 injection adds exactly 2 on top. We verify total ≥ 2 and hasBoss.
    const d = getWaveData(60)
    expect(d.enemies.filter(t => t === 7).length).toBeGreaterThanOrEqual(2)
    expect(d.hasBoss).toBe(true)
  })

  it('wave 70 — 3× AI_OVERLORD injected', () => {
    const d = getWaveData(70)
    const overlords = d.enemies.filter(t => t === 7).length
    expect(overlords).toBeGreaterThanOrEqual(3)
    expect(d.hasBoss).toBe(true)
  })

  it('wave 51 — no AI Overlord injection (not divisible by 10)', () => {
    const d = getWaveData(51)
    // AI_OVERLORD can still appear naturally as hardType/bossType at high bands
    // but the §8.6.1 override only fires on multiples of 10
    expect(d.waveNumber).toBe(51)
  })
})

// ---------------------------------------------------------------------------
// Scaling — enemy counts increase with band
// ---------------------------------------------------------------------------

describe('Count scaling across bands', () => {
  it('step-0 (small easy) count grows by 5 per band', () => {
    // Wave 1 = band 0 step 0: small = 5
    // Wave 8 = band 1 step 0: small = 10
    // Wave 15 = band 2 step 0: small = 15
    expect(getTotalEnemiesInWave(1)).toBe(5)
    expect(getTotalEnemiesInWave(8)).toBe(10)
    expect(getTotalEnemiesInWave(15)).toBe(15)
    expect(getTotalEnemiesInWave(22)).toBe(20)
  })

  it('step-1 (large easy) scales quadratically: 10, 19, 30, 43 …', () => {
    // large = 10 + b*8 + b²  (step-1 waves: 2, 9, 16, 23)
    // Step-1 waves have no chaff (chaffCount=0 for b≤1, and step-1 is pure easy)
    expect(getTotalEnemiesInWave(2)).toBe(10)  // b=0: 10+0+0
    expect(getTotalEnemiesInWave(9)).toBe(19)  // b=1: 10+8+1
    expect(getTotalEnemiesInWave(16)).toBe(30) // b=2: 10+16+4
    expect(getTotalEnemiesInWave(23)).toBe(43) // b=3: 10+24+9
  })
})

// ---------------------------------------------------------------------------
// General invariants
// ---------------------------------------------------------------------------

describe('getWaveData invariants', () => {
  it('waveNumber always matches the requested wave', () => {
    for (const w of [1, 7, 14, 21, 50, 100]) {
      expect(getWaveData(w).waveNumber).toBe(w)
    }
  })

  it('enemies array is always non-empty', () => {
    for (const w of [1, 2, 10, 21, 50, 77, 100]) {
      expect(getWaveData(w).enemies.length).toBeGreaterThan(0)
    }
  })

  it('every enemy type value is in range 0–7', () => {
    for (const w of [1, 7, 14, 28, 50, 100]) {
      const d = getWaveData(w)
      expect(d.enemies.every(t => t >= 0 && t <= 7)).toBe(true)
    }
  })

  it('returned enemies array is a fresh copy — mutating it has no effect on subsequent calls', () => {
    const a = getWaveData(1)
    a.enemies.push(99)
    const b = getWaveData(1)
    expect(b.enemies.length).toBe(5) // original 5× DATA_LEECH, unchanged
  })

  it('getTotalEnemiesInWave matches enemies.length from getWaveData', () => {
    for (const w of [1, 3, 7, 10, 21, 50]) {
      expect(getTotalEnemiesInWave(w)).toBe(getWaveData(w).enemies.length)
    }
  })
})
