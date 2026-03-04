/**
 * Movement System — §1.10.5
 *
 * Advances per-tile progress for all active enemies and transitions them
 * between tiles following the flowfield (§2.10.2–2.10.3).
 *
 * Status effect interactions (§7.0.10–7.0.13):
 *  - STUN: enemy is fully stopped; no progress advancement.
 *  - SLOW: enemy speed reduced by slowMagnitude fraction.
 *
 * Core damage (§3.4): when an enemy enters the Core tile it deals its full
 * damage value and is marked for deferred removal.
 *
 * NOTE: §2.10.4–2.10.8 (edge-to-edge visual motion, arc curves, progress
 * factors) are rendering-only concerns handled in renderer/enemyMotion.ts.
 */

import { markForRemoval, spawnInteriorGateway, type World } from '../ecs/world'
import * as C from '../ecs/component'
import { CORE_X, CORE_Y, TICK_RATE, AI_OVERLORD_SPAWN_EVERY_N_TILES } from '../constants'
import { idx } from '../pathfinding/grid'
import { spawnEnemyAtTile } from './spawn.system'

/** Tile delta [dx, dy] for each Dir value (§2.10.5). Dir: N=0, S=1, E=2, W=3. */
const DIR_DX: readonly number[] = [0, 0, 1, -1]   // N, S, E, W
const DIR_DY: readonly number[] = [-1, 1, 0, 0]   // N, S, E, W

export function movementSystem(world: World): void {
  // Iterate all possible entity slots; alive entities have non-zero bitmask.
  // Cleanup system resets bitmask to 0 on destroy, so this is safe.
  const N = world.bitmask.length

  for (let eid = 1; eid < N; eid++) {
    const mask = world.bitmask[eid]

    // Must have ENEMY component
    if ((mask & C.ENEMY) === 0) continue
    // Skip if pending removal
    if ((mask & C.PENDING_REMOVAL) !== 0) continue
    // §2.10.1: Skip during spawn immunity window
    if ((mask & C.SPAWN_IMMUNITY) !== 0) continue

    // §7.0.11: Stunned enemies cannot move
    if ((mask & C.STUN) !== 0 && world.stunTicks[eid] > 0) continue

    // Compute effective speed (tiles/sec)
    let speed = world.enemySpeed[eid]  // stored as tiles/sec at spawn

    // §7.0.10: Apply slow if active
    if ((mask & C.SLOW) !== 0 && world.slowTicks[eid] > 0) {
      speed *= (1 - world.slowMagnitude[eid])
    }

    // §2.10.2: Advance per-tile progress
    world.tileProgress[eid] += speed / TICK_RATE

    // §2.10.2: When progress >= 1.0, move to next tile
    if (world.tileProgress[eid] >= 1.0) {
      world.tileProgress[eid] -= 1.0

      const tx = world.tilePosX[eid]
      const ty = world.tilePosY[eid]
      const tileIndex = idx(tx, ty)

      // Glitch uses glitch flowfield (§7.4.1)
      const isGlitch = world.enemyType[eid] === 3 // EnemyType.GLITCH = 3
      const dir = isGlitch ? world.glitchDir[tileIndex] : world.flowDir[tileIndex]

      // DIR_NONE (0xff) means at Core or unreachable — mark for removal
      if (dir === 0xff) {
        markForRemoval(world, eid)
        continue
      }

      const nx = (tx + DIR_DX[dir]) | 0
      const ny = (ty + DIR_DY[dir]) | 0

      // §3.4: Enemy entering Core tile deals damage and is removed
      if (nx === CORE_X && ny === CORE_Y) {
        world.healthCurrent[world.coreEid] -= world.enemyDamage[eid]
        markForRemoval(world, eid)
        // Enemies reaching Core do NOT drop pickups (§7.0.7)
        continue
      }

      // Update tile position (§2.10.3: enemy is "on" the tile it last entered)
      world.tilePosX[eid] = nx
      world.tilePosY[eid] = ny

      // §7.8.2/7.8.4/7.8.6: AI Overlord spawns an entity every 5 tiles walked
      if (world.enemyType[eid] === C.EnemyType.AI_OVERLORD) {
        world.aiOverlordTilesTraveled[eid]++
        if (world.aiOverlordTilesTraveled[eid] % AI_OVERLORD_SPAWN_EVERY_N_TILES === 0) {
          const phase  = world.aiOverlordPhase[eid]
          const spawnX = world.tilePosX[eid]
          const spawnY = world.tilePosY[eid]
          if (phase === 1) {
            spawnInteriorGateway(world, spawnX, spawnY)         // §7.8.2
          } else if (phase === 2) {
            spawnEnemyAtTile(world, C.EnemyType.GLITCH, spawnX, spawnY)       // §7.8.4
          } else if (phase === 3) {
            spawnEnemyAtTile(world, C.EnemyType.ORCHESTRATOR, spawnX, spawnY) // §7.8.6
          }
        }
      }

      // Update path state for renderer interpolation
      world.pathPrevDir[eid] = world.pathDir[eid]
      world.pathDir[eid]     = dir
      world.pathFromX[eid]   = tx
      world.pathFromY[eid]   = ty
      world.pathToX[eid]     = nx
      world.pathToY[eid]     = ny
    }
  }
}
