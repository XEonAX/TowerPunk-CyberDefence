/**
 * Cleanup System tests — §1.10.12
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createEnemy,
  createTower,
  createGateway,
  markForRemoval,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { cleanupSystem } from '../cleanup.system'

let world: World

beforeEach(() => {
  world = createWorld(42)
})

describe('entity lifecycle', () => {
  it('entity NOT marked for removal is unaffected by cleanup', () => {
    const eid = createEnemy(world)
    world.tilePosX[eid] = 5
    world.tilePosY[eid] = 5
    world.enemySpeed[eid] = 1
    world.enemyTier[eid] = 1
    world.enemyDamage[eid] = 5
    world.healthMax[eid] = 10
    world.healthCurrent[eid] = 10

    cleanupSystem(world)

    // Entity should still be alive
    expect(world.pool.isAlive(eid)).toBe(true)
    expect(world.bitmask[eid] & C.ENEMY).toBeTruthy()
  })

  it('entity marked for removal is destroyed after cleanup', () => {
    const eid = createEnemy(world)
    world.tilePosX[eid] = 5
    world.tilePosY[eid] = 5
    world.enemySpeed[eid] = 1
    world.enemyTier[eid] = 1
    world.enemyDamage[eid] = 5
    world.healthMax[eid] = 10
    world.healthCurrent[eid] = 10
    markForRemoval(world, eid)
    world.enemiesAlive = 1

    cleanupSystem(world)

    expect(world.pool.isAlive(eid)).toBe(false)
    expect(world.bitmask[eid]).toBe(0)
  })

  it('removalQueue is reset after cleanup', () => {
    const eid = createEnemy(world)
    markForRemoval(world, eid)

    cleanupSystem(world)

    expect(world.removalQueueLen).toBe(0)
  })

  it('multiple entities in queue are all destroyed', () => {
    const eid1 = createEnemy(world)
    const eid2 = createEnemy(world)
    markForRemoval(world, eid1)
    markForRemoval(world, eid2)
    world.enemiesAlive = 2

    cleanupSystem(world)

    expect(world.pool.isAlive(eid1)).toBe(false)
    expect(world.pool.isAlive(eid2)).toBe(false)
    expect(world.enemiesAlive).toBe(0)
  })
})

describe('enemy death — resource drops', () => {
  it('enemy death creates a pickup entity at death tile', () => {
    const eid = createEnemy(world)
    world.tilePosX[eid] = 7
    world.tilePosY[eid] = 8
    world.enemyType[eid] = 0   // DATA_LEECH
    world.enemyTier[eid] = 1
    world.enemyDamage[eid] = 5
    world.healthMax[eid] = 10
    world.enemySpeed[eid] = 0.5  // tiles/sec
    world.enemiesAlive = 1
    markForRemoval(world, eid)

    cleanupSystem(world)

    // A pickup should have been created
    let pickupFound = false
    for (let peid = 1; peid < world.bitmask.length; peid++) {
      if ((world.bitmask[peid] & C.PICKUP) !== 0) {
        pickupFound = true
        expect(world.posX[peid]).toBe(7)
        expect(world.posY[peid]).toBe(8)
        break
      }
    }
    expect(pickupFound).toBe(true)
  })

  it('enemy reaching Core (§3.4) does NOT drop a pickup', () => {
    // Simulate enemy at Core tile — movementSystem places them there before marking
    // for removal so we replicate that here.
    const eid = createEnemy(world)
    // Place at Core tile (§2.9: CORE_X=25, CORE_Y=25)
    world.tilePosX[eid] = 25  // CORE_X
    world.tilePosY[eid] = 25  // CORE_Y
    world.enemyType[eid] = 0
    world.enemyTier[eid] = 1
    world.enemyDamage[eid] = 5
    world.healthMax[eid] = 10
    world.enemySpeed[eid] = 0.5
    world.enemiesAlive = 1
    markForRemoval(world, eid)

    cleanupSystem(world)

    // No pickup should exist other than any pre-existing entities
    let pickupFound = false
    for (let peid = 1; peid < world.bitmask.length; peid++) {
      if ((world.bitmask[peid] & C.PICKUP) !== 0) {
        pickupFound = true
        break
      }
    }
    expect(pickupFound).toBe(false)
  })

  it('enemiesAlive decrements on enemy death', () => {
    const eid = createEnemy(world)
    world.tilePosX[eid] = 3
    world.tilePosY[eid] = 3
    world.enemySpeed[eid] = 0.5
    world.enemyTier[eid] = 1
    world.enemyDamage[eid] = 5
    world.healthMax[eid] = 10
    world.enemiesAlive = 3
    markForRemoval(world, eid)

    cleanupSystem(world)

    expect(world.enemiesAlive).toBe(2)
  })
})

describe('Firewall cascade — §5.2.4', () => {
  it('destroying one Firewall tower also marks its partner for removal', () => {
    const fw1 = createTower(world, C.FIREWALL_LINK)
    const fw2 = createTower(world, C.FIREWALL_LINK)
    world.firewallPartner[fw1] = fw2
    world.firewallPartner[fw2] = fw1

    // Destroy only fw1
    markForRemoval(world, fw1)

    cleanupSystem(world)

    // Both should be destroyed
    expect(world.pool.isAlive(fw1)).toBe(false)
    expect(world.pool.isAlive(fw2)).toBe(false)
  })
})

describe('gateway removal', () => {
  it('removing a gateway entity removes it from activeGateways', () => {
    const geid = createGateway(world)
    world.gatewayX[geid] = 0
    world.gatewayY[geid] = 0
    world.activeGateways[0] = geid
    world.activeGatewayCount = 1

    markForRemoval(world, geid)

    cleanupSystem(world)

    expect(world.activeGatewayCount).toBe(0)
    expect(world.pool.isAlive(geid)).toBe(false)
  })
})
