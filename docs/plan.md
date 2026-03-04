# TowerPunk: Cyber Defence — Development Plan

> Step-by-step implementation roadmap for agentic development. Each phase builds on the last. Every task references the relevant rulebook (§) and tech.md sections.

---

## How to Use This Plan

- **Phases are sequential** — complete each phase before starting the next.
- **Tasks within a phase** can often be parallelized unless noted otherwise.
- **Each task has a Definition of Done (DoD)** — the task is not complete until all criteria are met.
- **Rulebook cross-references** (§) indicate which game rules must be satisfied.
- **Check the box** (`[x]`) when a task is fully implemented and tested.

### TDD Workflow: Red → Green → Refactor

All simulation, ECS, pathfinding, and game-logic tasks follow **test-driven development**:

1. **Red** — Write a failing test that asserts the expected behavior (derived from the rulebook or tech spec).
2. **Green** — Write the minimum implementation to make the test pass.
3. **Refactor** — Clean up while keeping tests green. Verify zero-allocation constraints, naming, etc.

Within each task, **test steps come before implementation steps**. Create the test file first, watch it fail (or not compile), then build the implementation to satisfy it.

**Phases marked with ⚡** (renderer, UI, audio, visual polish) are **implementation-first** — visual output is the primary feedback loop, not unit tests. These are verified through visual inspection and later by E2E tests in Phase 18.

---

## Phase 0: Project Scaffolding

> Set up the build toolchain, folder structure, and dev environment. No game logic yet.

### 0.1. Initialize Project

- [ ] `pnpm init` and create `package.json` with project metadata
- [ ] Install core dependencies: `typescript`, `vite`, `vue`, `pinia`, `pixi.js`
- [ ] Install dev dependencies: `vitest`, `playwright`, `eslint`, `prettier`, `@vue/tsconfig`
- [ ] Create `tsconfig.json` with `strict: true`, target `ES2022`, paths aliases (`@game/`, `@renderer/`, `@ui/`)
- [ ] Create `vite.config.ts` with Vue plugin, resolve aliases, dev server config
- [ ] Create `.eslintrc.js` (flat config) with TypeScript + Vue rules
- [ ] Create `.prettierrc` with project formatting rules
- [ ] Create `.gitignore` (node_modules, dist, coverage, .env)

**DoD:** `pnpm dev` starts Vite dev server with no errors. `pnpm build` produces a valid static SPA in `dist/`.

### 0.2. Create Folder Structure

- [ ] Create all directories matching tech.md §2 project structure:
  ```
  src/main.ts
  src/game/ecs/
  src/game/systems/
  src/game/systems/__tests__/
  src/game/pathfinding/
  src/game/pathfinding/__tests__/
  src/renderer/layers/
  src/ui/components/
  src/ui/stores/
  src/assets/
  tests/replays/
  tests/e2e/
  ```
- [ ] Create placeholder `index.html` that mounts the Vue app
- [ ] Create `src/main.ts` entry point (empty bootstrap)

**DoD:** All directories exist. `pnpm dev` serves the page with no 404s.

### 0.3. Configure Testing

- [ ] Create `vitest.config.ts` — configure path aliases, test globals, coverage
- [ ] Create `playwright.config.ts` — headless Chromium, base URL
- [ ] Add npm scripts: `test`, `test:e2e`, `test:coverage`
- [ ] Write a trivial smoke test (`src/game/__tests__/smoke.test.ts`) to verify Vitest works

**DoD:** `pnpm test` runs and passes. `pnpm test:e2e` runs (even if no E2E tests exist yet).

### 0.4. Create Stub Entry Points

- [ ] `src/main.ts` — mount Vue app, create PixiJS application (canvas only), log "TowerPunk booted"
- [ ] `src/ui/App.vue` — root component with `<canvas>` container div and HUD placeholder
- [ ] `src/renderer/pixiApp.ts` — export `initPixi()` that creates and returns a PixiJS `Application` instance

**DoD:** Browser shows a dark canvas background with "TowerPunk: Cyber Defence" title text overlay.

---

## Phase 1: ECS Core & World

> Build the entity-component-system foundation. No game logic yet — just the data structures and system runner.
>
> **TDD:** Define types/interfaces → write failing tests → implement → refactor.

### 1.1. Entity ID Manager — `src/game/ecs/entity.ts`

_Tech.md §4.1.3_

- [ ] Define `EntityId` type and function signatures: `create()`, `destroy()`, `isAlive()`
- [ ] **Write failing tests** (`src/game/ecs/__tests__/entity.test.ts`):
  - `create()` returns a valid numeric ID
  - `destroy()` + `create()` recycles the same ID
  - `isAlive()` returns `false` after `destroy()`
  - Pool handles 4096+ entities without extra allocation
- [ ] Implement: free-list pool with unsigned 32-bit integer IDs, pre-allocated for 4096 entities
- [ ] Refactor: confirm zero allocations after initial setup, all tests green

**DoD:** All tests pass. Zero allocations after initial pool setup.

### 1.2. Component Registry — `src/game/ecs/component.ts`

_Tech.md §4.2, §4.1.4–4.1.5_

> _No TDD for this task — pure type definitions with no runtime behavior._

- [ ] Define `ComponentFlag` const enum — one bit per component type (Position, Health, TilePos, TileProgress, PathState, SpawnImmunity, Tower, Targeting, Rotation, Enemy, Immunity, Slow, Stun, Pickup, Harvester, PingRange, Ability, FirewallLink, Gateway, BlackwallTower)
- [ ] For each component, document which rulebook section it implements
- [ ] Export type definitions for each component's fields and their typed array backing

**DoD:** All component flags defined. Each has a doc comment citing its rulebook §. Code compiles with `strict: true`.

### 1.3. World — `src/game/ecs/world.ts`

_Tech.md §4.1, §4.4_

- [ ] Define `World` type/interface holding:
  - Entity bitmask array (`Uint32Array`)
  - All component typed arrays (one per component field)
  - Entity pool reference
  - Game-level state: tick counter, RNG state, resource pools, command queue
- [ ] **Write failing tests** (`src/game/ecs/__tests__/world.test.ts`):
  - `createWorld()` returns a world with all arrays pre-allocated
  - `createEnemy()` sets correct component bitmask
  - `createTower()` sets correct component bitmask
  - `createPickup()`, `createGateway()`, `createCore()` — bitmask correctness
  - `markForRemoval()` flags entity but does not destroy it yet
- [ ] Implement `createWorld(seed: number)`: pre-allocate all arrays for max entity count
- [ ] Implement archetype creation helpers: `createEnemy()`, `createTower()`, `createPickup()`, `createGateway()`, `createCore()`
- [ ] Implement `markForRemoval(eid)` — sets a flag; actual cleanup deferred
- [ ] Refactor: verify all tests green, zero allocations after `createWorld()`

**DoD:** All tests pass. Can create a world, spawn entities of each archetype, query by bitmask, mark for removal.

### 1.4. System Runner — `src/game/ecs/system.ts`

_Tech.md §3.2_

- [ ] Define `System` type: `(world: World) => void`
- [ ] **Write failing test** (`src/game/ecs/__tests__/system.test.ts`):
  - `runTick()` calls each pipeline slot in order (use spies / mutation tracking)
  - Pipeline has exactly 14 slots matching §1.10 order
- [ ] Implement `TICK_PIPELINE` array (empty stubs for now — `noopSystem` placeholders)
- [ ] Implement `runTick(world: World): void` — iterates `TICK_PIPELINE` and calls each system

**DoD:** Tests confirm `runTick()` calls each pipeline slot in the correct order.

### 1.5. Seeded PRNG — `src/game/rng.ts`

_Tech.md §9.4.5, Rulebook §1.9_

- [ ] Define `Rng` interface: `{ next(): number, nextFloat(): number, nextRange(min, max): number }`
- [ ] **Write failing tests** (`src/game/__tests__/rng.test.ts`):
  - Same seed produces identical sequence (call `next()` 1000× with two instances)
  - Different seeds produce different sequences
  - `nextFloat()` returns values in `[0, 1)`
  - `nextRange(min, max)` returns values in `[min, max)`
  - Distribution sanity: no degenerate output (e.g. all zeros)
- [ ] Implement xorshift128: state is 4 × uint32, stored in `World`
- [ ] Refactor: verify all determinism tests green

**DoD:** All tests pass. Same seed → identical output. Determinism proven.

---

## Phase 2: Constants & Grid

> Define all rulebook constants and the core grid data structure.
>
> **TDD:** Write assertion tests for every rulebook constant before defining them. Grid operations get tests before implementation.

### 2.1. Game Constants — `src/game/constants.ts`

_Rulebook §1–§10_

- [ ] **Write failing tests** (`src/game/__tests__/constants.test.ts`) asserting every key value from the rulebook:
  - `TICK_RATE === 60` (§1.8)
  - `GRID_SIZE === 51` (§2.1)
  - `CORE_X === 25`, `CORE_Y === 25` (§2.9)
  - `SPAWN_IMMUNITY_TICKS === 30` (§2.10.1)
  - `CORE_STARTING_HP === 100` (§3.3)
  - `INITIAL_EDDIES === 400`, `INITIAL_COMPONENTS === 3` (§4.3.1)
  - Tower cost tables, enemy stat tables, ability stat tables match rulebook values
- [ ] Define all constants with rulebook cross-reference comments:
  ```typescript
  /** Rulebook §1.8 */ export const TICK_RATE = 60;
  /** Rulebook §2.1 */ export const GRID_SIZE = 51;
  // ... all tower costs, enemy stats, wave formula params, etc.
  ```
- [ ] Define tower stat tables (cost arrays, HP per level, damage per level)
- [ ] Define enemy stat tables (base HP, damage, speed, tier multiplier, immunities)
- [ ] Define ability stat tables (cooldowns, durations, boost percentages)
- [ ] Define wave formula constants (break duration scaling, enemy scaling multiplier)

**DoD:** Every numeric value from the rulebook has a named constant. Tests assert and verify all values.

### 2.2. Grid State — `src/game/pathfinding/grid.ts`

_Tech.md §5.4, Rulebook §2.1–2.6_

- [ ] Define `Grid` type: `{ blocked: Uint8Array, towerType: Uint8Array }` (both `GRID_SIZE × GRID_SIZE`)
- [ ] **Write failing tests** (`src/game/pathfinding/__tests__/grid.test.ts`):
  - `createGrid()` returns a grid with all tiles empty
  - `isEdgeTile(0, y)`, `isEdgeTile(50, y)`, etc. return `true` (§2.6.3)
  - `isEdgeTile(25, 25)` returns `false`
  - `setBlocked()` → `isOccupied()` returns `true`
  - `clearBlocked()` → `isOccupied()` returns `false`
  - `idx(x, y)` returns `y * GRID_SIZE + x`
- [ ] Implement: `createGrid()`, `isOccupied()`, `isEdgeTile()`, `setBlocked()`, `clearBlocked()`, `idx()`
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Grid correctly identifies edge tiles, occupied tiles, and Core position.

---

## Phase 3: Pathfinding

> Implement BFS flowfield, dual fields for Glitch, and placement validation.
>
> **TDD:** Write expected output tests for known grid configurations → implement BFS → verify.

### 3.1. BFS Flowfield — `src/game/pathfinding/flowfield.ts`

_Tech.md §5.1–5.2_

- [ ] Define `Dir` const enum: N=0, S=1, E=2, W=3, NONE=0xFF
- [ ] Define `DirChange` const enum: NONE=0, TURN_RIGHT=1, TURN_LEFT=2, TURN_AROUND=3
- [ ] Define function signature: `computeFlowfield(grid, blockedSet): { cost: Uint16Array, dir: Uint8Array }`
- [ ] **Write failing tests** (`src/game/pathfinding/__tests__/flowfield.test.ts`):
  - Empty grid: all tiles reachable, cost increases outward from Core
  - Core tile (25, 25): cost = 0, dir = NONE
  - Single blocked tile: paths route around it, cost adjusts
  - Corridor: correct direction field along the corridor
  - Unreachable tile (fully walled off): cost = `0xFFFF`, dir = `0xFF`
  - 4-directional only — no diagonal costs (§7.0.2)
- [ ] Implement BFS flood-fill from Core tile (25, 25), 4-directional
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. BFS produces correct cost and direction fields for various grid configurations.

### 3.2. Dual Flowfields

_Tech.md §5.2_

- [ ] **Write failing tests** (`src/game/pathfinding/__tests__/flowfield.test.ts`):
  - Standard field: blocked by all tower types
  - Glitch field: allows path through ICE Wall and Firewall tiles (§7.4.1)
  - Glitch field: still blocked by Data Spike, Daemon Turret, etc.
  - Both fields update together on grid change
- [ ] Implement `computeDualFlowfields(grid)` → `{ standard: Flowfield, glitch: Flowfield }`
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Glitch field allows passage through ICE Wall + Firewall only.

### 3.3. Placement Validation — `canPlaceTower()` and `canPlaceFirewallPair()`

_Tech.md §5.3, §5.5–5.6, Rulebook §2.6_

- [ ] **Write failing tests** (`src/game/pathfinding/__tests__/placement.test.ts`):
  - Valid placement on empty tile: accepted
  - Placement on occupied tile: rejected (§2.6.1)
  - Placement on edge tile: rejected (§2.6.3)
  - Placement that would block all paths to Core: rejected (§2.6.4)
  - Firewall pair: both tower tiles blocked, gap stays walkable
  - Firewall pair: rejected if any of the 3 tiles occupied or on edge
  - Zero allocations during validation (scratch buffer reused)
- [ ] Pre-allocate scratch `Uint16Array(GRID_SIZE * GRID_SIZE)` — module-level, reused
- [ ] Implement `canPlaceTower(grid, gateways, x, y): boolean`
- [ ] Implement `canPlaceFirewallPair(grid, gateways, t1, gap, t2): boolean`
- [ ] Refactor: verify all tests green, zero allocations confirmed

**DoD:** All tests pass. Placement validation correct for all edge cases. Scratch buffer reused (zero alloc).

---

## Phase 4: Game Loop & Simulation Shell

> Wire up the fixed-timestep game loop and tick pipeline with stub systems.
>
> **TDD:** Simulation driver and tick counting are testable. Game loop (RAF) is integration — verified visually.

### 4.1. Simulation Driver — `src/game/simulation.ts`

_Tech.md §3.1_

- [ ] **Write failing tests** (`src/game/__tests__/simulation.test.ts`):
  - `tick()` increments `world.tickCount` by 1
  - Calling `tick()` N times advances `world.tickCount` to N
  - `tick()` runs pipeline systems in §1.10 order (verify via side effects)
  - Command queue is flushed at tick start
- [ ] Implement `createSimulation(seed: number)` → `{ world, tick(), getWorld() }`
- [ ] Implement `tick()`: run all systems in `TICK_PIPELINE` order, increment `world.tickCount`
- [ ] Wire command queue: `world.commandQueue: Command[]` — flushed at tick start

**DoD:** All tests pass. Calling `tick()` N times advances `world.tickCount` to N.

### 4.2. Game Loop (RAF) — `src/game/gameLoop.ts` ⚡

_Tech.md §3.1_

> _Implementation-first: RAF loop is browser-dependent, verified through visual integration._

- [ ] `startGameLoop(simulation, renderer)` — requestAnimationFrame loop
- [ ] Accumulator pattern: `while (acc >= TICK_DURATION) { sim.tick(); acc -= TICK_DURATION; }`
- [ ] Cap: `MAX_TICKS_PER_FRAME = 4`
- [ ] Compute `alpha = acc / TICK_DURATION` for renderer interpolation
- [ ] Call `renderer.draw(alpha)` after ticks
- [ ] `stopGameLoop()` — cancels animation frame

**DoD:** Game loop runs simulation at fixed 60 ticks/sec and renders at display refresh rate. Tab backgrounding doesn't cause spiral-of-death.

### 4.3. Stub Systems

- [ ] Create all 14 system files with stub implementations (`(world: World) => void` no-ops):
  - `command.system.ts`
  - `event.system.ts`
  - `spawn.system.ts`
  - `statusApply.system.ts`
  - `statusExpire.system.ts`
  - `movement.system.ts`
  - `enemyAura.system.ts`
  - `targeting.system.ts`
  - `damage.system.ts`
  - `statusQueue.system.ts`
  - `pickupDecay.system.ts`
  - `cleanup.system.ts`
  - `pickupCollect.system.ts`
  - `resource.system.ts`
- [ ] Each file has a header comment with its §1.10.x step reference
- [ ] Wire all stubs into `TICK_PIPELINE` in correct order

**DoD:** All 14 system files exist and are wired into the pipeline. `pnpm test` passes.

---

## Phase 5: Core Renderer ⚡

> Get the grid, Core, and camera rendering on screen. No gameplay yet — just the visual scaffold.
>
> **Implementation-first:** Renderer work is verified visually, not via TDD.

### 5.1. PixiJS Application Setup — `src/renderer/pixiApp.ts`

_Tech.md §6.1_

- [ ] `initPixi(container: HTMLElement)` → PixiJS `Application`
- [ ] Full-viewport `<canvas>`
- [ ] Dark background color (#0a0a0f or similar cyberpunk dark)
- [ ] Create render layer containers in z-order (grid, ghost, towers, enemies, pickups, FX)
- [ ] Export layer container references for sub-renderers

**DoD:** Canvas fills viewport with dark background. Layer containers created.

### 5.2. Grid Layer — `src/renderer/layers/grid.layer.ts`

_Rulebook §2.1–2.2, §2.5_

- [ ] Draw 51×51 grid lines (blue dotted lines on dark background)
- [ ] Highlight Core tile at center (blue solid square)
- [ ] Draw Blackwall boundary as red dotted lines around outer edge
- [ ] Grid should scale/translate with camera
- [ ] Use `Graphics` objects — draw once, update only on zoom/pan

**DoD:** Grid visible on screen. Core tile highlighted. Blackwall boundary visible.

### 5.3. Camera — `src/renderer/camera.ts`

_Tech.md §6.5_

- [ ] Pan: mouse drag, WASD, arrow keys
- [ ] Zoom: scroll wheel, pinch (touch)
- [ ] Clamp viewport to 51×51 grid bounds
- [ ] Implement as transform on root PixiJS container
- [ ] Smooth interpolation for pan/zoom

**DoD:** Can pan and zoom around the grid. Cannot scroll beyond grid boundaries.

### 5.4. Sprite Pool — `src/renderer/spritePool.ts`

_Tech.md §6.4_

- [ ] `SpritePool` class: `acquire(): Sprite`, `release(sprite): void`
- [ ] Auto-grow (double pool size) when exhausted
- [ ] Never shrink during gameplay
- [ ] Separate pools per sprite type (enemy, tower, pickup, FX)
- [ ] Write unit test: acquire, release, recycle, auto-grow

**DoD:** Sprite pools work correctly. After warm-up, no `new Sprite()` calls needed.

---

## Phase 6: Core Simulation Systems (Minimum Playable)

> Implement the minimum systems needed to have enemies spawn, move, and reach the Core. This is the first "playable" milestone — enemies walk to the Core and damage it.
>
> **TDD:** For each system — write tests asserting rulebook behavior → implement system → verify tests green.

### 6.1. Command System — `src/game/systems/command.system.ts`

_Tech.md §3.2, §8.2_

- [ ] **Write failing tests** (`src/game/systems/__tests__/command.system.test.ts`):
  - Queue is empty after system runs
  - `PLACE_TOWER` on valid tile: tower entity created, flowfields recomputed
  - `PLACE_TOWER` on invalid tile: rejected, no entity created
  - `START_WAVE`: triggers wave start in event state
- [ ] Implement: flush `world.commandQueue`, process `START_WAVE` and `PLACE_TOWER` (others as stubs)
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Player commands are processed. Tower placement validated and executed.

### 6.2. Event System — `src/game/systems/event.system.ts`

_Rulebook §1.10.1, §8.2, §9.2_

- [ ] **Write failing tests** (`src/game/systems/__tests__/event.system.test.ts`):
  - Initial phase is `PRE_GAME`
  - Phase transitions: `WAVE_BREAK` → `WAVE_ACTIVE` on start trigger
  - Wave end detected: all enemies dead or reached Core
  - New Gateway spawns every 5 waves starting wave 1 (§8.5.1)
- [ ] Implement: phase tracking, wave scheduling, Blackwall degradation schedule
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Phases transition correctly. Waves start and end. Blackwall degrades on schedule.

### 6.3. Spawn System — `src/game/systems/spawn.system.ts`

_Rulebook §1.10.2, §2.10.1, §7.0.6, Tech.md §3.3_

- [ ] **Write failing tests** (`src/game/systems/__tests__/spawn.system.test.ts`):
  - Enemy spawns at Gateway tile with correct `TilePos`
  - `SpawnImmunity.remainingTicks = 30` on spawn (§2.10.1)
  - `TileProgress.progress = 0` on spawn
  - Round-robin: 2 Gateways → alternating spawns
  - Closed/closing Gateways skipped
  - Wave 5 enemy stats = base × `(1 + 0.1 × 4)` (§8.4.1)
- [ ] Implement: read wave definition, round-robin spawning, entity creation with scaled stats
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Enemies spawn from Gateways in round-robin. Stats scaled by wave. Immunity set.

### 6.4. Status Expire System — `src/game/systems/statusExpire.system.ts`

_Rulebook §1.10.4, §2.10.1_

- [ ] **Write failing tests** (`src/game/systems/__tests__/statusExpire.system.test.ts`):
  - `SpawnImmunity.remainingTicks` decrements by 1 each tick
  - When immunity reaches 0: `TileProgress.progress = 0.5`, `PathState` initialized, `progressFactor = 2 × speed`
  - `Slow.remainingTicks` decrements; clears magnitude at 0
  - `Stun.remainingTicks` decrements; clears at 0
- [ ] Implement: decrement counters, handle expiry transitions
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Status effects expire correctly. Spawn immunity initializes PathState on expiry.

### 6.5. Movement System — `src/game/systems/movement.system.ts`

_Rulebook §1.10.5, §2.10.2–2.10.3, Tech.md §3.4_

- [ ] **Write failing tests** (`src/game/systems/__tests__/movement.system.test.ts`):
  - Progress advances by `speed / TICK_RATE × progressFactor` per tick
  - Tile transition fires when `progress >= 1.0`; `TilePos` updated to `PathState.toX/toY`
  - Direction change classified: None, TurnRight, TurnLeft, TurnAround
  - Progress factor adjusts per movement state table (§2.10.8)
  - Stun: progress does not advance
  - Slow: effective speed = `baseSpeed × (1 - slowMagnitude)`
  - Core entry: damage applied to Core HP, enemy marked for removal
  - Leftover progress normalized on tile transition
- [ ] Implement movement:
  - Each enemy with `SpawnImmunity.remainingTicks == 0`: compute effective speed, advance progress
  - On tile transition: update TilePos, look up flowfield, compute directionChange and progressFactor
  - Core entry: set Outro state → apply damage → mark removal
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Enemies move along flowfield. Tile transitions update position and PathState. Core damage works.

### 6.6. Cleanup System — `src/game/systems/cleanup.system.ts`

_Rulebook §1.10.12_

- [ ] **Write failing tests** (`src/game/systems/__tests__/cleanup.system.test.ts`):
  - Dead enemy creates Pickup entity with correct Eddie/Component value (§7.0.8)
  - Dead tower: entity recycled, bitmask cleared
  - Firewall partner destruction cascade: one dies → both die (§5.2.4)
  - Entity ID returned to pool after cleanup
- [ ] Implement: iterate marked entities, create pickups, handle Firewall cascade, destroy entities
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Dead entities removed. Pickups created from enemy drops. Firewall cascade works.

### 6.7. Wave Definitions — `src/game/wave.ts`

_Rulebook §8_

- [ ] **Write failing tests** (`src/game/__tests__/wave.test.ts`):
  - Wave 1 composition matches rulebook §8.7 table
  - Scaling: wave 10 stat = `base × (1 + 0.1 × 9)` (§8.4.1)
  - Break duration: wave 10 = 1800 ticks, wave 40 = 60 ticks (§8.2.3)
  - Boss flag: AI Overlord at wave 50, 60, 70... (§8.6.1)
- [ ] Define wave compositions for waves 1–10+ (§8.7 table)
- [ ] Implement scaling formula and break duration formula
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Wave data matches rulebook exactly.

---

## Phase 7: Basic Tower Systems

> Implement tower placement, targeting, and damage. Player can build ICE Walls and see enemies interact with them.
>
> **TDD:** Write tests for each tower behavior and status effect rule → implement → verify.

### 7.1. ICE Wall Tower

_Rulebook §5.1_

- [ ] **Write failing tests** (`src/game/systems/__tests__/iceWall.test.ts`):
  - Placement: tile becomes blocked, both flowfields recomputed
  - Slow aura: adjacent enemies receive 20% slow (§5.1.1)
  - DoT: adjacent enemies take 1/60 damage/tick (§5.1.2)
  - Glitches passing through adjacent tiles still take DoT (§5.1)
  - Level 1 HP = 200
- [ ] Implement: `PLACE_TOWER` creates ICE Wall entity, grid update, slow aura, DoT
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. ICE Wall blocks pathing, slows and damages adjacent enemies.

### 7.2. Targeting System — `src/game/systems/targeting.system.ts`

_Rulebook §1.10.7_

- [ ] **Write failing tests** (`src/game/systems/__tests__/targeting.system.test.ts`):
  - Tower targets enemy within range
  - Tower ignores enemy outside range
  - Cooldown > 0: tower skips firing, decrements cooldown
  - Targeting mode "Closest": selects nearest enemy
  - Targeting mode "Highest HP" / "Lowest HP": correct selection
  - ICE Sniper minimum range: ignores enemies within 3 tiles (§5.5.2)
  - Disabled tower (Saboteur): skipped entirely
- [ ] Implement: iterate tower entities, find targets (Chebyshev distance), apply targeting mode, mark for damage, handle cooldowns and rotation
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Towers acquire targets correctly. Cooldowns work. Targeting modes functional.

### 7.3. Damage System — `src/game/systems/damage.system.ts`

_Rulebook §1.10.8–9_

- [ ] **Write failing tests** (`src/game/systems/__tests__/damage.system.test.ts`):
  - DPS tower (ICE Wall): damage applied each tick to in-range enemies
  - Projectile tower (Data Spike): damage applied on fire event only
  - Enemy HP reaches 0: marked for removal
  - VDB Netrunner aura: tower takes damage (§7.6.2)
  - Orchestrator immune to ICE Wall DoT and Firewall damage (§7.5.2)
  - Immunity bitmask prevents specific damage types
- [ ] Implement: apply tower → enemy damage, enemy → tower damage, mark removal at HP ≤ 0, check immunities
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Damage applied correctly. Immunities respected. Entities die at 0 HP.

### 7.4. Status Apply System — `src/game/systems/statusApply.system.ts`

_Rulebook §1.10.3, §7.0.10–7.0.16_

- [ ] **Write failing tests** (`src/game/systems/__tests__/statusApply.system.test.ts`) — one test per interaction rule:
  - Stronger slow replaces weaker (§7.0.15)
  - Weaker slow ignored (§7.0.15)
  - Stun clears active slow (§7.0.12)
  - Slow cannot apply to stunned enemy (§7.0.13)
  - Stun-immune enemy ignores stun (§7.0.14)
  - Slow-immune enemy ignores slow (§7.0.14)
  - Longer stun replaces shorter remaining (§7.0.16)
- [ ] Implement: apply queued status effects with full interaction rules
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Every status effect interaction rule from §7.0.10–7.0.16 implemented.

### 7.5. Status Queue System — `src/game/systems/statusQueue.system.ts`

_Rulebook §1.10.10_

- [ ] **Write failing tests** (`src/game/systems/__tests__/statusQueue.system.test.ts`):
  - Effects from tower hits are queued (not applied immediately)
  - Queued effects are applied by statusApplySystem on the next tick
- [ ] Implement: queue slow/stun effects from tower hits, Firewall gap, ICE Wall aura
- [ ] Refactor: verify all tests green

**DoD:** All tests pass. Status effects queued and deferred to next tick.

---

## Phase 8: All Tower Types

> Implement remaining towers one at a time. Each tower is a focused task.
>
> **TDD:** For each tower — write tests for its unique behaviors from the rulebook → implement → verify.

### 8.1. Firewall — _Rulebook §5.2_

- [ ] **Write failing tests:**
  - Pair placement: 2 linked entities, gap tile walkable
  - Gap stun: enemies on gap tile stunned for 60 ticks every tick (stun-locked)
  - Gap DPS: enemies on gap tile take damage
  - Firewall Breacher: immune to Firewall stun, still takes damage (§5.2.2)
  - Death cascade: destroying one tower destroys both (§5.2.4)
  - Death burst: enemies on adjacent tiles of partner take damage (§5.2.5)
  - Placement validation: `canPlaceFirewallPair()` rejects invalid configs (§5.6)
- [ ] Implement: pair entities with `FirewallLink`, gap stun/DPS, death cascade, burst, orientation
- [ ] Refactor: verify all tests green

### 8.2. Data Spike — _Rulebook §5.3_

- [ ] **Write failing tests:**
  - Fixed facing: direction set at placement, immutable
  - 90° cone: correct tiles included at each range level
  - Piercing: hits all enemies in the cone path
  - Fire rate: 1 spike / 120 ticks cooldown
  - Range scales with level
- [ ] Implement: placement with facing, cone targeting, piercing damage, cooldown
- [ ] Refactor: verify all tests green

### 8.3. Daemon Turret — _Rulebook §5.4_

- [ ] **Write failing tests:**
  - Rotation: rotates toward target at 0.5 deg/tick (level 1)
  - Fires only when facing target (within angle tolerance)
  - Multi-target: damages all enemies on target tile
  - Targeting modes: Closest, Highest HP, Lowest HP — each selects correct target
  - Fire rate improves with upgrades
- [ ] Implement: rotation component, facing check, multi-target damage, targeting modes
- [ ] Refactor: verify all tests green

### 8.4. ICE Sniper — _Rulebook §5.5_

- [ ] **Write failing tests:**
  - Minimum range: ignores enemies within 3 tiles (§5.5.2)
  - Single-target: only one enemy hit per shot
  - On-hit slow: 20% for 120 ticks at level 1
  - Rotation: tracks targets
  - Targeting modes each select correct target
- [ ] Implement: min range check, single-target damage, on-hit slow, rotation
- [ ] Refactor: verify all tests green

### 8.5. Ping Tower — _Rulebook §5.7_

- [ ] **Write failing tests:**
  - Collection range: 3 tiles at level 1 (Chebyshev distance)
  - Auto-collect: pickups within range collected
  - Harvester enabling: only Harvesters within Ping range generate Eddies (§5.7.2)
- [ ] Implement: range check, auto-collect, Harvester activation
- [ ] Refactor: verify all tests green

### 8.6. Harvester — _Rulebook §5.8_

- [ ] **Write failing tests:**
  - Generates Eddies per tick only when within Ping Tower range
  - No generation when outside Ping range
  - Component generation unlocks at level 3
- [ ] Implement: Eddie generation, Ping Tower dependency, Component generation at level 3
- [ ] Refactor: verify all tests green

### 8.7. Blackwall Tower — _Rulebook §5.6_

- [ ] **Write failing tests:**
  - Must be adjacent to a Gateway (placement rejected otherwise)
  - Reduces Gateway HP per tick (§5.6.2, §9.2.9)
  - Takes passive damage from adjacent open Gateway (§5.6.6)
  - Auto-repair consumes Components (§5.6.7)
  - Gateway closes (HP reaches 0) → permanently shut (§5.6.5)
- [ ] Implement: adjacency check, Gateway HP reduction, passive damage, auto-repair, closure
- [ ] Refactor: verify all tests green

---

## Phase 9: Tower Upgrades & Abilities

> Implement the upgrade system and all 5 ability types.
>
> **TDD:** Write tests for upgrade costs, stat changes, and ability behaviors → implement → verify.

### 9.1. Upgrade System

_Rulebook §5.0.3–5.0.7_

- [ ] **Write failing tests:**
  - Cost validation: deducts correct Eddies + Components per upgrade table
  - Stat changes: match tower's upgrade table per level
  - Max level: upgrade rejected at level 10
  - Ability unlock at level 5
  - Insufficient resources: upgrade rejected, nothing deducted
- [ ] Implement: `UPGRADE_TOWER` command processing, cost validation, stat application, level cap
- [ ] Refactor: verify all tests green

### 9.2. EMP Blast — _Rulebook §6.1_

- [ ] **Write failing tests:**
  - Stuns all enemies in tower's range for ability duration
  - Data Leech immune to EMP stun (§6.1.3)
  - Cooldown: 600 ticks (base), ability rejected during cooldown
  - Only available when ICE Wall reaches level 5
- [ ] Implement: area stun, immunity check, cooldown management, unlock condition
- [ ] Refactor: verify all tests green

### 9.3. Overclock — _Rulebook §6.2_

- [ ] **Write failing tests:**
  - +50% fire rate for 300 ticks (base)
  - Harvester variant: +50% Eddie generation rate
  - Cooldown: 1200 ticks, rejected during cooldown
  - Unlocked by Data Spike, Daemon Turret, ICE Sniper, Harvester at level 5
- [ ] Implement: fire rate boost, Harvester variant, cooldown management, unlock conditions
- [ ] Refactor: verify all tests green

### 9.4. Tuned — _Rulebook §6.3_

- [ ] **Write failing tests:**
  - Bonus damage applied against selected enemy type
  - Player can switch target type (cooldown: 1200 ticks base)
  - Unlocked by Firewall at level 5
- [ ] Implement: enemy type selection, bonus damage application, cooldown for switching
- [ ] Refactor: verify all tests green

### 9.5. Boosted — _Rulebook §6.4_

- [ ] **Write failing tests:**
  - Permanently +50% Eddie generation for Harvesters in range
  - Mutually exclusive with Oracle (cannot have both)
  - Unlocked by Ping Tower at level 5
- [ ] Implement: permanent buff application, mutual exclusivity guard
- [ ] Refactor: verify all tests green

### 9.6. Oracle — _Rulebook §6.5_

- [ ] **Write failing tests:**
  - Permanently +50% collection range
  - Mutually exclusive with Boosted (cannot have both)
  - Unlocked by Ping Tower at level 5
- [ ] Implement: permanent range increase, mutual exclusivity guard
- [ ] Refactor: verify all tests green

---

## Phase 10: All Enemy Types

> Implement enemy-specific behaviors. Base enemy movement already works from Phase 6.
>
> **TDD:** Write tests for each enemy's immunities and special behaviors → implement → verify.

### 10.1. Data Leech — _Rulebook §7.1_

- [ ] **Write failing tests:**
  - Stun immune: stun effect ignored
  - Slow immune: already at minimum speed (§7.1.3)
- [ ] Implement: immunity bitmask for Data Leech archetype
- [ ] Refactor: verify all tests green

### 10.2. Code Runner — _Rulebook §7.2_

- [ ] **Write failing tests:**
  - Speed matches rulebook value (fast) with correct wave scaling
  - Can be stunned: stun effect applies normally
  - Can be slowed: slow effect applies normally
- [ ] Implement: Code Runner archetype with correct stats
- [ ] Refactor: verify all tests green

### 10.3. Firewall Breacher — _Rulebook §7.3_

- [ ] **Write failing tests:**
  - Immune to ICE Wall slow
  - Immune to Firewall stun (but still takes Firewall damage)
  - Can be stunned by EMP Blast (§7.3 — not Firewall-specific)
- [ ] Implement: selective immunity bitmask
- [ ] Refactor: verify all tests green

### 10.4. Glitch — _Rulebook §7.4_

- [ ] **Write failing tests:**
  - Uses Glitch flowfield: phases through ICE Wall and Firewall tiles (§7.4.1)
  - Still takes ICE Wall DoT when adjacent (§7.4.4)
  - Standard flowfield is NOT used
- [ ] Implement: Glitch archetype uses Glitch flowfield for movement
- [ ] Refactor: verify all tests green

### 10.5. Orchestrator — _Rulebook §7.5_

- [ ] **Write failing tests:**
  - Spawns interior Gateway at death tile on death
  - Immune to ICE Wall DoT and Firewall damage (§7.5.2)
  - Other damage types apply normally
- [ ] Implement: death handler spawns Gateway, immunity bitmask
- [ ] Refactor: verify all tests green

### 10.6. VDB Netrunner — _Rulebook §7.6_

- [ ] **Write failing tests:**
  - On tile entry: all towers within 1 tile take damage (§7.6.2)
  - Damage amount matches rulebook value
  - No damage between tile entries (only on the entry event)
- [ ] Implement in `enemyAura.system.ts` (§1.10.6): tower damage aura on tile entry
- [ ] Refactor: verify all tests green

### 10.7. Saboteur — _Rulebook §7.7_

- [ ] **Write failing tests:**
  - Disables towers within 1 tile for 300 ticks every 600 ticks
  - Disabled towers cannot attack (targeting system skips them)
  - Disabled towers still block movement (grid unchanged)
- [ ] Implement: disable pulse timer, tower disable flag, targeting skip
- [ ] Refactor: verify all tests green

### 10.8. AI Overlord (Boss) — _Rulebook §7.8_

- [ ] **Write failing tests:**
  - Phase 1 (ticks 0–1800): immune to all damage, spawns Gateway every 5 tiles walked
  - Phase 2 (ticks 1801–3600): vulnerable, spawns Glitch every 5 tiles walked
  - Phase 3 (ticks 3601+): +50% damage taken, spawns Orchestrator every 5 tiles walked
  - Phase transitions are automatic at 1800-tick intervals
  - Can be slowed and stunned in all phases
- [ ] Implement: phase state machine, damage immunity/vulnerability, spawn-on-walk, slow/stun susceptibility
- [ ] Refactor: verify all tests green

---

## Phase 11: Economy & Resources

> Wire up the full resource flow: Eddies, Components, pickups, conversion.
>
> **TDD:** Write tests for exact rates, decay formulas, and conversion rules → implement → verify.

### 11.1. Pickup Decay System — `src/game/systems/pickupDecay.system.ts`

_Rulebook §1.10.11, §4.2.5_

- [ ] **Write failing tests:**
  - Pickup outside Ping range: decays at 5/60 ≈ 0.083% of initial value per tick
  - Pickup within Ping range: does NOT decay
  - Pickup removed when value reaches 0
- [ ] Implement: decay calculation, Ping range check, removal at zero
- [ ] Refactor: verify all tests green

### 11.2. Pickup Collect System — `src/game/systems/pickupCollect.system.ts`

_Rulebook §1.10.13, §5.7.1_

- [ ] **Write failing tests:**
  - Ping Tower auto-collects pickups within range
  - Collected Eddies/Components added to player resource pool
  - Pickups outside Ping range: not collected
- [ ] Implement: range check, auto-collection, resource addition
- [ ] Refactor: verify all tests green

### 11.3. Resource System — `src/game/systems/resource.system.ts`

_Rulebook §1.10.14_

- [ ] **Write failing tests:**
  - Harvester generates Eddies per tick at correct rate (only if Ping-connected)
  - Harvester generates Components at level 3+
  - Blackwall Tower auto-repair consumes Components at correct rate (§5.6.7)
- [ ] Implement: Harvester generation, Blackwall auto-repair, Ping dependency checks
- [ ] Refactor: verify all tests green

### 11.4. Component Conversion

_Rulebook §4.2.9_

- [ ] **Write failing tests:**
  - 100 Eddies → 1 Component conversion
  - Insufficient Eddies: conversion rejected, nothing deducted
- [ ] Implement: `CONVERT_EDDIES` command, validation, resource mutation
- [ ] Refactor: verify all tests green

### 11.5. Tower Dismantling

_Rulebook §4.2.6–4.2.7_

- [ ] **Write failing tests:**
  - Within Ping range: returns 100% Components
  - Outside Ping range: returns 0% (left to decay)
  - Flowfields recomputed after removal
  - Grid tile unblocked after dismantling
- [ ] Implement: `DISMANTLE_TOWER` command, Ping range check, resource return, grid/flowfield update
- [ ] Refactor: verify all tests green

---

## Phase 12: Blackwall & Gateways

> Implement Gateway mechanics, Blackwall degradation, and the closing loop.
>
> **TDD:** Write tests for Gateway lifecycle, HP reduction rates, and closure → implement → verify.

### 12.1. Gateway Entity & Spawning

_Rulebook §9.2_

- [ ] **Write failing tests:**
  - `createGateway(x, y)` produces entity with 10000 HP (§9.2.9)
  - Boundary Gateways placed on edge tiles (seeded RNG deterministic)
  - Interior Gateways created at correct positions (Orchestrator death, AI Overlord Phase 1)
  - Gateway tracks HP, isClosing status, assigned Blackwall Towers
- [ ] Implement: `createGateway()`, boundary vs interior creation, state tracking
- [ ] Refactor: verify all tests green

### 12.2. Blackwall Degradation Schedule

_Rulebook §8.5.1_

- [ ] **Write failing tests:**
  - New boundary Gateway appears at wave 1, 6, 11, 16, ...
  - Edge tile selection is deterministic with seeded RNG
- [ ] Implement: degradation schedule, seeded edge tile selection
- [ ] Refactor: verify all tests green

### 12.3. Gateway Closing Mechanic

_Rulebook §5.6, §9.2.6–9.2.9_

- [ ] **Write failing tests:**
  - Blackwall Tower reduces Gateway HP by ~0.139 HP/tick (1000/7200)
  - Multiple Blackwall Towers stack additively
  - Closing Gateway stops spawning enemies (§9.2.6)
  - All Blackwall Towers destroyed → Gateway immediately reopens (§9.2.7)
  - HP reaches 0 → permanently closed, removed from map (§9.2.8)
- [ ] Implement: HP reduction per tick, stacking, closure detection, reopen logic, permanent closure
- [ ] Refactor: verify all tests green

---

## Phase 13: Win/Lose Conditions

_Rulebook §10_

> **TDD:** Write tests for exact trigger conditions → implement → verify.

### 13.1. Lose Condition

- [ ] **Write failing tests:**
  - Enemy reaching Core deals damage to Core HP
  - Core HP reaches 0 → game phase becomes `GAME_OVER_LOSS`
  - Core HP > 0 → game does NOT end
- [ ] Implement: Core HP monitoring, phase transition on HP ≤ 0
- [ ] Refactor: verify all tests green

### 13.2. Win Condition

- [ ] **Write failing tests:**
  - All Gateways permanently closed AND no Orchestrators/AI Overlords alive → `GAME_OVER_WIN`
  - Open Gateways remain → win NOT triggered
  - Orchestrators still alive → win NOT triggered
- [ ] Implement: Gateway + enemy status check, phase transition
- [ ] Refactor: verify all tests green

---

## Phase 14: Enemy Movement Renderer

> Implement the complex visual movement system (edge-to-edge, arcs, constant speed).
>
> **TDD:** Enemy motion is a pure math function — ideal for test-driven development with exact expected positions.

### 14.1. Enemy Motion Module — `src/renderer/enemyMotion.ts`

_Rulebook §2.10.4–2.10.8, Tech.md §6.3_

- [ ] Define function signature: `(TilePos, TileProgress, PathState, SpawnImmunity, gridSize)` → `{ renderX, renderY, angleDeg }`
- [ ] **Write failing tests** (`src/renderer/__tests__/enemyMotion.test.ts`):
  - **Forward**: lerp from entry edge midpoint to exit edge midpoint; assert positions at progress 0, 0.5, 1.0
  - **TurnRight/TurnLeft**: quarter-circle arc (radius 0.5); assert arc positions at progress 0, 0.25, 0.5, 0.75, 1.0
  - **TurnAround**: pivot in place, no position change, only angle changes
  - **Intro**: lerp from tile center to first edge midpoint
  - **Outro**: lerp from last edge midpoint to Core center
  - **Inter-tick smoothing**: alpha = 0.5 produces halfway interpolation
  - **Progress factor**: calculations match §2.10.8 table
  - Spawn immunity: position is Gateway center, alpha pulses
- [ ] Implement: all movement states, arc math, lerp, alpha smoothing
- [ ] Refactor: verify all tests green, positions mathematically exact

**DoD:** All tests pass. Visual positions mathematically correct for all movement states.

### 14.2. Enemy Render Layer — `src/renderer/layers/enemy.layer.ts` ⚡

_Tech.md §6.2_

> _Implementation-first: visual rendering verified by inspection._

- [ ] Acquire sprites from pool for live enemies
- [ ] Call `enemyMotion()` each frame for each enemy
- [ ] Set sprite position, rotation, alpha based on output
- [ ] Health bar rendering above each enemy sprite
- [ ] Release sprites to pool on entity removal
- [ ] Spawn immunity pulsing alpha effect

**DoD:** Enemies render smoothly with correct positions, turns, and health bars.

---

## Phase 15: Tower & Pickup Renderers ⚡

> **Implementation-first:** Renderer work is verified visually, not via TDD.

### 15.1. Tower Render Layer — `src/renderer/layers/tower.layer.ts`

- [ ] Sprite per tower entity from pool
- [ ] Visual differentiation per tower type (color/shape placeholder sprites)
- [ ] Range indicator on hover/selection
- [ ] Rotation visual for Daemon Turret, ICE Sniper
- [ ] Firewall: render both towers + gap highlight
- [ ] Disabled state visual (Saboteur effect)
- [ ] Health bar for damaged towers

### 15.2. Pickup Render Layer — `src/renderer/layers/pickup.layer.ts`

- [ ] Sprite per pickup entity
- [ ] Decay visual: fade alpha as value decreases
- [ ] Collect animation (move toward Ping Tower)

### 15.3. Ghost Preview Layer — `src/renderer/layers/ghost.layer.ts`

_Tech.md §6.6_

- [ ] Semi-transparent tower sprite at hovered tile
- [ ] Green tint = valid, red tint = invalid
- [ ] Validate once per tile change only (cache result)
- [ ] Firewall: 2 ghost sprites + gap highlight
- [ ] Data Spike: facing direction arc overlay
- [ ] Blackwall Tower: adjacent Gateway highlight

### 15.4. FX Layer — `src/renderer/layers/fx.layer.ts`

- [ ] Projectile visuals (Data Spike spikes, Daemon shots, Sniper shots)
- [ ] Damage number popups
- [ ] Ability activation effects (EMP Blast ring, Overclock glow)
- [ ] Enemy death particles

---

## Phase 16: UI Layer (Vue + Pinia) ⚡

> Build the complete UI overlay.
>
> **Mostly implementation-first** for visual components. State bridge sync is testable via TDD.

### 16.1. State Bridge — `src/ui/stores/game.store.ts`

_Tech.md §8_

- [ ] **Write failing tests:**
  - `syncGameStore()` copies resources, Core HP, wave info, tower list, enemy count to Pinia store
  - Dirty flags: unchanged data is NOT re-copied
  - Synced values match ECS world state exactly
- [ ] Implement: `syncGameStore(world, gameStore)` — runs once per render frame, dirty flag optimization
- [ ] Refactor: verify all tests green

### 16.2. UI Store — `src/ui/stores/ui.store.ts`

- [ ] Selected tower type for placement
- [ ] Selected tower instance for inspection/upgrade
- [ ] Panel visibility states
- [ ] Targeting mode selection

### 16.3. HUD Component — `src/ui/components/HUD.vue`

- [ ] Display: Eddies (€$), Components, Core HP bar, wave number, enemy count
- [ ] Compact layout at top of screen

### 16.4. Tower Panel — `src/ui/components/TowerPanel.vue`

- [ ] Tower selection buttons (8 tower types)
- [ ] Cost display for each tower
- [ ] Affordability check (grey out if can't afford)
- [ ] Selected tower info: stats, upgrade button, ability info
- [ ] Dismantle button
- [ ] Targeting mode selector (for Daemon Turret, ICE Sniper)

### 16.5. Ability Bar — `src/ui/components/AbilityBar.vue`

- [ ] Active ability buttons for towers with unlocked abilities
- [ ] Cooldown display (radial or bar)
- [ ] Cost display
- [ ] Activation: push command to queue

### 16.6. Wave Timer — `src/ui/components/WaveTimer.vue`

- [ ] Break countdown display
- [ ] Skip button (pushes `SKIP_BREAK` command)
- [ ] Wave number and composition preview
- [ ] Boss wave warning indicator

### 16.7. Game Over Screen — `src/ui/components/GameOver.vue`

- [ ] Win screen: "Blackwall Restored" with stats
- [ ] Lose screen: "Core Compromised" with restart/exit options
- [ ] Wave survived count, towers built, enemies defeated

---

## Phase 17: Integration & Polish

> Connect all systems. First full playable build.
>
> **Mixed:** Replay system and wave skip use TDD. Integration testing and profiling are manual.

### 17.1. Full Pipeline Integration

- [ ] Verify all 14 systems run in correct order with real implementations
- [ ] Play through waves 1–10 manually and verify behavior matches rulebook
- [ ] Fix any integration issues (system interaction bugs, timing issues)

### 17.2. Deterministic Replay System

_Tech.md §10.2_

- [ ] **Write failing tests:**
  - Record + replay with same seed produces identical final world state hash
  - Different command sequence produces different hash
- [ ] Implement: record `{ tick, command }[]` + RNG seed; replay by feeding commands
- [ ] Create baseline replay fixtures:
  - `smoke.replay` — waves 1–5
  - `boss.replay` — wave 50 AI Overlord
  - `glitch-path.replay` — Glitch phasing
  - `gateway-close.replay` — full Gateway closure
- [ ] Refactor: verify all replay tests green
  - `gateway-close.replay` — full Gateway closure

### 17.3. Performance Profiling

- [ ] Add `performance.now()` instrumentation around `simulation.tick()` in dev mode
- [ ] Warn if tick > 4ms
- [ ] Profile with Chrome DevTools: verify zero GC pauses during gameplay
- [ ] Verify memory stays under 128MB
- [ ] Verify initial load < 1MB gzipped

### 17.4. Wave Skip Bonus

_Rulebook §8.3_

- [ ] **Write failing tests:**
  - `SKIP_BREAK` command grants 2× Eddie generation for 600 ticks
  - Bonus expires after 600 ticks (returns to 1×)
- [ ] Implement: `SKIP_BREAK` command processing, temporary generation multiplier
- [ ] Refactor: verify all tests green

### 17.5. Input Polish

- [ ] Keyboard shortcuts for tower selection (1–8)
- [ ] `R` key to rotate Firewall orientation / Data Spike facing
- [ ] `Esc` to cancel placement
- [ ] Hover tooltips for towers and enemies

---

## Phase 18: E2E Tests

_Tech.md §10.3_

### 18.1. Core E2E Scenarios (Playwright)

- [ ] Tower placement via click: ICE Wall, Firewall pair, Data Spike with facing
- [ ] Ability activation via UI button
- [ ] Wave skip via UI button
- [ ] Resource display matches simulation state
- [ ] Win condition triggers victory screen
- [ ] Lose condition triggers defeat screen
- [ ] Game restart from defeat screen

---

## Phase 19: Audio (TBD) ⚡

> Placeholder phase for sound effects and music.
>
> **Implementation-first:** Audio is verified by ear.

### 19.1. Audio System

- [ ] Background music (cyberpunk ambient / synthwave)
- [ ] Tower placement sound
- [ ] Tower attack sounds (per tower type)
- [ ] Enemy death sound
- [ ] Ability activation sounds
- [ ] Wave start / boss warning
- [ ] Core damage alert
- [ ] Win / lose jingles
- [ ] Volume controls in settings

---

## Phase 20: Visual Polish & Assets ⚡

> Replace placeholder graphics with final cyberpunk-themed assets.
>
> **Implementation-first:** Visual assets verified by inspection.

### 20.1. Sprite Assets

- [ ] Grid tileset (blue neon dotted lines)
- [ ] Core sprite (blue pulsing square)
- [ ] Tower sprites (8 types × idle/attack/disabled states)
- [ ] Enemy sprites (8 types × color variants for wave scaling)
- [ ] Pickup sprites (Eddies = gold, Components = blue)
- [ ] Blackwall boundary art (red degrading lines)
- [ ] Gateway sprite (pulsing red portal)
- [ ] Particle effects (damage, ability, death)

### 20.2. UI Theming

- [ ] Cyberpunk color palette: neon cyan, magenta, dark backgrounds
- [ ] Custom font (monospace / tech style)
- [ ] Panel styling with glow effects
- [ ] Health bar styling
- [ ] Tooltip styling

---

## Milestone Summary

| Milestone              | Phase | What's Playable                                           |
| ---------------------- | ----- | --------------------------------------------------------- |
| **Project Boots**      | 0     | Dev server runs, tests run                                |
| **ECS Foundation**     | 1–2   | World creates entities, constants defined                 |
| **Pathfinding Works**  | 3     | BFS produces correct flowfields                           |
| **Game Loop Runs**     | 4     | Tick pipeline executes at 60Hz                            |
| **Grid Visible**       | 5     | Grid, Core, and camera render on screen                   |
| **Enemies Walk**       | 6     | Enemies spawn, move to Core, deal damage                  |
| **First Tower**        | 7     | ICE Wall placeable, slows/damages enemies                 |
| **All Towers**         | 8     | All 8 tower types functional                              |
| **Abilities Work**     | 9     | All 5 abilities functional with upgrades                  |
| **All Enemies**        | 10    | All 8 enemy types with special behaviors                  |
| **Economy Flows**      | 11    | Full resource loop: earn, spend, collect, convert         |
| **Blackwall Closable** | 12    | Gateways can be permanently closed                        |
| **Winnable Game**      | 13    | Win and lose conditions trigger correctly                 |
| **Smooth Visuals**     | 14    | Enemies render with arcs and constant-speed interpolation |
| **Full Rendering**     | 15    | Towers, pickups, ghost preview, FX all render             |
| **Full UI**            | 16    | Complete HUD, panels, ability bar, wave timer             |
| **Release Candidate**  | 17–18 | Performance verified, replays, E2E tests, polish          |
| **Final Game**         | 19–20 | Audio, visual assets, full cyberpunk aesthetic            |

---

_Update this plan as development progresses. Check off tasks as they are completed._
