/**
 * Enemy Motion Renderer — Tech.md §6.3, Rulebook §2.10.4–2.10.8
 *
 * Read-only rendering module. Computes smooth visual positions for enemies
 * based on their discrete tile state and progress.
 *
 * ALL of this is rendering-only — does NOT affect simulation logic (§2.10.9).
 */

import { TILE_SIZE } from './camera'

/** Direction enum values (matching game constants) */
const DIR_N = 0
const DIR_S = 1
const DIR_E = 2
const DIR_W = 3

/** MoveState enum values */
const MOVE_INTRO = 0
const MOVE_FORWARD = 1
const MOVE_TURN_RIGHT = 2
const MOVE_TURN_LEFT = 3
const MOVE_TURN_AROUND = 4
const MOVE_OUTRO = 5

export interface MotionResult {
  /** World pixel X position */
  renderX: number
  /** World pixel Y position */
  renderY: number
  /** Facing angle in degrees (0=right, 90=down, 180=left, 270=up) */
  angleDeg: number
}

/** Get the pixel position of a tile's center. */
function tileCenter(tileX: number, tileY: number): [number, number] {
  return [(tileX + 0.5) * TILE_SIZE, (tileY + 0.5) * TILE_SIZE]
}

/** Get the pixel position of the edge between fromTile and toTile. */
function edgeMidpoint(fx: number, fy: number, tx: number, ty: number): [number, number] {
  return [(fx + tx + 1) * TILE_SIZE * 0.5, (fy + ty + 1) * TILE_SIZE * 0.5]
}

/** Convert direction to angle in degrees (for sprite rotation). */
function dirToAngle(dir: number): number {
  switch (dir) {
    case DIR_N: return 270
    case DIR_S: return 90
    case DIR_E: return 0
    case DIR_W: return 180
    default: return 0
  }
}

/**
 * Compute the visual position and angle for an enemy based on its tile state.
 * Called every render frame — read-only, no simulation mutations.
 *
 * @param fromX      Tile the enemy is moving from
 * @param fromY      Tile the enemy is moving from
 * @param toX        Tile the enemy is moving to
 * @param toY        Tile the enemy is moving to
 * @param tileX      Current discrete tile X
 * @param tileY      Current discrete tile Y
 * @param progress   Progress within current segment [0, 1)
 * @param moveState  MoveState enum value
 * @param dir        Current direction (Dir enum)
 * @param prevDir    Direction from previous segment
 */
export function computeEnemyMotion(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tileX: number,
  tileY: number,
  progress: number,
  moveState: number,
  dir: number,
  prevDir: number,
): MotionResult {
  const t = Math.max(0, Math.min(1, progress))

  switch (moveState) {
    case MOVE_INTRO: {
      // Spawn center → first edge
      const [cx, cy] = tileCenter(tileX, tileY)
      const [ex, ey] = edgeMidpoint(tileX, tileY, toX, toY)
      return {
        renderX: cx + (ex - cx) * t,
        renderY: cy + (ey - cy) * t,
        angleDeg: dirToAngle(dir),
      }
    }

    case MOVE_FORWARD: {
      // Edge to edge: straight interpolation
      const [ex1, ey1] = edgeMidpoint(fromX, fromY, tileX, tileY)
      const [ex2, ey2] = edgeMidpoint(tileX, tileY, toX, toY)
      return {
        renderX: ex1 + (ex2 - ex1) * t,
        renderY: ey1 + (ey2 - ey1) * t,
        angleDeg: dirToAngle(dir),
      }
    }

    case MOVE_TURN_RIGHT:
    case MOVE_TURN_LEFT: {
      // Quarter-circle arc around corner point
      const [ex1, ey1] = edgeMidpoint(fromX, fromY, tileX, tileY)
      const [ex2, ey2] = edgeMidpoint(tileX, tileY, toX, toY)

      // The corner is the shared corner between from→current and current→next direction
      const cornerX = (moveState === MOVE_TURN_RIGHT)
        ? (dir === DIR_E || dir === DIR_N) ? (tileX + 1) * TILE_SIZE : tileX * TILE_SIZE
        : (dir === DIR_E || dir === DIR_S) ? (tileX + 1) * TILE_SIZE : tileX * TILE_SIZE
      const cornerY = (moveState === MOVE_TURN_RIGHT)
        ? (dir === DIR_S || dir === DIR_E) ? (tileY + 1) * TILE_SIZE : tileY * TILE_SIZE
        : (dir === DIR_N || dir === DIR_E) ? tileY * TILE_SIZE : (tileY + 1) * TILE_SIZE

      // Angle from pivot to entry edge point
      const startAngle = Math.atan2(ey1 - cornerY, ex1 - cornerX)
      const endAngle = Math.atan2(ey2 - cornerY, ex2 - cornerX)

      // Interpolate around the arc
      let angleDelta = endAngle - startAngle
      if (moveState === MOVE_TURN_RIGHT && angleDelta < 0) angleDelta += Math.PI * 2
      if (moveState === MOVE_TURN_LEFT && angleDelta > 0) angleDelta -= Math.PI * 2

      const arcAngle = startAngle + angleDelta * t
      const radius = TILE_SIZE * 0.5

      return {
        renderX: cornerX + Math.cos(arcAngle) * radius,
        renderY: cornerY + Math.sin(arcAngle) * radius,
        angleDeg: (dirToAngle(prevDir) + (moveState === MOVE_TURN_RIGHT ? 90 : -90) * t + 360) % 360,
      }
    }

    case MOVE_TURN_AROUND: {
      // Pivot in place — only rotation changes
      const [ex, ey] = edgeMidpoint(fromX, fromY, tileX, tileY)
      return {
        renderX: ex,
        renderY: ey,
        angleDeg: (dirToAngle(prevDir) + 180 * t + 360) % 360,
      }
    }

    case MOVE_OUTRO: {
      // Last edge → Core center
      const [ex, ey] = edgeMidpoint(fromX, fromY, tileX, tileY)
      const [cx, cy] = tileCenter(tileX, tileY)
      return {
        renderX: ex + (cx - ex) * t,
        renderY: ey + (cy - ey) * t,
        angleDeg: dirToAngle(dir),
      }
    }

    default: {
      const [cx, cy] = tileCenter(tileX, tileY)
      return { renderX: cx, renderY: cy, angleDeg: 0 }
    }
  }
}
