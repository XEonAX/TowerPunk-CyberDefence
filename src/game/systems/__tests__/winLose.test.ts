/**
 * Win / Lose Condition tests — §10.1, §10.2
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorld,
  createEnemy,
  GamePhase,
  type World,
} from '../../ecs/world'
import * as C from '../../ecs/component'
import { eventSystem } from '../event.system'

let world: World

beforeEach(() => {
  world = createWorld(42)
  // Start in a wave-active phase so the eventSystem doesn't collide with break logic
  world.currentPhase = GamePhase.WAVE_ACTIVE
})

// ---------------------------------------------------------------------------
// §10.2 — Lose condition
// ---------------------------------------------------------------------------

describe('§10.2 — GAME_OVER when Core HP reaches 0', () => {
  it('sets currentPhase to GAME_OVER when Core HP is 0', () => {
    world.healthCurrent[world.coreEid] = 0

    eventSystem(world)

    expect(world.currentPhase).toBe(GamePhase.GAME_OVER)
  })

  it('sets currentPhase to GAME_OVER when Core HP drops below 0', () => {
    world.healthCurrent[world.coreEid] = -10

    eventSystem(world)

    expect(world.currentPhase).toBe(GamePhase.GAME_OVER)
  })

  it('does NOT change phase when Core HP is above 0', () => {
    world.healthCurrent[world.coreEid] = 50

    eventSystem(world)

    // Should remain WAVE_ACTIVE (not GAME_OVER)
    expect(world.currentPhase).not.toBe(GamePhase.GAME_OVER)
  })

  it('does NOT re-trigger GAME_OVER if already in GAME_OVER', () => {
    world.healthCurrent[world.coreEid] = 0
    world.currentPhase = GamePhase.GAME_OVER

    eventSystem(world)

    expect(world.currentPhase).toBe(GamePhase.GAME_OVER)
  })
})

// ---------------------------------------------------------------------------
// §10.1 — Win condition
// ---------------------------------------------------------------------------

describe('§10.1 — VICTORY when all gateways closed and no bosses alive', () => {
  it('sets currentPhase to VICTORY in WAVE_BREAK with zero gateways and no bosses', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.activeGatewayCount = 0
    world.totalGatewaysCreated = 1  // indicates a gateway was created and closed
    world.healthCurrent[world.coreEid] = 100

    eventSystem(world)

    expect(world.currentPhase).toBe(GamePhase.VICTORY)
  })

  it('does NOT win if gateways are still open', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.activeGatewayCount = 1  // gateway still exists
    world.healthCurrent[world.coreEid] = 100

    eventSystem(world)

    expect(world.currentPhase).not.toBe(GamePhase.VICTORY)
  })

  it('does NOT win if an Orchestrator is still alive', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.activeGatewayCount = 0
    world.healthCurrent[world.coreEid] = 100

    const eid = createEnemy(world)
    world.enemyType[eid] = C.EnemyType.ORCHESTRATOR
    world.healthCurrent[eid] = 200
    world.healthMax[eid] = 200
    world.enemiesAlive = 1

    eventSystem(world)

    expect(world.currentPhase).not.toBe(GamePhase.VICTORY)
  })

  it('does NOT win if an AI Overlord is still alive', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.activeGatewayCount = 0
    world.healthCurrent[world.coreEid] = 100

    const eid = createEnemy(world)
    world.enemyType[eid] = C.EnemyType.AI_OVERLORD
    world.aiOverlordPhase[eid] = 1
    world.aiOverlordDamageMult[eid] = 1.0
    world.healthCurrent[eid] = 1000
    world.healthMax[eid] = 1000
    world.enemiesAlive = 1

    eventSystem(world)

    expect(world.currentPhase).not.toBe(GamePhase.VICTORY)
  })

  it('wins when Orchestrators are PENDING_REMOVAL (counted as dead)', () => {
    world.currentPhase = GamePhase.WAVE_BREAK
    world.activeGatewayCount = 0
    world.totalGatewaysCreated = 1  // gateway was created and removed
    world.healthCurrent[world.coreEid] = 100

    const eid = createEnemy(world)
    world.enemyType[eid] = C.EnemyType.ORCHESTRATOR
    // Mark it pending removal — should not count as "alive boss"
    world.bitmask[eid] |= C.PENDING_REMOVAL
    world.enemiesAlive = 0

    eventSystem(world)

    expect(world.currentPhase).toBe(GamePhase.VICTORY)
  })
})
