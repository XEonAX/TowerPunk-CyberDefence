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

  it('wave 10 has 5× ORCHESTRATOR + 2× SABOTEUR + 3× AI_OVERLORD = 10 enemies', () => {
    const wave10 = WAVE_DEFINITIONS[9]
    expect(wave10.waveNumber).toBe(10)
    expect(wave10.enemies.length).toBe(10)
    const orchestrators = wave10.enemies.filter(t => t === 4).length // EnemyType.ORCHESTRATOR = 4
    const saboteurs = wave10.enemies.filter(t => t === 6).length     // EnemyType.SABOTEUR = 6
    const overlords = wave10.enemies.filter(t => t === 7).length     // EnemyType.AI_OVERLORD = 7
    expect(orchestrators).toBe(5)
    expect(saboteurs).toBe(2)
    expect(overlords).toBe(3)
    expect(wave10.hasBoss).toBe(true)
  })

  it('wave 5 has a boss (ORCHESTRATOR mini-boss)', () => {
    expect(WAVE_DEFINITIONS[4].hasBoss).toBe(true)
  })

  it('wave 8 boss order has ORCHESTRATOR at end', () => {
    const wave8 = WAVE_DEFINITIONS[7]
    const lastTwo = wave8.enemies.slice(-2)
    expect(lastTwo.every(t => t === 4)).toBe(true) // EnemyType.ORCHESTRATOR = 4
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

  it('wave 10 has 10 enemies', () => {
    expect(getTotalEnemiesInWave(10)).toBe(10)
  })

  it('wave 15 (>10) has same count as wave 10', () => {
    expect(getTotalEnemiesInWave(15)).toBe(getTotalEnemiesInWave(10))
  })
})
