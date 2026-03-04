/**
 * Pickup Layer — Tech.md §6.2, Rulebook §4.2
 *
 * Renders Eddie and Component pickup entities as colored circles.
 * Uses a Graphics object pool — zero allocations during active gameplay.
 */

import { Graphics, Container } from 'pixi.js'
import type { World } from '@game/ecs/world'
import * as C from '@game/ecs/component'
import { TILE_SIZE } from '../camera'

const MAX_ENTITIES = 4096

// Graphics object pool
const pool: Graphics[] = []
const active = new Map<number, Graphics>() // eid → Graphics

function acquire(): Graphics {
  return pool.pop() ?? new Graphics()
}

function release(g: Graphics): void {
  g.clear()
  g.visible = false
  pool.push(g)
}

/**
 * Update pickup layer each render frame.
 * @param container  The PixiJS Container for this layer.
 * @param world      Current ECS world (read-only in renderer).
 * @param _alpha     Interpolation factor — pickups are stationary.
 */
export function updatePickupLayer(container: Container, world: World, _alpha: number): void {
  // Release Graphics for removed pickups
  const toRelease: number[] = []
  for (const [eid, g] of active) {
    const mask = world.bitmask[eid]
    if (!(mask & C.PICKUP) || (mask & C.PENDING_REMOVAL)) {
      container.removeChild(g)
      release(g)
      toRelease.push(eid)
    }
  }
  for (const eid of toRelease) active.delete(eid)

  // Render each active pickup
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.PICKUP)) continue
    if (mask & C.PENDING_REMOVAL) continue

    let g = active.get(eid)
    if (!g) {
      g = acquire()
      g.visible = true
      container.addChild(g)
      active.set(eid, g)
    }

    // Rulebook §4.2: Eddies = gold, Components = blue, both = green
    const hasEddies = world.pickupEddies[eid] > 0
    const hasComponents = world.pickupComponents[eid] > 0
    const color = (hasEddies && hasComponents) ? 0xaaffaa
      : hasEddies                               ? 0xffdd00
      : hasComponents                           ? 0x4499ff
      : 0xffffff

    g.clear()
    g.setFillStyle({ color, alpha: 0.9 })
    g.circle(0, 0, 3)
    g.fill()

    // Center of tile
    g.x = world.posX[eid] * TILE_SIZE + TILE_SIZE / 2
    g.y = world.posY[eid] * TILE_SIZE + TILE_SIZE / 2
  }
}

/** @internal — exported for testing only */
export function _clearPickupPool(): void {
  active.clear()
  pool.length = 0
}
