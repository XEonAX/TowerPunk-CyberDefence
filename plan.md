# TowerPunk: Cyber Defence — Development Plan

> Step-by-step implementation roadmap for agentic development. Each phase builds on the last. Every task references the relevant rulebook (§) and tech.md sections.

---

## How to Use This Plan

- **Phases are sequential** — complete each phase before starting the next.
- **Tasks within a phase** can often be parallelized unless noted otherwise.
- **Each task has a Definition of Done (DoD)** — the task is not complete until all criteria are met.
- **Rulebook cross-references** (§) indicate which game rules must be satisfied.
- **Check the box** (`[x]`) when a task is fully implemented and tested.

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

### 1.1. Entity ID Manager — `src/game/ecs/entity.ts`

_Tech.md §4.1.3_

- [ ] Implement entity ID pool: unsigned 32-bit integers with free-list recycling
- [ ] `create(): EntityId` — returns next available ID
- [ ] `destroy(eid: EntityId): void` — returns ID to free list
- [ ] `isAlive(eid: EntityId): boolean`
- [ ] Pre-allocate pool for at least 4096 entities
- [ ] Write unit tests: create, destroy, recycle, overflow behavior

**DoD:** All entity tests pass. Zero allocations after initial pool setup.

### 1.2. Component Registry — `src/game/ecs/component.ts`

_Tech.md §4.2, §4.1.4–4.1.5_

- [ ] Define `ComponentFlag` const enum — one bit per component type (Position, Health, TilePos, TileProgress, PathState, SpawnImmunity, Tower, Targeting, Rotation, Enemy, Immunity, Slow, Stun, Pickup, Harvester, PingRange, Ability, FirewallLink, Gateway, BlackwallTower)
- [ ] For each component, document which rulebook section it implements
- [ ] Export type definitions for each component's fields and their typed array backing

**DoD:** All component flags defined. Each has a doc comment citing its rulebook §.

### 1.3. World — `src/game/ecs/world.ts`

_Tech.md §4.1, §4.4_

- [ ] Create `World` type/interface holding:
  - Entity bitmask array (`Uint32Array`)
  - All component typed arrays (one per component field)
  - Entity pool reference
  - Game-level state: tick counter, RNG state, resource pools, command queue
- [ ] `createWorld(seed: number): World` — pre-allocates all arrays for max entity count
- [ ] Entity creation helpers by archetype: `createEnemy()`, `createTower()`, `createPickup()`, `createGateway()`, `createCore()`
- [ ] Entity destruction: `markForRemoval(eid)` sets a flag; actual cleanup deferred
- [ ] Write unit tests: world creation, entity creation per archetype, bitmask correctness

**DoD:** Can create a world, spawn entities of each archetype, query by bitmask, mark for removal. All tests pass.

### 1.4. System Runner — `src/game/ecs/system.ts`

_Tech.md §3.2_

- [ ] Define `System` type: `(world: World) => void`
- [ ] Create `TICK_PIPELINE` array (empty stubs for now — `noopSystem` placeholders)
- [ ] `runTick(world: World): void` — iterates `TICK_PIPELINE` and calls each system

**DoD:** `runTick()` calls each pipeline slot. A test confirms the order of execution.

### 1.5. Seeded PRNG — `src/game/rng.ts`

_Tech.md §9.4.5, Rulebook §1.9_

- [ ] Implement xorshift128 PRNG: `createRng(seed: number)` → `{ next(): number, nextFloat(): number, nextRange(min, max): number }`
- [ ] State is 4 × uint32 — stored in `World`
- [ ] Write tests: determinism (same seed → same sequence), distribution sanity check

**DoD:** RNG is deterministic. Tests prove identical outputs for identical seeds.

---

## Phase 2: Constants & Grid

> Define all rulebook constants and the core grid data structure.

### 2.1. Game Constants — `src/game/constants.ts`

_Rulebook §1–§10_

- [ ] Define all constants with rulebook cross-reference comments:
  ```typescript
  /** Rulebook §1.8 */ export const TICK_RATE = 60;
  /** Rulebook §2.1 */ export const GRID_SIZE = 51;
  /** Rulebook §2.9 */ export const CORE_X = 25; // 0-indexed
  /** Rulebook §2.9 */ export const CORE_Y = 25;
  /** Rulebook §2.10.1 */ export const SPAWN_IMMUNITY_TICKS = 30;
  /** Rulebook §3.3 */ export const CORE_STARTING_HP = 100;
  /** Rulebook §4.3.1 */ export const INITIAL_EDDIES = 400;
  /** Rulebook §4.3.1 */ export const INITIAL_COMPONENTS = 3;
  /** Rulebook §4.2.9 */ export const EDDIES_PER_COMPONENT = 100;
  /** Rulebook §3.1.3 */ export const MAX_TICKS_PER_FRAME = 4;
  // ... all tower costs, enemy stats, wave formula params, etc.
  ```
- [ ] Define tower stat tables (cost arrays, HP per level, damage per level)
- [ ] Define enemy stat tables (base HP, damage, speed, tier multiplier, immunities)
- [ ] Define ability stat tables (cooldowns, durations, boost percentages)
- [ ] Define wave formula constants (break duration scaling, enemy scaling multiplier)

**DoD:** Every numeric value from the rulebook has a named constant. Tests assert key values match the rulebook.

### 2.2. Grid State — `src/game/pathfinding/grid.ts`

_Tech.md §5.4, Rulebook §2.1–2.6_

- [ ] `Grid` type: `{ blocked: Uint8Array, towerType: Uint8Array }` (both `GRID_SIZE × GRID_SIZE`)
- [ ] `createGrid(): Grid` — all tiles empty, Core tile marked
- [ ] `isOccupied(grid, x, y): boolean`
- [ ] `isEdgeTile(x, y): boolean` — §2.6.3
- [ ] `setBlocked(grid, x, y, towerType): void`
- [ ] `clearBlocked(grid, x, y): void`
- [ ] `idx(x, y): number` — flat index helper
- [ ] Write unit tests: edge tiles, occupied tiles, Core tile

**DoD:** Grid correctly identifies edge tiles, occupied tiles, and Core position. Tests pass.

---

## Phase 3: Pathfinding

> Implement BFS flowfield, dual fields for Glitch, and placement validation.

### 3.1. BFS Flowfield — `src/game/pathfinding/flowfield.ts`

_Tech.md §5.1–5.2_

- [ ] `computeFlowfield(grid, blockedSet): { cost: Uint16Array, dir: Uint8Array }`
- [ ] BFS from Core tile (25, 25 in 0-indexed)
- [ ] 4-directional only (N, S, E, W) — no diagonals (§7.0.2)
- [ ] Unreachable tiles: cost = `0xFFFF`, dir = `0xFF`
- [ ] Define `Dir` const enum: N=0, S=1, E=2, W=3, NONE=0xFF
- [ ] Define `DirChange` const enum: NONE=0, TURN_RIGHT=1, TURN_LEFT=2, TURN_AROUND=3
- [ ] Write tests:
  - [ ] Empty grid: all tiles reachable, cost increases outward
  - [ ] Single blocked tile: paths route around it
  - [ ] Corridor: correct direction field
  - [ ] Core tile: cost=0, dir=NONE

**DoD:** BFS produces correct cost and direction fields for various grid configurations. Tests pass.

### 3.2. Dual Flowfields

_Tech.md §5.2_

- [ ] `computeDualFlowfields(grid)` → `{ standard: Flowfield, glitch: Flowfield }`
- [ ] Standard: all tower tiles blocked
- [ ] Glitch: ICE Wall and Firewall tiles passable, all others blocked (§7.4.1)
- [ ] Both recomputed together on grid change
- [ ] Write tests:
  - [ ] Glitch field allows path through ICE Wall tiles
  - [ ] Glitch field still blocked by Data Spike, Daemon Turret, etc.
  - [ ] Standard field blocked by all tower types

**DoD:** Both flowfields computed correctly. Glitch field allows passage through ICE Wall + Firewall only.

### 3.3. Placement Validation — `canPlaceTower()` and `canPlaceFirewallPair()`

_Tech.md §5.3, §5.5–5.6, Rulebook §2.6_

- [ ] Pre-allocate scratch `Uint16Array(GRID_SIZE * GRID_SIZE)` — module-level, reused
- [ ] `canPlaceTower(grid, gateways, x, y): boolean`
  - Check occupied (§2.6.1), edge tile (§2.6.3)
  - Run scratch BFS with (x,y) temporarily blocked
  - Verify all gateway tiles reachable (§2.6.4)
- [ ] `canPlaceFirewallPair(grid, gateways, t1, gap, t2): boolean`
  - All 3 tiles unoccupied and non-edge
  - Single scratch BFS blocking both t1 and t2 (gap stays walkable)
  - Verify all gateway tiles reachable
- [ ] Write tests:
  - [ ] Valid placements accepted
  - [ ] Placement on occupied tile rejected
  - [ ] Placement on edge tile rejected
  - [ ] Placement that would block all paths rejected
  - [ ] Firewall pair blocks both tower tiles but not gap
  - [ ] Zero allocations during validation

**DoD:** Placement validation works correctly for all edge cases. Scratch buffer reused (zero alloc). Tests pass.

---

## Phase 4: Game Loop & Simulation Shell

> Wire up the fixed-timestep game loop and tick pipeline with stub systems.

### 4.1. Simulation Driver — `src/game/simulation.ts`

_Tech.md §3.1_

- [ ] `createSimulation(seed: number)` → `{ world, tick(), getWorld() }`
- [ ] `tick()` runs all systems in `TICK_PIPELINE` order, increments `world.tickCount`
- [ ] Export `TICK_RATE`, `TICK_DURATION` constants
- [ ] Command queue: `world.commandQueue: Command[]` — flushed at tick start

**DoD:** Calling `tick()` N times advances `world.tickCount` to N. Pipeline runs in order.

### 4.2. Game Loop (RAF) — `src/game/gameLoop.ts`

_Tech.md §3.1_

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

## Phase 5: Core Renderer

> Get the grid, Core, and camera rendering on screen. No gameplay yet — just the visual scaffold.

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

### 6.1. Command System — `src/game/systems/command.system.ts`

_Tech.md §3.2, §8.2_

- [ ] Flush `world.commandQueue` each tick
- [ ] Process command types: `START_WAVE`, `PLACE_TOWER` (others as stubs)
- [ ] `PLACE_TOWER`: validate with `canPlaceTower()`, create tower entity, recompute flowfields
- [ ] `START_WAVE`: trigger wave start in event system state

**DoD:** Player commands are processed. Tower placement validated and executed. Flowfields recomputed.

### 6.2. Event System — `src/game/systems/event.system.ts`

_Rulebook §1.10.1, §8.2, §9.2_

- [ ] Track game phase: `PRE_GAME`, `WAVE_BREAK`, `WAVE_ACTIVE`, `GAME_OVER`
- [ ] Schedule wave triggers: wave start, wave end detection (all enemies dead or reached Core)
- [ ] Schedule Blackwall degradation: new Gateway every 5 waves starting from wave 1 (§8.5.1)
- [ ] Gateway HP reduction tick processing (Blackwall Tower damage to Gateways)
- [ ] Phase transition: `WAVE_BREAK` → `WAVE_ACTIVE` on start trigger

**DoD:** Game phases transition correctly. Waves start and end. Blackwall degrades on schedule.

### 6.3. Spawn System — `src/game/systems/spawn.system.ts`

_Rulebook §1.10.2, §2.10.1, §7.0.6, Tech.md §3.3_

- [ ] Read wave definition to determine enemy composition for current wave
- [ ] Round-robin spawning: one enemy per tick across active Gateways
- [ ] On spawn:
  - Create enemy entity with correct archetype components
  - Set `TilePos` to Gateway tile
  - Set `SpawnImmunity.remainingTicks = 30`
  - Set `TileProgress.progress = 0`
  - Set stats from constants (scaled by wave multiplier §8.4.1)
- [ ] Maintain `nextGatewayIndex` counter for deterministic round-robin
- [ ] Skip closed/closing Gateways
- [ ] Write tests:
  - [ ] Enemy spawns at Gateway tile
  - [ ] Spawn immunity set to 30 ticks
  - [ ] Round-robin across multiple Gateways
  - [ ] Wave scaling applied correctly

**DoD:** Enemies spawn from Gateways in round-robin. Stats scaled by wave. Immunity set. Tests pass.

### 6.4. Status Expire System — `src/game/systems/statusExpire.system.ts`

_Rulebook §1.10.4, §2.10.1_

- [ ] Decrement `SpawnImmunity.remainingTicks` for all immune enemies
- [ ] When immunity reaches 0:
  - Set `TileProgress.progress = 0.5` (center of tile)
  - Initialize `PathState` from flowfield (Tech.md §3.3.3)
  - Set `progressFactor = 2 × speed` (Intro state)
- [ ] Decrement `Slow.remainingTicks`, clear slow when expired
- [ ] Decrement `Stun.remainingTicks`, clear stun when expired
- [ ] Write tests:
  - [ ] Immunity countdown and expiry initialization
  - [ ] Slow expiry clears magnitude
  - [ ] Stun expiry clears remaining ticks

**DoD:** Status effects expire correctly. Spawn immunity initializes PathState on expiry. Tests pass.

### 6.5. Movement System — `src/game/systems/movement.system.ts`

_Rulebook §1.10.5, §2.10.2–2.10.3, Tech.md §3.4_

- [ ] For each enemy with `SpawnImmunity.remainingTicks == 0`:
  - If stunned: skip (freeze progress)
  - Compute effective speed: `baseSpeed × (1 - slowMagnitude)` if slowed
  - Increment `TileProgress.progress` by `effectiveSpeed / TICK_RATE × progressFactor`
- [ ] On tile transition (`progress >= 1.0`):
  - Normalize leftover progress
  - Update `TilePos` to `PathState.toX/toY` (tile-entered event)
  - Look up next direction from flowfield
  - Compute `directionChange` by comparing old vs new direction
  - Compute new `progressFactor` from movement state table (§2.10.8)
  - Apply new factor to progress
- [ ] Core entry detection: if `toX/toY == Core`, set Outro state; if arrived, apply damage + mark removal
- [ ] Write tests:
  - [ ] Progress advances correctly per tick
  - [ ] Tile transition fires at progress >= 1.0
  - [ ] Direction change classification (None, TurnRight, TurnLeft, TurnAround)
  - [ ] Progress factor adjustment for each movement state
  - [ ] Stun freezes movement
  - [ ] Slow reduces speed
  - [ ] Core entry applies damage and removes enemy

**DoD:** Enemies move along flowfield. Tile transitions update position and PathState. Core damage works. Tests pass.

### 6.6. Cleanup System — `src/game/systems/cleanup.system.ts`

_Rulebook §1.10.12_

- [ ] Iterate all entities marked for removal
- [ ] For enemies: create Pickup entity at their position (Eddie + Component drops per §7.0.8)
- [ ] For towers: handle Firewall death cascade (§5.2.4), create Component pickup if applicable
- [ ] Actually destroy entities (return IDs to pool, clear bitmasks)
- [ ] Write tests:
  - [ ] Dead enemy creates pickup with correct value
  - [ ] Dead tower cleaned up and entity recycled
  - [ ] Firewall partner destruction cascade

**DoD:** Dead entities removed. Pickups created from enemy drops. Firewall cascade works. Tests pass.

### 6.7. Wave Definitions — `src/game/wave.ts`

_Rulebook §8_

- [ ] Define wave compositions for at least waves 1–10 (§8.7 table)
- [ ] Wave scaling formula: `stat × (1 + 0.1 × (waveNumber - 1))` (§8.4.1)
- [ ] Break duration formula: `1800 - ((wave - 10) × (1740 / 30))` ticks, floored at 60 (§8.2.3)
- [ ] Boss wave flag: AI Overlord every 10 waves from wave 50 (§8.6.1)
- [ ] Write tests:
  - [ ] Wave 1 composition matches rulebook
  - [ ] Scaling produces correct stats at wave 10
  - [ ] Break duration at wave 10 = 1800, wave 40 = 60

**DoD:** Wave data matches rulebook exactly. Scaling formula verified by tests.

---

## Phase 7: Basic Tower Systems

> Implement tower placement, targeting, and damage. Player can build ICE Walls and see enemies interact with them.

### 7.1. ICE Wall Tower

_Rulebook §5.1_

- [ ] Placement: `PLACE_TOWER` command creates ICE Wall entity at specified tile
- [ ] Grid update: mark tile blocked, recompute both flowfields
- [ ] Slow aura: apply 20% slow to all enemies on adjacent tiles (§5.1.1)
- [ ] DoT: 1/60 damage/tick to adjacent enemies (§5.1.2, applies to Glitches passing through too §5.1)
- [ ] Health: 200 HP at level 1
- [ ] Write tests for slow application, DoT, pathfinding update

**DoD:** ICE Wall placed, blocks pathing, slows and damages adjacent enemies. Tests pass.

### 7.2. Targeting System — `src/game/systems/targeting.system.ts`

_Rulebook §1.10.7_

- [ ] For each tower entity with Targeting component:
  - Skip if disabled (Saboteur effect)
  - Check cooldown: if `cooldownRemaining > 0`, decrement and skip
  - Find valid targets within range (Chebyshev distance from tower Position)
  - Apply targeting mode: Closest (default), Highest HP, Lowest HP
  - Mark target(s) for damage system
  - Reset cooldown
- [ ] ICE Wall special: always-on aura, no cooldown (targets all adjacent enemies)
- [ ] Handle rotation for Daemon Turret, ICE Sniper: only fire if facing target within tolerance
- [ ] Write tests:
  - [ ] Tower targets enemy in range
  - [ ] Tower ignores enemy out of range
  - [ ] Cooldown prevents firing
  - [ ] Targeting modes select correct enemy
  - [ ] ICE Sniper respects minimum range (§5.5.2)

**DoD:** Towers acquire targets correctly. Cooldowns work. Targeting modes functional. Tests pass.

### 7.3. Damage System — `src/game/systems/damage.system.ts`

_Rulebook §1.10.8–9_

- [ ] Apply tower damage to targeted enemies
  - Per-tick DPS towers (ICE Wall, Firewall): damage each tick to in-range enemies
  - Projectile towers (Data Spike, Daemon Turret, ICE Sniper): damage on fire event
- [ ] Apply enemy damage to towers (VDB Netrunner aura — §7.6.2)
- [ ] Mark entities for removal when HP <= 0
- [ ] Respect enemy immunities (§7.0–7.8):
  - Orchestrator immune to ICE Wall DoT and Firewall damage (§7.5.2)
  - All damage types check immunity bitmask
- [ ] Write tests:
  - [ ] DPS damage applied correctly per tick
  - [ ] Projectile damage on fire only
  - [ ] Enemy dies at 0 HP
  - [ ] Immunity prevents specific damage types

**DoD:** Damage applied correctly. Immunities respected. Entities die at 0 HP. Tests pass.

### 7.4. Status Apply System — `src/game/systems/statusApply.system.ts`

_Rulebook §1.10.3, §7.0.10–7.0.16_

- [ ] Apply queued status effects from previous tick:
  - **Slow**: check current slow — replace only if new magnitude > current (§7.0.15)
  - **Stun**: check current stun — replace only if new duration > remaining (§7.0.16)
  - Stun clears active slow (§7.0.12)
  - Cannot apply slow to stunned enemy (§7.0.13)
  - Check immunity bitmask before applying (§7.0.14)
- [ ] Write tests for every interaction rule:
  - [ ] Stronger slow replaces weaker
  - [ ] Weaker slow ignored
  - [ ] Stun clears slow
  - [ ] Slow cannot apply during stun
  - [ ] Stun-immune enemy ignores stun
  - [ ] Slow-immune enemy ignores slow

**DoD:** All status effect interaction rules from §7.0.10–7.0.16 implemented and tested.

### 7.5. Status Queue System — `src/game/systems/statusQueue.system.ts`

_Rulebook §1.10.10_

- [ ] Queue slow/stun effects produced this tick (from tower hits, Firewall gap, ICE Wall aura)
- [ ] These are applied next tick by statusApplySystem
- [ ] Write tests: effects queued correctly, applied on next tick

**DoD:** Status effects queued and deferred to next tick. Tests pass.

---

## Phase 8: All Tower Types

> Implement remaining towers one at a time. Each tower is a focused task.

### 8.1. Firewall — _Rulebook §5.2_

- [ ] Pair placement: 2 entities linked via `FirewallLink` component
- [ ] Gap tile stun: enemies on gap tile stunned for 60 ticks every tick (stun-locked)
- [ ] DPS to enemies in gap
- [ ] Firewall Breacher immunity to stun (still takes damage) — §5.2.2
- [ ] Death cascade: destroying either tower destroys both (§5.2.4)
- [ ] Death burst damage to enemies on adjacent tiles of partner (§5.2.5)
- [ ] Placement validation via `canPlaceFirewallPair()` — §5.6
- [ ] Orientation: horizontal, vertical, diagonal
- [ ] Tests for all behaviors

### 8.2. Data Spike — _Rulebook §5.3_

- [ ] Fixed facing direction (set at placement, immutable)
- [ ] 90° cone targeting (3 tiles wide at each range distance)
- [ ] Piercing: hits all enemies in path
- [ ] Fire rate: 1 spike / 120 ticks
- [ ] Range increases with level
- [ ] Tests for cone shape, piercing, facing directions

### 8.3. Daemon Turret — _Rulebook §5.4_

- [ ] Rotation component: rotates toward target at 0.5 deg/tick (level 1)
- [ ] Fires only when facing target (within tolerance)
- [ ] Multi-target: damages all enemies on target tile
- [ ] Targeting modes: Closest, Highest HP, Lowest HP
- [ ] Fire rate improves with upgrades
- [ ] Tests for rotation, targeting modes, multi-target damage

### 8.4. ICE Sniper — _Rulebook §5.5_

- [ ] Minimum range (3 tiles) — skip close enemies
- [ ] Single-target, high damage
- [ ] On-hit slow (20% for 120 ticks at level 1)
- [ ] Rotation: tracks targets
- [ ] Targeting modes: Closest, Highest HP, Lowest HP
- [ ] Tests for min range, on-hit slow, single-target

### 8.5. Ping Tower — _Rulebook §5.7_

- [ ] Collection range (3 tiles at level 1, Chebyshev distance)
- [ ] Auto-collect pickups within range
- [ ] Enable Harvester Eddie generation for Harvesters within range (§5.7.2)
- [ ] Tests for pickup collection, Harvester enabling

### 8.6. Harvester — _Rulebook §5.8_

- [ ] Generates Eddies per tick (only if within Ping Tower range)
- [ ] Component generation from level 3
- [ ] Tests for generation rate, Ping Tower dependency

### 8.7. Blackwall Tower — _Rulebook §5.6_

- [ ] Must be adjacent to a Gateway
- [ ] Reduces Gateway HP per tick (§5.6.2, §9.2.9)
- [ ] Takes passive damage from adjacent open Gateway (§5.6.6)
- [ ] Auto-repair consumes Components (§5.6.7)
- [ ] Gateway closes when HP reaches 0 (§5.6.5)
- [ ] Tests for Gateway HP reduction, passive damage, auto-repair, Gateway closing

---

## Phase 9: Tower Upgrades & Abilities

> Implement the upgrade system and all 5 ability types.

### 9.1. Upgrade System

_Rulebook §5.0.3–5.0.7_

- [ ] `UPGRADE_TOWER` command: validate cost (Eddies + Components), deduct resources
- [ ] Apply stat changes per tower's upgrade table
- [ ] Max level 10 cap
- [ ] Ability unlock at level 5
- [ ] Tests for cost doubling, stat changes, max level, ability unlock

### 9.2. EMP Blast — _Rulebook §6.1_

- [ ] Unlocked by ICE Wall at level 5
- [ ] Stuns all enemies in tower's range for duration
- [ ] Data Leech immune (§6.1.3)
- [ ] Cooldown: 600 ticks (base)
- [ ] Tests for stun, immunity, cooldown

### 9.3. Overclock — _Rulebook §6.2_

- [ ] Unlocked by Data Spike, Daemon Turret, ICE Sniper, Harvester at level 5
- [ ] +50% fire rate (base) for 300 ticks
- [ ] Harvester variant: +50% Eddie generation rate
- [ ] Cooldown: 1200 ticks
- [ ] Tests for fire rate boost, Harvester variant, cooldown

### 9.4. Tuned — _Rulebook §6.3_

- [ ] Unlocked by Firewall at level 5
- [ ] Bonus damage vs selected enemy type
- [ ] Player can switch target type (cooldown: 1200 ticks base)
- [ ] Tests for damage bonus, type switching, cooldown

### 9.5. Boosted — _Rulebook §6.4_

- [ ] Unlocked by Ping Tower at level 5 (mutually exclusive with Oracle)
- [ ] Permanently +50% Eddie generation for Harvesters in range
- [ ] Tests for permanent buff, mutual exclusivity

### 9.6. Oracle — _Rulebook §6.5_

- [ ] Unlocked by Ping Tower at level 5 (mutually exclusive with Boosted)
- [ ] Permanently +50% collection range
- [ ] Tests for range increase, mutual exclusivity

---

## Phase 10: All Enemy Types

> Implement enemy-specific behaviors. Base enemy movement already works from Phase 6.

### 10.1. Data Leech — _Rulebook §7.1_

- [ ] Stun immune, slow immune (already at minimum speed)
- [ ] Tests for immunities

### 10.2. Code Runner — _Rulebook §7.2_

- [ ] Fast, fragile — verify speed scaling
- [ ] Can be stunned and slowed
- [ ] Tests for speed, stun/slow susceptibility

### 10.3. Firewall Breacher — _Rulebook §7.3_

- [ ] Immune to ICE Wall slow, Firewall stun
- [ ] Can be stunned by EMP Blast (not Firewall)
- [ ] Tests for specific immunities

### 10.4. Glitch — _Rulebook §7.4_

- [ ] Phases through ICE Wall and Firewall tiles (uses Glitch flowfield)
- [ ] Still takes ICE Wall DoT when passing through adjacent tile (§7.4.4)
- [ ] Tests for phasing, Glitch flowfield usage, DoT

### 10.5. Orchestrator — _Rulebook §7.5_

- [ ] Spawns Gateway on death at death location
- [ ] Immune to ICE Wall DoT and Firewall damage
- [ ] Tests for death Gateway spawn, immunities

### 10.6. VDB Netrunner — _Rulebook §7.6_

- [ ] Tower damage aura: deals damage to all towers within 1 tile as it enters each tile
- [ ] Implement in `enemyAura.system.ts` (§1.10.6)
- [ ] Tests for tower damage on tile entry

### 10.7. Saboteur — _Rulebook §7.7_

- [ ] Disables towers within 1-tile radius for 300 ticks every 600 ticks
- [ ] Disabled towers cannot attack but still block movement
- [ ] Tests for disable pulse, timing, tower blocking still works

### 10.8. AI Overlord (Boss) — _Rulebook §7.8_

- [ ] 3 phases with automatic transitions (1800 ticks each)
- [ ] Phase 1: immune to all damage, spawns Gateways every 5 tiles walked
- [ ] Phase 2: vulnerable, spawns Glitches every 5 tiles walked
- [ ] Phase 3: +50% damage taken, spawns Orchestrators every 5 tiles walked
- [ ] Can be slowed and stunned in all phases
- [ ] Tests for phase transitions, immunity, spawning behaviors

---

## Phase 11: Economy & Resources

> Wire up the full resource flow: Eddies, Components, pickups, conversion.

### 11.1. Pickup Decay System — `src/game/systems/pickupDecay.system.ts`

_Rulebook §1.10.11, §4.2.5_

- [ ] Pickups outside Ping range: decay at 5/60 ≈ 0.083% of initial value per tick
- [ ] Remove pickup when value reaches 0
- [ ] Tests for decay rate, removal at 0

### 11.2. Pickup Collect System — `src/game/systems/pickupCollect.system.ts`

_Rulebook §1.10.13, §5.7.1_

- [ ] Ping Towers auto-collect pickups within range
- [ ] Add collected Eddies/Components to player pool
- [ ] Tests for collection, range check

### 11.3. Resource System — `src/game/systems/resource.system.ts`

_Rulebook §1.10.14_

- [ ] Harvester Eddie generation (only if Ping-connected)
- [ ] Harvester Component generation (level 3+)
- [ ] Blackwall Tower auto-repair (consume Components)
- [ ] Tests for all generation and consumption rates

### 11.4. Component Conversion

_Rulebook §4.2.9_

- [ ] `CONVERT_EDDIES` command: 100 Eddies → 1 Component
- [ ] Validate player has enough Eddies
- [ ] Tests for conversion

### 11.5. Tower Dismantling

_Rulebook §4.2.6–4.2.7_

- [ ] `DISMANTLE_TOWER` command
- [ ] Within Ping range: return 100% Components
- [ ] Outside Ping range: 0% (left to decay)
- [ ] Recompute flowfields on removal
- [ ] Tests for Component return with/without Ping

---

## Phase 12: Blackwall & Gateways

> Implement Gateway mechanics, Blackwall degradation, and the closing loop.

### 12.1. Gateway Entity & Spawning

_Rulebook §9.2_

- [ ] `createGateway(x, y)` with 10000 HP (§9.2.9)
- [ ] Boundary Gateways: placed on edge tiles via seeded RNG (§9.2.2)
- [ ] Interior Gateways: created by Orchestrator death or AI Overlord Phase 1
- [ ] Gateway tracks: HP, isClosing status, assigned Blackwall Towers
- [ ] Tests for creation, HP, boundary vs interior

### 12.2. Blackwall Degradation Schedule

_Rulebook §8.5.1_

- [ ] New boundary Gateway every 5 waves starting wave 1
- [ ] Random (seedable) edge tile selection for new Gateways
- [ ] Tests for degradation timing, correct wave triggers

### 12.3. Gateway Closing Mechanic

_Rulebook §5.6, §9.2.6–9.2.9_

- [ ] Blackwall Tower reduces assigned Gateway HP by ~0.139 HP/tick (1000/7200)
- [ ] Multiple towers stack additively
- [ ] Closing Gateway stops spawning (§9.2.6)
- [ ] All Blackwall Towers destroyed → Gateway immediately reopens (§9.2.7)
- [ ] HP reaches 0 → permanently closed, removed from map (§9.2.8)
- [ ] Tests for HP reduction rate, stacking, reopening, permanent closure

---

## Phase 13: Win/Lose Conditions

_Rulebook §10_

### 13.1. Lose Condition

- [ ] Monitor Core HP each tick
- [ ] When Core HP reaches 0, set game phase to `GAME_OVER_LOSS`
- [ ] Tests: enemy reaching Core deals damage, Core HP 0 triggers loss

### 13.2. Win Condition

- [ ] All Gateways permanently closed AND no Orchestrators/AI Overlords alive (§10.1.2)
- [ ] Set game phase to `GAME_OVER_WIN`
- [ ] Tests: win triggers with correct conditions, does not trigger prematurely

---

## Phase 14: Enemy Movement Renderer

> Implement the complex visual movement system (edge-to-edge, arcs, constant speed).

### 14.1. Enemy Motion Module — `src/renderer/enemyMotion.ts`

_Rulebook §2.10.4–2.10.8, Tech.md §6.3_

- [ ] Pure function: `(TilePos, TileProgress, PathState, SpawnImmunity, gridSize)` → `{ renderX, renderY, angleDeg }`
- [ ] **Intro state**: lerp from tile center to first edge
- [ ] **Forward state**: lerp from entry edge to exit edge
- [ ] **TurnRight/TurnLeft**: quarter-circle arc (radius 0.5) around corner pivot
- [ ] **TurnAround**: pivot in place (rotation only)
- [ ] **Outro**: lerp from last edge to Core center
- [ ] Inter-tick smoothing with `alpha` value
- [ ] Spawn immunity: pulsing transparency at Gateway center
- [ ] Write extensive tests:
  - [ ] Edge midpoint positions for Forward
  - [ ] Arc positions for TurnRight/TurnLeft
  - [ ] Pivot-only for TurnAround
  - [ ] Core center for Outro
  - [ ] Progress factor calculations match §2.10.8

**DoD:** Visual positions mathematically correct for all movement states. Tests pass.

### 14.2. Enemy Render Layer — `src/renderer/layers/enemy.layer.ts`

_Tech.md §6.2_

- [ ] Acquire sprites from pool for live enemies
- [ ] Call `enemyMotion()` each frame for each enemy
- [ ] Set sprite position, rotation, alpha based on output
- [ ] Health bar rendering above each enemy sprite
- [ ] Release sprites to pool on entity removal
- [ ] Spawn immunity pulsing alpha effect

**DoD:** Enemies render smoothly with correct positions, turns, and health bars.

---

## Phase 15: Tower & Pickup Renderers

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

## Phase 16: UI Layer (Vue + Pinia)

> Build the complete UI overlay.

### 16.1. State Bridge — `src/ui/stores/game.store.ts`

_Tech.md §8_

- [ ] `syncGameStore(world, gameStore)` — runs once per render frame
- [ ] Sync: resources (Eddies, Components), Core HP, wave info, tower list, enemy count
- [ ] Dirty flags: only copy changed data
- [ ] Tests for sync correctness

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

### 17.1. Full Pipeline Integration

- [ ] Verify all 14 systems run in correct order with real implementations
- [ ] Play through waves 1–10 manually and verify behavior matches rulebook
- [ ] Fix any integration issues (system interaction bugs, timing issues)

### 17.2. Deterministic Replay System

_Tech.md §10.2_

- [ ] Record: capture `{ tick, command }[]` + RNG seed on every playthrough
- [ ] Replay: feed recorded commands, assert final world state hash matches
- [ ] Create baseline replay fixtures:
  - `smoke.replay` — waves 1–5
  - `boss.replay` — wave 50 AI Overlord
  - `glitch-path.replay` — Glitch phasing
  - `gateway-close.replay` — full Gateway closure

### 17.3. Performance Profiling

- [ ] Add `performance.now()` instrumentation around `simulation.tick()` in dev mode
- [ ] Warn if tick > 4ms
- [ ] Profile with Chrome DevTools: verify zero GC pauses during gameplay
- [ ] Verify memory stays under 128MB
- [ ] Verify initial load < 1MB gzipped

### 17.4. Wave Skip Bonus

_Rulebook §8.3_

- [ ] `SKIP_BREAK` command grants 2× Eddie generation for 600 ticks
- [ ] Tests: bonus applied, duration correct

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

## Phase 19: Audio (TBD)

> Placeholder phase for sound effects and music.

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

## Phase 20: Visual Polish & Assets

> Replace placeholder graphics with final cyberpunk-themed assets.

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

| Milestone              | Phase | What's Playable                                          |
| ---------------------- | ----- | -------------------------------------------------------- |
| **Project Boots**      | 0     | Dev server runs, tests run                               |
| **ECS Foundation**     | 1–2   | World creates entities, constants defined                |
| **Pathfinding Works**  | 3     | BFS produces correct flowfields                          |
| **Game Loop Runs**     | 4     | Tick pipeline executes at 60Hz                           |
| **Grid Visible**       | 5     | Grid, Core, and camera render on screen                  |
| **Enemies Walk**       | 6     | Enemies spawn, move to Core, deal damage                 |
| **First Tower**        | 7     | ICE Wall placeable, slows/damages enemies                |
| **All Towers**         | 8     | All 8 tower types functional                             |
| **Abilities Work**     | 9     | All 5 abilities functional with upgrades                 |
| **All Enemies**        | 10    | All 8 enemy types with special behaviors                 |
| **Economy Flows**      | 11    | Full resource loop: earn, spend, collect, convert        |
| **Blackwall Closable** | 12    | Gateways can be permanently closed                       |
| **Winnable Game**      | 13    | Win and lose conditions trigger correctly                 |
| **Smooth Visuals**     | 14    | Enemies render with arcs and constant-speed interpolation |
| **Full Rendering**     | 15    | Towers, pickups, ghost preview, FX all render            |
| **Full UI**            | 16    | Complete HUD, panels, ability bar, wave timer            |
| **Release Candidate**  | 17–18 | Performance verified, replays, E2E tests, polish         |
| **Final Game**         | 19–20 | Audio, visual assets, full cyberpunk aesthetic            |

---

_Update this plan as development progresses. Check off tasks as they are completed._
