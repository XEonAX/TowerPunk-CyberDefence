/**
 * Enemy Layer — Tech.md §6.2, Rulebook §2.10.4–2.10.8
 *
 * Renders enemy entities with smooth motion interpolation via computeEnemyMotion.
 * Uses a Graphics object pool — zero allocations during active gameplay.
 */

import { Graphics, Container } from 'pixi.js'
import type { World } from '@game/ecs/world'
import * as C from '@game/ecs/component'
import { computeEnemyMotion } from '../enemyMotion'

/** Rulebook §7 — colors per enemy type */
const ENEMY_COLORS: Record<number, number> = {
  [C.EnemyType.DATA_LEECH]:          0xff4444, // red
  [C.EnemyType.CODE_RUNNER]:         0xff8800, // orange
  [C.EnemyType.FIREWALL_BREACHER]:   0x88ff00, // green
  [C.EnemyType.GLITCH]:              0xaa00ff, // purple
  [C.EnemyType.ORCHESTRATOR]:        0xff00aa, // pink
  [C.EnemyType.VDB_NETRUNNER]:       0x0088ff, // blue
  [C.EnemyType.SABOTEUR]:            0xffff00, // yellow
  [C.EnemyType.AI_OVERLORD]:         0xff2200, // bright red (boss)
}

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
 * Update enemy layer each render frame.
 * @param container  The PixiJS Container for this layer.
 * @param world      Current ECS world (read-only in renderer).
 * @param _alpha     Interpolation factor — not currently used (progress is simulation-side).
 */
export function updateEnemyLayer(container: Container, world: World, _alpha: number): void {
  // Release Graphics for entities that are no longer active enemies
  const toRelease: number[] = []
  for (const [eid, g] of active) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY) || (mask & C.PENDING_REMOVAL)) {
      container.removeChild(g)
      release(g)
      toRelease.push(eid)
    }
  }
  for (const eid of toRelease) active.delete(eid)

  // Render each active enemy
  for (let eid = 1; eid < MAX_ENTITIES; eid++) {
    const mask = world.bitmask[eid]
    if (!(mask & C.ENEMY)) continue
    if (mask & C.PENDING_REMOVAL) continue

    let g = active.get(eid)
    if (!g) {
      g = acquire()
      g.visible = true
      container.addChild(g)
      active.set(eid, g)
    }

    // Compute visual position via motion interpolation (Rulebook §2.10.4–2.10.8)
    const motion = computeEnemyMotion(
      world.pathFromX[eid],
      world.pathFromY[eid],
      world.pathToX[eid],
      world.pathToY[eid],
      world.tilePosX[eid],
      world.tilePosY[eid],
      world.tileProgress[eid],
      world.pathMoveState[eid],
      world.pathDir[eid],
      world.pathPrevDir[eid],
    )

    const enemyType = world.enemyType[eid]
    const color = ENEMY_COLORS[enemyType] ?? 0xffffff
    const isBoss = enemyType === C.EnemyType.AI_OVERLORD
    const size = isBoss ? 10 : 6
    const half = size / 2

    g.clear()

    // Body rectangle centered on origin (rotation pivots around center)
    g.setFillStyle({ color, alpha: 1 })
    g.rect(-half, -half, size, size)
    g.fill()

    // HP bar — drawn in local space above the body
    const maxHp = world.healthMax[eid]
    if (maxHp > 0) {
      const hpFrac = Math.max(0, world.healthCurrent[eid] / maxHp)
      // Background
      g.setFillStyle({ color: 0x222222, alpha: 0.8 })
      g.rect(-half, -half - 3, size, 2)
      g.fill()
      // Foreground
      g.setFillStyle({ color: 0x00ff44, alpha: 1 })
      g.rect(-half, -half - 3, size * hpFrac, 2)
      g.fill()
    }

    g.x = motion.renderX
    g.y = motion.renderY
    g.rotation = (motion.angleDeg * Math.PI) / 180
  }
}

/** @internal — exported for testing only */
export function _clearEnemyPool(): void {
  active.clear()
  pool.length = 0
}
