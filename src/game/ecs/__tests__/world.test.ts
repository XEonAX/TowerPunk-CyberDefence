import { describe, it, expect } from 'vitest'
import { createWorld, markForRemoval, createEnemy, createTower, createPickup, createGateway } from '../world'
import * as C from '../component'

describe('createWorld', () => {
  it('returns a world with all arrays pre-allocated', () => {
    const world = createWorld(42)
    expect(world.bitmask).toBeInstanceOf(Uint32Array)
    expect(world.posX).toBeInstanceOf(Float32Array)
    expect(world.flowCost).toBeInstanceOf(Uint16Array)
    expect(world.gridBlocked).toBeInstanceOf(Uint8Array)
  })

  it('starts with correct initial resources (§4.3.1)', () => {
    const world = createWorld()
    expect(world.eddies).toBe(500)
    expect(world.components).toBe(5)
  })

  it('creates a Core entity with correct position and HP (§2.3, §3.3)', () => {
    const world = createWorld()
    const eid = world.coreEid
    expect(world.posX[eid]).toBe(25)
    expect(world.posY[eid]).toBe(25)
    expect(world.healthCurrent[eid]).toBe(100)
    expect(world.healthMax[eid]).toBe(100)
    expect(world.bitmask[eid] & C.POSITION).toBeTruthy()
    expect(world.bitmask[eid] & C.HEALTH).toBeTruthy()
  })
})

describe('createEnemy', () => {
  it('sets correct component bitmask', () => {
    const world = createWorld()
    const eid = createEnemy(world)
    const mask = world.bitmask[eid]
    expect(mask & C.TILE_POS).toBeTruthy()
    expect(mask & C.TILE_PROGRESS).toBeTruthy()
    expect(mask & C.PATH_STATE).toBeTruthy()
    expect(mask & C.SPAWN_IMMUNITY).toBeTruthy()
    expect(mask & C.HEALTH).toBeTruthy()
    expect(mask & C.ENEMY).toBeTruthy()
  })
})

describe('createTower', () => {
  it('sets correct component bitmask', () => {
    const world = createWorld()
    const eid = createTower(world)
    const mask = world.bitmask[eid]
    expect(mask & C.POSITION).toBeTruthy()
    expect(mask & C.HEALTH).toBeTruthy()
    expect(mask & C.TOWER).toBeTruthy()
  })
})

describe('createPickup', () => {
  it('sets correct bitmask', () => {
    const world = createWorld()
    const eid = createPickup(world)
    expect(world.bitmask[eid] & C.PICKUP).toBeTruthy()
  })
})

describe('createGateway', () => {
  it('sets correct bitmask', () => {
    const world = createWorld()
    const eid = createGateway(world)
    expect(world.bitmask[eid] & C.GATEWAY).toBeTruthy()
  })
})

describe('markForRemoval', () => {
  it('flags entity but does not destroy it immediately', () => {
    const world = createWorld()
    const eid = createEnemy(world)
    markForRemoval(world, eid)
    expect(world.bitmask[eid] & C.PENDING_REMOVAL).toBeTruthy()
    // entity still alive in pool
    expect(world.pool.isAlive(eid)).toBe(true)
  })
})
