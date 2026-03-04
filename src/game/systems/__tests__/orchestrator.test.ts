/**
 * Orchestrator Enemy tests — §7.5.1
 *
 * When an Orchestrator dies it spawns a Blackwall Gateway at its death tile.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createEnemy,
  markForRemoval,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { cleanupSystem } from '../cleanup.system'
import { GATEWAY_HP } from '../../constants'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

describe('Orchestrator — §7.5.1: spawns Gateway on death', () => {
  it('creates a Gateway entity at the death tile when Orchestrator is cleaned up', () => {
    const eid = createEnemy(world)
    world.enemyType[eid] = C.EnemyType.ORCHESTRATOR
    world.tilePosX[eid] = 10
    world.tilePosY[eid] = 15
    world.enemyDamage[eid] = 100
    world.healthMax[eid] = 200
    world.healthCurrent[eid] = 0
    world.enemySpeed[eid] = 0.5
    world.enemyTier[eid] = 5
    world.enemiesAlive = 1

    markForRemoval(world, eid)

    const gwCountBefore = world.activeGatewayCount
    cleanupSystem(world)

    // One new Gateway must have been registered
    expect(world.activeGatewayCount).toBe(gwCountBefore + 1)

    // Find the gateway at the Orchestrator's tile
    let found = false
    for (let i = 0; i < world.activeGatewayCount; i++) {
      const gwEid = world.activeGateways[i]
      if (world.gatewayX[gwEid] === 10 && world.gatewayY[gwEid] === 15) {
        expect(world.gatewayHp[gwEid]).toBe(GATEWAY_HP)
        expect(world.gatewayMaxHp[gwEid]).toBe(GATEWAY_HP)
        expect(world.gatewayIsClosing[gwEid]).toBe(0)
        expect((world.bitmask[gwEid] & C.GATEWAY) !== 0).toBe(true)
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })

  it('still drops a resource pickup when Orchestrator dies (not at Core)', () => {
    const eid = createEnemy(world)
    world.enemyType[eid] = C.EnemyType.ORCHESTRATOR
    world.tilePosX[eid] = 10
    world.tilePosY[eid] = 15
    world.enemyDamage[eid] = 100
    world.healthMax[eid] = 200
    world.healthCurrent[eid] = 0
    world.enemySpeed[eid] = 0.5
    world.enemyTier[eid] = 5
    world.enemiesAlive = 1

    markForRemoval(world, eid)
    cleanupSystem(world)

    // A pickup should exist at the death tile
    const N = world.bitmask.length
    let pickupFound = false
    for (let peid = 1; peid < N; peid++) {
      if ((world.bitmask[peid] & C.PICKUP) !== 0) {
        if (world.posX[peid] === 10 && world.posY[peid] === 15) {
          pickupFound = true
          break
        }
      }
    }
    expect(pickupFound).toBe(true)
  })

  it('does NOT spawn a Gateway for non-Orchestrator enemies', () => {
    const eid = createEnemy(world)
    world.enemyType[eid] = C.EnemyType.DATA_LEECH
    world.tilePosX[eid] = 5
    world.tilePosY[eid] = 5
    world.enemyDamage[eid] = 5
    world.healthMax[eid] = 10
    world.healthCurrent[eid] = 0
    world.enemySpeed[eid] = 0.5
    world.enemyTier[eid] = 1
    world.enemiesAlive = 1

    markForRemoval(world, eid)

    const gwCountBefore = world.activeGatewayCount
    cleanupSystem(world)

    expect(world.activeGatewayCount).toBe(gwCountBefore)
  })
})
