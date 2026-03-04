/**
 * Saboteur Enemy tests — §7.7.1
 *
 * The Saboteur emits a disable pulse every 600 ticks that queues a tower-disable
 * on all towers within Chebyshev 1 tile for 300 ticks.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createEnemy,
  createTower,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { enemyAuraSystem } from '../enemyAura.system'
import {
  SABOTEUR_PULSE_INTERVAL_TICKS,
  SABOTEUR_DISABLE_DURATION_TICKS,
} from '../../constants'

let world: World

/** Create a fully active (no spawn immunity) Saboteur at (sx, sy). */
function makeSaboteur(sx: number, sy: number): number {
  const eid = createEnemy(world)
  world.enemyType[eid] = C.EnemyType.SABOTEUR
  world.tilePosX[eid] = sx
  world.tilePosY[eid] = sy
  world.enemyDamage[eid] = 20
  world.healthMax[eid] = 500
  world.healthCurrent[eid] = 500
  // Remove spawn immunity so the aura system processes this entity
  world.bitmask[eid] &= ~C.SPAWN_IMMUNITY
  return eid
}

/** Create a tower at pixel/tile position (tx, ty). */
function makeTower(tx: number, ty: number): number {
  const teid = createTower(world)
  world.posX[teid] = tx
  world.posY[teid] = ty
  world.towerType[teid] = C.TowerType.DAEMON_TURRET
  world.towerLevel[teid] = 1
  return teid
}

beforeEach(() => {
  world = createWorld(42)
  world.tickCount = 1  // non-zero to distinguish from "never pulsed"
})

describe('Saboteur — §7.7.1: disable pulse', () => {
  it('queues disable on adjacent tower (Chebyshev 1) when pulsing', () => {
    const seid = makeSaboteur(5, 5)
    const teid = makeTower(5, 6)  // directly south — Chebyshev 1

    enemyAuraSystem(world)

    expect(world.statusDisableQueueLen).toBeGreaterThan(0)
    // First entry: eid=teid, ticks=300
    const base = 0
    expect(world.statusDisableQueue[base]).toBe(teid)
    expect(world.statusDisableQueue[base + 1]).toBe(SABOTEUR_DISABLE_DURATION_TICKS)
  })

  it('queues disable on diagonally adjacent tower (Chebyshev 1)', () => {
    const seid = makeSaboteur(5, 5)
    const teid = makeTower(6, 6)  // diagonal — Chebyshev distance is 1

    enemyAuraSystem(world)

    expect(world.statusDisableQueueLen).toBeGreaterThan(0)
    expect(world.statusDisableQueue[0]).toBe(teid)
  })

  it('does NOT disable tower at Chebyshev 2 (out of range)', () => {
    makeSaboteur(5, 5)
    makeTower(5, 7)  // Chebyshev 2 — out of range

    enemyAuraSystem(world)

    expect(world.statusDisableQueueLen).toBe(0)
  })

  it('does NOT disable tower at Chebyshev 5 (far away)', () => {
    makeSaboteur(5, 5)
    makeTower(5, 10)  // Chebyshev 5 — out of range

    enemyAuraSystem(world)

    expect(world.statusDisableQueueLen).toBe(0)
  })

  it('does NOT pulse again before the interval expires', () => {
    // Use tickCount well above 0 to avoid Uint32 wrap issues
    world.tickCount = SABOTEUR_PULSE_INTERVAL_TICKS - 1  // 599
    const seid = makeSaboteur(5, 5)
    makeTower(5, 6)

    // Pulsed at tick 1: elapsed = 599 - 1 = 598 < 600 → should NOT pulse
    world.saboteurPulseTick[seid] = 1

    enemyAuraSystem(world)

    expect(world.statusDisableQueueLen).toBe(0)
  })

  it('pulses again after full interval has elapsed', () => {
    // Use tickCount well above 600 so arithmetic stays positive
    world.tickCount = SABOTEUR_PULSE_INTERVAL_TICKS + 50  // 650
    const seid = makeSaboteur(5, 5)
    makeTower(5, 6)

    // Pulsed at tick 50: elapsed = 650 - 50 = 600 >= 600 → should pulse
    world.saboteurPulseTick[seid] = 50

    enemyAuraSystem(world)

    expect(world.statusDisableQueueLen).toBeGreaterThan(0)
  })

  it('records the pulse tick after firing', () => {
    const seid = makeSaboteur(5, 5)
    makeTower(5, 6)

    world.tickCount = 500

    enemyAuraSystem(world)

    expect(world.saboteurPulseTick[seid]).toBe(500)
  })

  it('does NOT pulse while spawn immunity is active', () => {
    const eid = createEnemy(world)
    world.enemyType[eid] = C.EnemyType.SABOTEUR
    world.tilePosX[eid] = 5
    world.tilePosY[eid] = 5
    // Keep spawn immunity flag ON
    expect((world.bitmask[eid] & C.SPAWN_IMMUNITY) !== 0).toBe(true)

    makeTower(5, 6)

    enemyAuraSystem(world)

    expect(world.statusDisableQueueLen).toBe(0)
  })
})
