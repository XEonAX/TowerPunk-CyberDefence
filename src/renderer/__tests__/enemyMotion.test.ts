/**
 * Enemy Motion Tests — Rulebook §2.10.4–2.10.8
 *
 * Tests for the pure rendering interpolation function computeEnemyMotion.
 * All inputs are discrete tile coordinates; outputs are pixel positions.
 */

import { describe, it, expect } from 'vitest'
import { computeEnemyMotion } from '../enemyMotion'

const TILE_SIZE = 16

// Direction constants matching Dir enum (component.ts)
const DIR_N = 0
const DIR_S = 1
const DIR_E = 2
const DIR_W = 3

// MoveState constants matching MoveState enum (component.ts)
const MOVE_INTRO = 0
const MOVE_FORWARD = 1
const MOVE_TURN_RIGHT = 2
const MOVE_TURN_LEFT = 3
const MOVE_TURN_AROUND = 4
const MOVE_OUTRO = 5

// ---------------------------------------------------------------------------
// MOVE_FORWARD — §2.10.4 edge-to-edge straight interpolation
// ---------------------------------------------------------------------------

describe('MOVE_FORWARD — straight movement (§2.10.4)', () => {
  // Enemy on tile (5,5) going north. Came from (5,6), going to (5,4).
  // Entry edge between (5,6)↔(5,5): x=5.5*16=88, y=6.0*16=96
  // Exit  edge between (5,5)↔(5,4): x=5.5*16=88, y=5.0*16=80

  it('forward north, progress 0: at entry edge', () => {
    const r = computeEnemyMotion(5, 6, 5, 4, 5, 5, 0.0, MOVE_FORWARD, DIR_N, DIR_N)
    expect(r.renderX).toBeCloseTo(5.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(6.0 * TILE_SIZE)
  })

  it('forward north, progress 1: at exit edge', () => {
    const r = computeEnemyMotion(5, 6, 5, 4, 5, 5, 1.0, MOVE_FORWARD, DIR_N, DIR_N)
    expect(r.renderX).toBeCloseTo(5.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(5.0 * TILE_SIZE)
  })

  it('forward north, progress 0.5: halfway between edges', () => {
    const r = computeEnemyMotion(5, 6, 5, 4, 5, 5, 0.5, MOVE_FORWARD, DIR_N, DIR_N)
    expect(r.renderX).toBeCloseTo(5.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(5.5 * TILE_SIZE) // (96 + 80) / 2 = 88 = 5.5*16
  })

  it('forward east, progress 0: at entry edge', () => {
    // On tile (5,5) going east. Came from (4,5), going to (6,5).
    // Entry edge (4,5)↔(5,5): x=5.0*16=80, y=5.5*16=88
    // Exit  edge (5,5)↔(6,5): x=6.0*16=96, y=5.5*16=88
    const r = computeEnemyMotion(4, 5, 6, 5, 5, 5, 0.0, MOVE_FORWARD, DIR_E, DIR_E)
    expect(r.renderX).toBeCloseTo(5.0 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(5.5 * TILE_SIZE)
  })

  it('forward east, progress 1: at exit edge', () => {
    const r = computeEnemyMotion(4, 5, 6, 5, 5, 5, 1.0, MOVE_FORWARD, DIR_E, DIR_E)
    expect(r.renderX).toBeCloseTo(6.0 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(5.5 * TILE_SIZE)
  })

  it('forward south, progress 0: at entry edge', () => {
    // On tile (5,5) going south. Came from (5,4), going to (5,6).
    // Entry edge (5,4)↔(5,5): x=5.5*16=88, y=5.0*16=80
    const r = computeEnemyMotion(5, 4, 5, 6, 5, 5, 0.0, MOVE_FORWARD, DIR_S, DIR_S)
    expect(r.renderX).toBeCloseTo(5.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(5.0 * TILE_SIZE)
  })

  it('forward west, progress 0.5: midpoint', () => {
    // On tile (5,5) going west. Came from (6,5), going to (4,5).
    // Entry edge (6,5)↔(5,5): x=6.0*16=96, y=5.5*16=88
    // Exit  edge (5,5)↔(4,5): x=5.0*16=80, y=5.5*16=88
    // Midpoint: x=(96+80)/2=88=5.5*16
    const r = computeEnemyMotion(6, 5, 4, 5, 5, 5, 0.5, MOVE_FORWARD, DIR_W, DIR_W)
    expect(r.renderX).toBeCloseTo(5.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(5.5 * TILE_SIZE)
  })

  it('progress clamped below 0 behaves as 0', () => {
    const r0 = computeEnemyMotion(5, 6, 5, 4, 5, 5, 0.0, MOVE_FORWARD, DIR_N, DIR_N)
    const rNeg = computeEnemyMotion(5, 6, 5, 4, 5, 5, -0.5, MOVE_FORWARD, DIR_N, DIR_N)
    expect(rNeg.renderX).toBeCloseTo(r0.renderX)
    expect(rNeg.renderY).toBeCloseTo(r0.renderY)
  })
})

// ---------------------------------------------------------------------------
// Angle — §2.10.5
// ---------------------------------------------------------------------------

describe('facing angle (§2.10.5)', () => {
  it('north-facing → 270°', () => {
    const r = computeEnemyMotion(5, 6, 5, 4, 5, 5, 0.5, MOVE_FORWARD, DIR_N, DIR_N)
    expect(r.angleDeg).toBeCloseTo(270)
  })

  it('east-facing → 0°', () => {
    const r = computeEnemyMotion(4, 5, 6, 5, 5, 5, 0.5, MOVE_FORWARD, DIR_E, DIR_E)
    expect(r.angleDeg).toBeCloseTo(0)
  })

  it('south-facing → 90°', () => {
    const r = computeEnemyMotion(5, 4, 5, 6, 5, 5, 0.5, MOVE_FORWARD, DIR_S, DIR_S)
    expect(r.angleDeg).toBeCloseTo(90)
  })

  it('west-facing → 180°', () => {
    const r = computeEnemyMotion(6, 5, 4, 5, 5, 5, 0.5, MOVE_FORWARD, DIR_W, DIR_W)
    expect(r.angleDeg).toBeCloseTo(180)
  })
})

// ---------------------------------------------------------------------------
// MOVE_INTRO — §2.10.1, §2.10.4 spawn center → first edge
// ---------------------------------------------------------------------------

describe('MOVE_INTRO — spawn entry animation (§2.10.1, §2.10.4)', () => {
  // Spawn tile (2,0), going south to tile (2,1).
  // Tile center: (2.5*16, 0.5*16) = (40, 8)
  // Exit edge (2,0)↔(2,1): x=2.5*16=40, y=1.0*16=16

  it('intro progress 0: at tile center of spawn tile', () => {
    const r = computeEnemyMotion(2, 0, 2, 1, 2, 0, 0.0, MOVE_INTRO, DIR_S, DIR_S)
    expect(r.renderX).toBeCloseTo(2.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(0.5 * TILE_SIZE)
  })

  it('intro progress 1: at first exit edge', () => {
    const r = computeEnemyMotion(2, 0, 2, 1, 2, 0, 1.0, MOVE_INTRO, DIR_S, DIR_S)
    expect(r.renderX).toBeCloseTo(2.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(1.0 * TILE_SIZE)
  })

  it('intro progress 0.5: halfway between center and edge', () => {
    const r = computeEnemyMotion(2, 0, 2, 1, 2, 0, 0.5, MOVE_INTRO, DIR_S, DIR_S)
    // (0.5*16 + 1.0*16) / 2 = 12 → 0.75*16
    expect(r.renderX).toBeCloseTo(2.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(0.75 * TILE_SIZE)
  })

  it('intro carries correct facing angle', () => {
    const r = computeEnemyMotion(2, 0, 2, 1, 2, 0, 0.5, MOVE_INTRO, DIR_S, DIR_S)
    expect(r.angleDeg).toBeCloseTo(90)
  })
})

// ---------------------------------------------------------------------------
// MOVE_TURN_RIGHT — §2.10.7 quarter-circle arc
// ---------------------------------------------------------------------------

describe('MOVE_TURN_RIGHT — quarter-circle arc (§2.10.7)', () => {
  // Enemy on tile (5,5), came from (5,6) going north, now turning right to east (toX=6,toY=5).
  // prevDir=N(0), dir=E(2), MOVE_TURN_RIGHT
  // Entry edge (5,6)↔(5,5): (88, 96)
  // Exit  edge (5,5)↔(6,5): (96, 88)

  it('turn right progress 0: at entry edge', () => {
    const r = computeEnemyMotion(5, 6, 6, 5, 5, 5, 0.0, MOVE_TURN_RIGHT, DIR_E, DIR_N)
    expect(r.renderX).toBeCloseTo(5.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(6.0 * TILE_SIZE)
  })

  it('turn right progress 1: at exit edge', () => {
    const r = computeEnemyMotion(5, 6, 6, 5, 5, 5, 1.0, MOVE_TURN_RIGHT, DIR_E, DIR_N)
    expect(r.renderX).toBeCloseTo(6.0 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(5.5 * TILE_SIZE)
  })

  it('turn right: all arc points are at radius 0.5*TILE_SIZE from pivot', () => {
    // All arc points should be 8px from corner (96, 96)
    for (const t of [0.0, 0.25, 0.5, 0.75, 1.0]) {
      const r = computeEnemyMotion(5, 6, 6, 5, 5, 5, t, MOVE_TURN_RIGHT, DIR_E, DIR_N)
      const dx = r.renderX - 6.0 * TILE_SIZE
      const dy = r.renderY - 6.0 * TILE_SIZE
      const dist = Math.sqrt(dx * dx + dy * dy)
      expect(dist).toBeCloseTo(0.5 * TILE_SIZE, 1)
    }
  })
})

// ---------------------------------------------------------------------------
// MOVE_TURN_LEFT — §2.10.7
// ---------------------------------------------------------------------------

describe('MOVE_TURN_LEFT — quarter-circle arc (§2.10.7)', () => {
  // Enemy on tile (5,5), came from (4,5) going east, now turning left to north (toX=5,toY=4).
  // prevDir=E(2), dir=N(0), MOVE_TURN_LEFT
  // Entry edge (4,5)↔(5,5): (80, 88)
  // Exit  edge (5,5)↔(5,4): (88, 80)

  it('turn left progress 0: at entry edge', () => {
    const r = computeEnemyMotion(4, 5, 5, 4, 5, 5, 0.0, MOVE_TURN_LEFT, DIR_N, DIR_E)
    expect(r.renderX).toBeCloseTo(5.0 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(5.5 * TILE_SIZE)
  })

  it('turn left progress 1: at exit edge', () => {
    const r = computeEnemyMotion(4, 5, 5, 4, 5, 5, 1.0, MOVE_TURN_LEFT, DIR_N, DIR_E)
    expect(r.renderX).toBeCloseTo(5.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(5.0 * TILE_SIZE)
  })

  it('turn left: all arc points at radius 0.5*TILE_SIZE from pivot', () => {
    // Pivot for DIR_N turn-left is top-left corner: (5*16, 5*16) = (80, 80)
    for (const t of [0.0, 0.25, 0.5, 0.75, 1.0]) {
      const r = computeEnemyMotion(4, 5, 5, 4, 5, 5, t, MOVE_TURN_LEFT, DIR_N, DIR_E)
      const dx = r.renderX - 5.0 * TILE_SIZE
      const dy = r.renderY - 5.0 * TILE_SIZE
      const dist = Math.sqrt(dx * dx + dy * dy)
      expect(dist).toBeCloseTo(0.5 * TILE_SIZE, 1)
    }
  })
})

// ---------------------------------------------------------------------------
// MOVE_TURN_AROUND — §2.10.6 180° reversal
// ---------------------------------------------------------------------------

describe('MOVE_TURN_AROUND — 180° pivot in place (§2.10.6)', () => {
  // Enemy on tile (5,5) that is reversing direction.
  // Held at the entry edge (from south → north), rotating 180°.
  // Entry edge (5,6)↔(5,5): (88, 96)

  it('turn around: position is constant at entry edge (§2.10.7)', () => {
    const r0 = computeEnemyMotion(5, 6, 5, 4, 5, 5, 0.0, MOVE_TURN_AROUND, DIR_S, DIR_N)
    const r1 = computeEnemyMotion(5, 6, 5, 4, 5, 5, 1.0, MOVE_TURN_AROUND, DIR_S, DIR_N)
    expect(r0.renderX).toBeCloseTo(r1.renderX)
    expect(r0.renderY).toBeCloseTo(r1.renderY)
  })

  it('turn around progress 0: angle = prevDir angle', () => {
    const r = computeEnemyMotion(5, 6, 5, 4, 5, 5, 0.0, MOVE_TURN_AROUND, DIR_S, DIR_N)
    // prevDir=N → 270°; then +180*0 = 270
    expect(r.angleDeg).toBeCloseTo(270)
  })

  it('turn around progress 1: angle = prevDir + 180°', () => {
    const r = computeEnemyMotion(5, 6, 5, 4, 5, 5, 1.0, MOVE_TURN_AROUND, DIR_S, DIR_N)
    // prevDir=N(270°) + 180 = 450 → 90° (south)
    expect(r.angleDeg % 360).toBeCloseTo(90)
  })
})

// ---------------------------------------------------------------------------
// MOVE_OUTRO — §2.10.4 last edge → Core center
// ---------------------------------------------------------------------------

describe('MOVE_OUTRO — enter Core tile (§2.10.4)', () => {
  // Enemy entering Core tile (25,25) from south tile (25,26).
  // Entry edge (25,26)↔(25,25): x=25.5*16=408, y=26.0*16=416
  // Core center: (25.5*16, 25.5*16) = (408, 408)

  it('outro progress 0: at entry edge of Core', () => {
    const r = computeEnemyMotion(25, 26, 25, 25, 25, 25, 0.0, MOVE_OUTRO, DIR_N, DIR_N)
    expect(r.renderX).toBeCloseTo(25.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(26.0 * TILE_SIZE)
  })

  it('outro progress 1: at Core center', () => {
    const r = computeEnemyMotion(25, 26, 25, 25, 25, 25, 1.0, MOVE_OUTRO, DIR_N, DIR_N)
    expect(r.renderX).toBeCloseTo(25.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(25.5 * TILE_SIZE)
  })

  it('outro progress 0.5: halfway between edge and center', () => {
    const r = computeEnemyMotion(25, 26, 25, 25, 25, 25, 0.5, MOVE_OUTRO, DIR_N, DIR_N)
    // y: 416 + (408 - 416) * 0.5 = 416 - 4 = 412 = 25.75*16
    expect(r.renderX).toBeCloseTo(25.5 * TILE_SIZE)
    expect(r.renderY).toBeCloseTo(25.75 * TILE_SIZE)
  })

  it('outro carries correct facing angle', () => {
    const r = computeEnemyMotion(25, 26, 25, 25, 25, 25, 0.5, MOVE_OUTRO, DIR_N, DIR_N)
    expect(r.angleDeg).toBeCloseTo(270)
  })
})
