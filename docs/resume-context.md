# TowerPunk: Cyber Defence — Resume Context
> Written: 2026-03-04. Use this to resume implementation after a break.

---

## 1. Current State

| Metric | Status |
|--------|--------|
| Tests | **422 passed, 1 failing** |
| TypeScript | **0 errors** |
| Test files | 34 |
| Phases complete | 0–13 (simulation), 14 (enemyMotion tests), 16 (Vue UI) |

---

## 2. The One Failing Test

**File:** `src/game/__tests__/replay.test.ts`
**Test:** `"same seed + different command timing → different hash (§10.2.3)"`
**Line 72:** `expect(h1).not.toBe(h2)` — both produce `88700606`

**What it does:** Runs 600 ticks with `START_WAVE` at tick 1 vs tick 300. Expects the hash to differ because enemies should be at different tile positions.

**Root cause diagnosis:** The `hashWorldState` function hashes `tilePosX[i]`, `tilePosY[i]`, and `tileProgress[i]*1000` for all enemies. If enemies in both scenarios end up at the same tile positions at tick 600, the hash matches. The likely cause is one of:

1. **Flowfield not computed before spawn** — enemies spawn but have no direction field, so `movementSystem` cannot advance them. Check that `computeFlowfield()` is called inside `event.system.ts` or `spawn.system.ts` when a wave starts / gateway is first created.
2. **Gateway not created** — `spawn.system` requires an entity with `C.GATEWAY` bitmask and `gatewayIsClosing === 0`. If no gateway exists in the test world, no enemies spawn at all, so both hashes are "empty world + 600 ticks".
3. **Wave starts but enemies don't spawn** because `waveEnemyList` is empty or `nextSpawnTick` logic is off.

**Quickest debug:** Add a `console.log` in `hashWorldState` to print `enemiesAlive` and a sample `tilePosX` before the return. Or:
```typescript
// In the failing test, after the loop:
const sim = createSimulation(42)
for (let i = 0; i < 600; i++) {
  if (i === 1) sim.getWorld().commandQueue.push({ type: CommandType.START_WAVE })
  sim.tick()
}
console.log('phase', sim.getWorld().currentPhase, 'wave', sim.getWorld().currentWave)
console.log('alive', sim.getWorld().enemiesAlive)
// If enemiesAlive === 0 in BOTH scenarios, gateway/spawn is broken in test env
```

**Fix path:**
- If no gateways → add `createGateway()` call with correct edge tile in the PRE_GAME→WAVE_ACTIVE transition inside `event.system.ts`
- If gateways exist but no flowfield → call `recomputeFlowfield(world)` after gateway placement
- If flowfield exists but enemies don't move → ensure `movementSystem` reads the direction from the flowfield component on the enemy entity

---

## 3. Complete File Inventory

### Simulation Layer (`src/game/`)

| File | Purpose |
|------|---------|
| `constants.ts` | All rulebook constants with §citations |
| `rng.ts` | xorshift128 PRNG — `rngFloat()`, `rngRange()` |
| `replay.ts` | `createReplay`, `recordCommand`, `hashWorldState`, `runReplay` |
| `simulation.ts` | `createSimulation(seed)` — all 14 systems in §1.10 order |
| `wave.ts` | `WAVE_DEFINITIONS` (waves 1–10 match §8.7), `SPAWN_INTERVAL_TICKS=30` |
| `gameLoop.ts` | RAF-based fixed-timestep loop, `MAX_TICKS_PER_FRAME=4` |

### ECS (`src/game/ecs/`)

| File | Purpose |
|------|---------|
| `component.ts` | 22 component flags, all enums (TowerType, EnemyType, AbilityType, TargetingMode, MoveState) |
| `entity.ts` | Free-list entity pool |
| `system.ts` | System type alias |
| `world.ts` | `createWorld()`, `World` interface, all typed arrays, `CommandType` enum (0–8), `GamePhase` enum |

### Systems (`src/game/systems/`) — all 14 fully implemented

| System | §1.10 step |
|--------|-----------|
| `command.system.ts` | 0 (pre-pipeline) |
| `event.system.ts` | 1 |
| `spawn.system.ts` | 2 |
| `statusApply.system.ts` | 3 |
| `statusExpire.system.ts` | 4 |
| `movement.system.ts` | 5 |
| `enemyAura.system.ts` | 6 |
| `targeting.system.ts` | 7 |
| `damage.system.ts` | 8–9 |
| `statusQueue.system.ts` | 10 |
| `pickupDecay.system.ts` | 11 |
| `cleanup.system.ts` | 12 |
| `pickupCollect.system.ts` | 13 |
| `resource.system.ts` | 14 |

### Pathfinding (`src/game/pathfinding/`)

| File | Purpose |
|------|---------|
| `grid.ts` | 51×51 grid, blocked-tile buffer |
| `flowfield.ts` | BFS from Core, dual fields (standard + Glitch), UNREACHABLE=0xffff |
| `placement.ts` | `canPlaceTower()` — zero-alloc scratch-buffer BFS validation |

### Renderer (`src/renderer/`)

| File | Status |
|------|--------|
| `pixiApp.ts` | Full — 6-layer PixiJS app |
| `camera.ts` | Full — pan/zoom/WASD/screenToTile |
| `spritePool.ts` | Full — auto-growing pool |
| `enemyMotion.ts` | Full — 6 MoveState types, arc interpolation, 30 tests covering all cases |
| `layers/grid.layer.ts` | Full — 51×51 grid, Core highlight, Blackwall border |
| `layers/enemy.layer.ts` | Stub |
| `layers/tower.layer.ts` | Stub |
| `layers/pickup.layer.ts` | Stub |
| `layers/fx.layer.ts` | Stub |

### UI (`src/ui/`)

| File | Status |
|------|--------|
| `App.vue` | Full — composes HUD + TowerPanel + GameResult, dispatches game:command events |
| `stores/game.store.ts` | Full — `syncFromWorld()`, all reactive fields, computed props |
| `stores/ui.store.ts` | Full — selectedTowerType, hoveredTile, placementFacing |
| `components/HUD.vue` | Full — core HP bar, resources, wave status |
| `components/TowerPanel.vue` | Full — tower grid, placement info, Start Wave / Skip Break |
| `components/GameResult.vue` | Full — Victory/Game Over overlay with restart |

### Test Files (`src/game/**/__tests__/`, `src/renderer/__tests__/`)

| Test file | Tests | Subject |
|-----------|-------|---------|
| `ecs/entity.test.ts` | — | Entity pool |
| `pathfinding/bfs.test.ts` | — | BFS, placement |
| `pathfinding/placement.test.ts` | — | canPlaceTower |
| `systems/__tests__/command.system.test.ts` | includes 4 CONVERT_EDDIES tests | All 8 command types |
| `systems/__tests__/event.system.test.ts` | — | Phase transitions, wave |
| `systems/__tests__/spawn.system.test.ts` | — | Spawning, immunity |
| `systems/__tests__/movement.system.test.ts` | — | Tile progress, stun |
| `systems/__tests__/damage.system.test.ts` | — | All tower damage types |
| `systems/__tests__/statusApply.system.test.ts` | — | §7.0.12–16 |
| `systems/__tests__/statusExpire.system.test.ts` | — | Slow/stun expiry |
| `systems/__tests__/statusQueue.system.test.ts` | — | Queue helpers |
| `systems/__tests__/targeting.system.test.ts` | — | Cone, tile, range |
| `systems/__tests__/cleanup.system.test.ts` | — | Removal, cascade |
| `systems/__tests__/resource.system.test.ts` | +5 skip bonus tests | Harvester, Boosted |
| `systems/__tests__/pickupDecay.system.test.ts` | +5 Ping range tests | §4.2.5 exempt |
| `systems/__tests__/pickupCollect.system.test.ts` | — | Chebyshev collect |
| `systems/__tests__/enemyAura.system.test.ts` | — | VDB aura, Saboteur |
| `systems/__tests__/winLose.test.ts` | +3 edge cases | §10 conditions |
| `systems/__tests__/gateway.test.ts` | 12 tests | Gateway lifecycle |
| `systems/__tests__/economy.system.test.ts` | — | Eddies/Components |
| `__tests__/wave.test.ts` | — | §8.7 compositions |
| `__tests__/replay.test.ts` | **1 FAILING** | Determinism |
| `renderer/__tests__/enemyMotion.test.ts` | 30 tests | §2.10.4–2.10.8 |

---

## 4. CommandType Enum (world.ts)

```typescript
export const enum CommandType {
  PLACE_TOWER    = 0,
  PLACE_FIREWALL = 1,
  UPGRADE_TOWER  = 2,
  ACTIVATE_ABILITY = 3,
  DISMANTLE_TOWER  = 4,
  SKIP_BREAK       = 5,
  START_WAVE       = 6,
  UPGRADE_ABILITY  = 7,
  CONVERT_EDDIES   = 8,
}
```

---

## 5. World Fields Added Phases 9–11

```typescript
// Phase 9 — Upgrades & Abilities
towerDisableTicks: Uint32Array
gridTowerType: Uint8Array
overclockActive: Uint8Array
overclockTicks: Uint32Array
overclockMultiplier: Float32Array
tunedTargetType: Uint8Array
tunedDamageBonus: Float32Array

// Phase 10 — Enemy Special Behaviors
saboteurPulseTick: Uint32Array
aiOverlordPhase: Uint8Array
aiOverlordPhaseStartTick: Uint32Array
aiOverlordTilesTraveled: Uint32Array
aiOverlordDamageMult: Float32Array
totalGatewaysCreated: number   // guards win condition from false-trigger at start

// Phase 11 — Economy & Resources
skipBonusTicks: number         // decremented in event.system, doubles Harvester output (§8.3.1)
```

---

## 6. Remaining Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 15 | Renderer layers (enemy, tower, pickup, fx) | Stubs only |
| 17 | Integration & Polish — wave skip bonus wiring, performance profiling | Partial (skipBonusTicks done) |
| 18 | E2E Playwright tests | Not started |
| 19 | Audio | Not started |
| 20 | Visual polish — sprites, shaders, particles | Not started |

---

## 7. Next Actions (Priority Order)

### 7.1 Fix the 1 failing test (IMMEDIATE)
`src/game/__tests__/replay.test.ts` line 72 — "different command timing → different hash"

**Debug approach:**
```bash
# Run just the replay test with verbose output
cd /Users/user/Projects/TowerPunk-CyberDefence && pnpm exec vitest run src/game/__tests__/replay.test.ts --reporter=verbose
```

Then check:
1. Does `world.enemiesAlive > 0` after 600 ticks with START_WAVE at tick 1?
2. If `enemiesAlive === 0`, the problem is no gateway exists → spawn never runs
3. Fix: ensure `event.system.ts` creates at least 1 gateway entity when phase transitions WAVE_BREAK → WAVE_ACTIVE for the first time

### 7.2 Phase 15 — Renderer Layers (Sub-agent safe)

Implement `src/renderer/layers/enemy.layer.ts`:
- Sprite pool acquire/release on create/remove
- `update(world)` called each frame: for each live enemy (C.ENEMY bitmask), call `computeEnemyMotion()` and position the sprite
- Colored rectangles acceptable (no art assets yet)

Implement `src/renderer/layers/tower.layer.ts`:
- Different color per TowerType
- HP bar overlay

Implement `src/renderer/layers/pickup.layer.ts`:
- Small glowing dot, color based on eddie/component value

Implement `src/renderer/layers/fx.layer.ts`:
- Minimal: flash effect on hit

Wire layers into `src/main.ts` draw loop.

### 7.3 Phase 18 — E2E Tests

```
tests/e2e/gameplay.spec.ts  — tower placement, wave start, wave skip
tests/e2e/ui.spec.ts        — HUD rendering, panels, game over screen
```

### 7.4 Phases 19–20 — Audio & Visual Polish
Deferred until core gameplay is verified working end-to-end.

---

## 8. Key Invariants (Never Violate)

- **No `Math.random()`** in simulation — use `rngFloat(world.rngState)` / `rngRange(world.rngState, min, max)`
- **No `git stash`** — multiple agents may work in parallel on same working tree
- **Strict TypeScript** — no `any`, explicit return types on all exports
- **Zero allocations in tick loop** — no `new`, no array literals, no object literals
- **Rulebook §citations** in all doc comments for constants and system logic
- **§1.10 system order** in `simulation.ts` is fixed — never reorder

---

## 9. Commands

```bash
pnpm test                    # Vitest unit tests
pnpm test:e2e                # Playwright E2E
pnpm exec tsc --noEmit       # TypeScript type check
pnpm dev                     # Vite dev server → http://localhost:3000
pnpm build                   # Production build
```

---

## 10. Sub-agent Guidelines

- Do NOT use `git stash` (parallel workers share the same working tree)
- Always read the target files fully before editing
- Run `pnpm test && pnpm exec tsc --noEmit` at the end and fix all failures
- Cite `docs/rulebook.md` sections in doc comments
- Add new world fields to BOTH the `World` interface AND `createWorld()` factory
- When adding to `CommandType` enum, also update the `Command` union type

---

_End of context — 2026-03-04_
