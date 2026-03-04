/**
 * wave.ts tests — Rulebook §8
 */

import { describe, it, expect } from 'vitest'
import {
  SPAWN_INTERVAL_TICKS,
  WAVE_DEFINITIONS,
  getWaveData,
  getTotalEnemiesInWave,
} from '../wave'

// EnemyType numeric values (const enum inlined at compile time)
// DATA_LEECH=0, CODE_RUNNER=1, FIREWALL_BREACHER=2, GLITCH=3,
// ORCHESTRATOR=4, VDB_NETRUNNER=5, SABOTEUR=6, AI_OVERLORD=7

describe('Rulebook §8.4 — SPAWN_INTERVAL_TICKS', () => {
  it('SPAWN_INTERVAL_TICKS === 30', () => {
    expect(SPAWN_INTERVAL_TICKS).toBe(30)
  })
})

describe('WAVE_DEFINITIONS', () => {
  it('has exactly 10 entries', () => {
    expect(WAVE_DEFINITIONS.length).toBe(10)
  })

  it('wave 1 has 5 DATA_LEECH (type 0)', () => {
    const wave1 = WAVE_DEFINITIONS[0]
    expect(wave1.waveNumber).toBe(1)
    expect(wave1.enemies.length).toBe(5)
    expect(wave1.enemies.every(t => t === 0)).toBe(true) // EnemyType.DATA_LEECH = 0
    expect(wave1.hasBoss).toBe(false)
  })

  it('wave 10 has 1× ORCHESTRATOR (§8.7)', () => {
    const wave10 = WAVE_DEFINITIONS[9]
    expect(wave10.waveNumber).toBe(10)
    expect(wave10.enemies.length).toBe(1)
    const orchestrators = wave10.enemies.filter(t => t === 4).length // EnemyType.ORCHESTRATOR = 4
    expect(orchestrators).toBe(1)
    expect(wave10.hasBoss).toBe(true)
  })

  it('wave 5 has no boss (§8.7: DATA_LEECH + CODE_RUNNER + FIREWALL_BREACHER)', () => {
    expect(WAVE_DEFINITIONS[4].hasBoss).toBe(false)
  })

  it('wave 7 has 50 DATA_LEECH (§8.7)', () => {
    const wave7 = WAVE_DEFINITIONS[6]
    expect(wave7.enemies.length).toBe(50)
    expect(wave7.enemies.every(t => t === 0)).toBe(true) // EnemyType.DATA_LEECH = 0
  })

  it('wave 8 has 20 CODE_RUNNER then 20 FIREWALL_BREACHER (§8.7)', () => {
    const wave8 = WAVE_DEFINITIONS[7]
    expect(wave8.enemies.length).toBe(40)
    const codeRunners = wave8.enemies.filter(t => t === 1).length   // CODE_RUNNER = 1
    const breachers  = wave8.enemies.filter(t => t === 2).length    // FIREWALL_BREACHER = 2
    expect(codeRunners).toBe(20)
    expect(breachers).toBe(20)
    expect(wave8.hasBoss).toBe(false)
  })
})

describe('getWaveData', () => {
  it('returns correct data for wave 1', () => {
    const data = getWaveData(1)
    expect(data.waveNumber).toBe(1)
    expect(data.enemies.length).toBe(5)
    expect(data.enemies.every(t => t === 0)).toBe(true) // DATA_LEECH
  })

  it('getWaveData(11) returns waveNumber=11 with wave 10 composition', () => {
    const wave10 = getWaveData(10)
    const wave11 = getWaveData(11)
    expect(wave11.waveNumber).toBe(11)
    // Same composition as wave 10
    expect(wave11.enemies.length).toBe(wave10.enemies.length)
    expect(wave11.enemies).toEqual(wave10.enemies)
    expect(wave11.hasBoss).toBe(wave10.hasBoss)
  })

  it('getWaveData returns a copy — mutating does not affect WAVE_DEFINITIONS', () => {
    const data = getWaveData(1)
    data.enemies.push(99)
    expect(WAVE_DEFINITIONS[0].enemies.length).toBe(5)
  })
})

describe('getTotalEnemiesInWave', () => {
  it('wave 1 has 5 enemies', () => {
    expect(getTotalEnemiesInWave(1)).toBe(5)
  })

  it('wave 10 has 1 enemy (1 Orchestrator per §8.7)', () => {
    expect(getTotalEnemiesInWave(10)).toBe(1)
  })

  it('wave 15 (>10) has same count as wave 10', () => {
    expect(getTotalEnemiesInWave(15)).toBe(getTotalEnemiesInWave(10))
  })
})
