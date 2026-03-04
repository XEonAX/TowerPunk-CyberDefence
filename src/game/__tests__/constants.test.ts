import { describe, it, expect } from 'vitest'
import {
  TICK_RATE,
  GRID_SIZE,
  CORE_X,
  CORE_Y,
  SPAWN_IMMUNITY_TICKS,
  CORE_STARTING_HP,
  INITIAL_EDDIES,
  INITIAL_COMPONENTS,
  ICE_WALL_COST,
  FIREWALL_COST,
  DATA_SPIKE_COST,
  DAEMON_TURRET_COST,
  ICE_SNIPER_COST,
  BLACKWALL_TOWER_COST,
  PING_TOWER_COST,
  HARVESTER_COST,
  ENEMY_DATA_LEECH,
  ENEMY_CODE_RUNNER,
  ENEMY_FIREWALL_BREACHER,
  ENEMY_GLITCH,
  ENEMY_ORCHESTRATOR,
  ENEMY_VDB_NETRUNNER,
  ENEMY_SABOTEUR,
  ENEMY_AI_OVERLORD,
  waveScaling,
  breakDuration,
  GATEWAY_HP,
  SKIP_BONUS_TICKS,
  ICE_SNIPER_MIN_RANGE,
  ICE_SNIPER_MAX_RANGE,
  ICE_SNIPER_SLOW_TICKS,
  ICE_SNIPER_DAMAGE,
  ICE_SNIPER_SLOW,
  ICE_SNIPER_COOLDOWN,
  FIREWALL_STUN_TICKS,
  MAX_TOWER_LEVEL,
  MAX_ABILITY_LEVEL,
  DAEMON_TURRET_RANGE,
  DAEMON_TURRET_HP,
} from '../constants'

describe('Rulebook §1.8 — simulation rate', () => {
  it('TICK_RATE === 60', () => expect(TICK_RATE).toBe(60))
})

describe('Rulebook §2 — grid', () => {
  it('GRID_SIZE === 51', () => expect(GRID_SIZE).toBe(51))
  it('CORE_X === 25 (0-indexed)', () => expect(CORE_X).toBe(25))
  it('CORE_Y === 25 (0-indexed)', () => expect(CORE_Y).toBe(25))
  it('SPAWN_IMMUNITY_TICKS === 30', () => expect(SPAWN_IMMUNITY_TICKS).toBe(30))
})

describe('Rulebook §3.3 — Core HP', () => {
  it('CORE_STARTING_HP === 100', () => expect(CORE_STARTING_HP).toBe(100))
})

describe('Rulebook §4.3.1 — initial resources', () => {
  it('INITIAL_EDDIES === 500', () => expect(INITIAL_EDDIES).toBe(500))
  it('INITIAL_COMPONENTS === 5', () => expect(INITIAL_COMPONENTS).toBe(5))
})

describe('Rulebook §5 — tower costs', () => {
  it('ICE Wall L1 costs 50 Eddies, 0 Components', () => {
    expect(ICE_WALL_COST[0]).toEqual([50, 0])
  })
  it('Firewall L1 costs 75 Eddies, 1 Component', () => {
    expect(FIREWALL_COST[0]).toEqual([75, 1])
  })
  it('Data Spike L1 costs 150 Eddies, 2 Components', () => {
    expect(DATA_SPIKE_COST[0]).toEqual([150, 2])
  })
  it('Daemon Turret L1 costs 0 Eddies, 5 Components', () => {
    expect(DAEMON_TURRET_COST[0]).toEqual([0, 5])
  })
  it('ICE Sniper L1 costs 0 Eddies, 10 Components', () => {
    expect(ICE_SNIPER_COST[0]).toEqual([0, 10])
  })
  it('Blackwall Tower L1 costs 0 Eddies, 20 Components', () => {
    expect(BLACKWALL_TOWER_COST[0]).toEqual([0, 20])
  })
  it('Ping Tower L1 costs 0 Eddies, 2 Components', () => {
    expect(PING_TOWER_COST[0]).toEqual([0, 2])
  })
  it('Harvester L1 costs 0 Eddies, 2 Components', () => {
    expect(HARVESTER_COST[0]).toEqual([0, 2])
  })
  it('MAX_TOWER_LEVEL === 10', () => expect(MAX_TOWER_LEVEL).toBe(10))
  it('MAX_ABILITY_LEVEL === 5', () => expect(MAX_ABILITY_LEVEL).toBe(5))
})

describe('Rulebook §5.1 — ICE Wall specific', () => {
  it('has 10 cost table entries', () => expect(ICE_WALL_COST.length).toBe(10))
})

describe('Rulebook §5.2 — Firewall specific', () => {
  it('FIREWALL_STUN_TICKS === 60', () => expect(FIREWALL_STUN_TICKS).toBe(60))
})

describe('Rulebook §5.5 — ICE Sniper specific', () => {
  it('ICE_SNIPER_MIN_RANGE === 3', () => expect(ICE_SNIPER_MIN_RANGE).toBe(3))
})

describe('Rulebook §7 — enemy stats', () => {
  it('Data Leech damage = 5', () => expect(ENEMY_DATA_LEECH.damage).toBe(5))
  it('Data Leech health = 10', () => expect(ENEMY_DATA_LEECH.health).toBe(10))
  it('Data Leech speed = 0.5 tiles/sec', () => expect(ENEMY_DATA_LEECH.speedPerSec).toBe(0.5))
  it('Code Runner damage = 10', () => expect(ENEMY_CODE_RUNNER.damage).toBe(10))
  it('Code Runner speed = 1.0 tiles/sec', () => expect(ENEMY_CODE_RUNNER.speedPerSec).toBe(1.0))
  it('Orchestrator damage = 100', () => expect(ENEMY_ORCHESTRATOR.damage).toBe(100))
  it('AI Overlord health = 1000', () => expect(ENEMY_AI_OVERLORD.health).toBe(1000))
  it('Saboteur disable duration = 300 ticks', () =>
    expect(ENEMY_SABOTEUR.disableDuration).toBe(300))
  it('Glitch tierMultiplier = 4', () => expect(ENEMY_GLITCH.tierMultiplier).toBe(4))
  it('Firewall Breacher tierMultiplier = 3', () =>
    expect(ENEMY_FIREWALL_BREACHER.tierMultiplier).toBe(3))
  it('VDB Netrunner health = 750', () => expect(ENEMY_VDB_NETRUNNER.health).toBe(750))
})

describe('Rulebook §8 — wave formulas', () => {
  it('waveScaling wave 0: 1.0× multiplier', () => {
    expect(waveScaling(10, 0)).toBeCloseTo(10)
  })
  it('waveScaling wave 9: 1.9× multiplier', () => {
    expect(waveScaling(10, 9)).toBeCloseTo(19)
  })
  it('breakDuration wave 10 = 1800', () => expect(breakDuration(10)).toBe(1800))
  it('breakDuration wave 40 = 60', () => expect(breakDuration(40)).toBe(60))
  it('breakDuration wave 50 = 60 (floor)', () => expect(breakDuration(50)).toBe(60))
  it('SKIP_BONUS_TICKS === 600', () => expect(SKIP_BONUS_TICKS).toBe(600))
})

describe('Rulebook §9.2.9 — Gateway HP', () => {
  it('GATEWAY_HP === 10000', () => expect(GATEWAY_HP).toBe(10000))
})

describe('Rulebook §5.4 — Daemon Turret range', () => {
  it('DAEMON_TURRET_RANGE has 10 entries (one per level)', () =>
    expect(DAEMON_TURRET_RANGE.length).toBe(10))
  it('DAEMON_TURRET_RANGE[0] === 1 (range stays 1 tile at L1)', () =>
    expect(DAEMON_TURRET_RANGE[0]).toBe(1))
  it('DAEMON_TURRET_RANGE[9] === 1 (range stays 1 tile at L10)', () =>
    expect(DAEMON_TURRET_RANGE[9]).toBe(1))
  it('DAEMON_TURRET_HP[0] === 100 (§5.4: 100 HP at L1)', () =>
    expect(DAEMON_TURRET_HP[0]).toBe(100))
})

describe('Rulebook §5.5 — ICE Sniper stats', () => {
  it('ICE_SNIPER_MAX_RANGE === 5', () => expect(ICE_SNIPER_MAX_RANGE).toBe(5))
  it('ICE_SNIPER_SLOW_TICKS === 120 (§5.5.3: 2 seconds)', () =>
    expect(ICE_SNIPER_SLOW_TICKS).toBe(120))
  it('ICE_SNIPER_DAMAGE[0] === 50 (L1 base damage)', () =>
    expect(ICE_SNIPER_DAMAGE[0]).toBe(50))
  it('ICE_SNIPER_DAMAGE[9] === 90 (L10 damage)', () =>
    expect(ICE_SNIPER_DAMAGE[9]).toBe(90))
  it('ICE_SNIPER_SLOW[0] === 0.20 (20% at L1)', () =>
    expect(ICE_SNIPER_SLOW[0]).toBeCloseTo(0.20))
  it('ICE_SNIPER_SLOW[9] === 0.70 (70% at L10)', () =>
    expect(ICE_SNIPER_SLOW[9]).toBeCloseTo(0.70))
  it('ICE_SNIPER_COOLDOWN[0] === 180 (§5.5: 180 ticks at L1)', () =>
    expect(ICE_SNIPER_COOLDOWN[0]).toBe(180))
  it('ICE_SNIPER_COOLDOWN[9] === 120 (L10 cooldown)', () =>
    expect(ICE_SNIPER_COOLDOWN[9]).toBe(120))
})
