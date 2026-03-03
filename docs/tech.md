# TowerPunk: Cyber Defence — Technical Specification

> Implementation guidelines, tech stack, algorithms, and coding patterns for the browser-based tower defence game. Cross-references the [Rulebook](rulebook.md) where relevant.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Game Loop & Tick System](#3-game-loop--tick-system)
4. [ECS Architecture](#4-ecs-architecture)
5. [Pathfinding](#5-pathfinding)
6. [Rendering (PixiJS)](#6-rendering-pixijs)
7. [UI Layer (Vue + Pinia)](#7-ui-layer-vue--pinia)
8. [State Bridge: Sim ↔ UI](#8-state-bridge-sim--ui)
9. [Code Style & Conventions](#9-code-style--conventions)
10. [Testing Strategy](#10-testing-strategy)
11. [Build & Deployment](#11-build--deployment)
12. [Performance Budget](#12-performance-budget)

---

## 1. Tech Stack

| Layer             | Technology                               | Purpose                                    |
| ----------------- | ---------------------------------------- | ------------------------------------------ |
| Language          | TypeScript (strict mode)                 | All game logic, UI, and tooling            |
| UI Framework      | Vue 3 (Composition API)                  | HUD, menus, overlays, settings             |
| UI State          | Pinia                                    | Reactive UI state (resources, wave info)   |
| Graphics          | PixiJS 8                                 | 2D rendering — grid, towers, enemies, FX   |
| Build Tool        | Vite                                     | Dev server, HMR, production bundling       |
| Linting           | ESLint (flat config)                     | Code quality enforcement                   |
| Formatting        | Prettier                                 | Consistent code formatting                 |
| Unit Testing      | Vitest                                   | Simulation logic, ECS systems, pathfinding |
| E2E Testing       | Playwright                               | Full browser integration tests             |
| Package Manager   | pnpm                                     | Fast, disk-efficient dependency management |
| Deployment Target | Static SPA (Netlify / Vercel / GH Pages) | No backend required                        |

---

## 2. Project Structure

```
src/
├── main.ts                     # App entry — mounts Vue, bootstraps PixiJS
├── game/
│   ├── ecs/
│   │   ├── world.ts            # ECS World — entity creation, component registry
│   │   ├── entity.ts           # Entity ID management (u32 pool)
│   │   ├── component.ts        # Component type definitions (SoA typed arrays)
│   │   └── system.ts           # System base interface
│   ├── systems/
│   │   ├── command.system.ts       # Player command processing (before §1.10.1)
│   │   ├── spawn.system.ts         # §1.10.2 — enemy spawning
│   │   ├── statusEffect.system.ts  # §1.10.3–4 — apply/expire status effects
│   │   ├── movement.system.ts      # §1.10.5 — enemy movement via flowfield
│   │   ├── enemyAura.system.ts     # §1.10.6 — VDB Netrunner tower damage
│   │   ├── targeting.system.ts     # §1.10.7 — tower target acquisition
│   │   ├── damage.system.ts        # §1.10.8–9 — damage application
│   │   ├── statusQueue.system.ts   # §1.10.10 — queue new effects
│   │   ├── pickup.system.ts        # §1.10.11 — pickup decay; §1.10.13 — collect with Ping Towers
│   │   ├── resource.system.ts      # §1.10.14 — regeneration & auto-repair
│   │   ├── event.system.ts         # §1.10.1 — scheduled event processing
│   │   └── cleanup.system.ts       # §1.10.12 — remove dead entities, drop pickups
│   ├── pathfinding/
│   │   ├── flowfield.ts        # BFS flood-fill + direction cache
│   │   └── grid.ts             # Grid state, blocked tiles, placement validation
│   ├── simulation.ts           # Fixed-timestep game loop driver
│   ├── wave.ts                 # Wave definitions, scaling, scheduling (§8)
│   └── constants.ts            # All rulebook numbers as named constants
├── renderer/
│   ├── pixiApp.ts              # PixiJS Application setup
│   ├── layers/
│   │   ├── grid.layer.ts       # Grid lines, Blackwall boundary visuals
│   │   ├── tower.layer.ts      # Tower sprites and animations
│   │   ├── enemy.layer.ts      # Enemy sprites, health bars
│   │   ├── fx.layer.ts         # Particle effects, ability VFX
│   │   └── pickup.layer.ts     # Resource pickup visuals
│   ├── camera.ts               # Pan, zoom, viewport management
│   └── spritePool.ts           # Object pooling for sprites
├── ui/
│   ├── App.vue                 # Root Vue component (overlays PixiJS canvas)
│   ├── components/
│   │   ├── HUD.vue             # Resource display, wave counter, Core HP
│   │   ├── TowerPanel.vue      # Tower selection, placement, upgrades
│   │   ├── AbilityBar.vue      # Ability activation buttons + cooldowns
│   │   ├── WaveTimer.vue       # Break countdown, skip button
│   │   └── GameOver.vue        # Win/lose screen
│   └── stores/
│       ├── game.store.ts       # Bridge store — synced from sim each frame
│       └── ui.store.ts         # Pure UI state (selected tower, panel open)
├── audio/                      # Sound effects and music (TBD)
└── assets/                     # Sprites, fonts, shaders
```

---

## 3. Game Loop & Tick System

### 3.1. Decoupled Architecture

The simulation and renderer run on **independent cadences**:

```
┌─────────────────────────────────────────────────┐
│                requestAnimationFrame             │
│                                                  │
│   accumulator += deltaTime                       │
│   while (accumulator >= TICK_DURATION) {         │
│       simulation.tick()      // fixed 1/60s      │
│       accumulator -= TICK_DURATION               │
│   }                                              │
│   alpha = accumulator / TICK_DURATION            │
│   renderer.draw(alpha)       // interpolated     │
│                                                  │
└─────────────────────────────────────────────────┘
```

| Constant              | Value                 |
| --------------------- | --------------------- |
| `TICK_RATE`           | 60                    |
| `TICK_DURATION`       | 1000 / 60 ≈ 16.667 ms |
| `MAX_TICKS_PER_FRAME` | 4 (catch-up cap)      |

3.1.1. The simulation runs at a **fixed 60 ticks/second** regardless of frame rate (Rulebook §1.8).  
3.1.2. The renderer uses `alpha` (fractional tick progress) to **interpolate** entity positions for smooth visuals between ticks.  
3.1.3. A `MAX_TICKS_PER_FRAME` cap of **4** prevents spiral-of-death when the tab is backgrounded or the machine lags. If the tab is backgrounded and returns after a long delay, the simulation effectively **pauses** — at most 4 catch-up ticks (~66ms of game time) are processed per frame until the accumulator drains. This is intentional: the game does not fast-forward.  
3.1.4. All game state mutations happen **exclusively inside `simulation.tick()`** — the renderer is read-only.

### 3.2. Tick Processing Order

Each `simulation.tick()` executes systems in the exact order specified in Rulebook §1.10:

```typescript
const TICK_PIPELINE: System[] = [
  commandSystem, // Process player commands from UI (before §1.10.1)
  eventSystem, // §1.10.1
  spawnSystem, // §1.10.2
  statusApplySystem, // §1.10.3
  statusExpireSystem, // §1.10.4
  movementSystem, // §1.10.5
  enemyAuraSystem, // §1.10.6
  targetingSystem, // §1.10.7
  damageSystem, // §1.10.8–9
  statusQueueSystem, // §1.10.10
  pickupDecaySystem, // §1.10.11
  cleanupSystem, // §1.10.12
  pickupCollectSystem, // §1.10.13
  resourceSystem, // §1.10.14
];
```

3.2.1. Systems are pure functions: `(world: World) => void`. Each reads/writes components on the shared World.  
3.2.2. System order is **deterministic and fixed** — changing order changes game behavior.

---

## 4. ECS Architecture

### 4.1. Design Principles

4.1.1. **Custom lightweight ECS** — no external ECS library. Tailored to the rulebook's entity types and systems.  
4.1.2. **Struct-of-Arrays (SoA)** layout for cache-friendly iteration where performance matters.  
4.1.3. Entity IDs are **unsigned 32-bit integers** managed via a free-list pool.  
4.1.4. Components are **plain typed arrays** (Float32Array, Uint8Array, etc.) indexed by entity ID.  
4.1.5. Systems iterate over entities using **bitmask queries** — each component type gets a bit flag; entities store a bitmask of their active components.

### 4.2. Core Component Types

```typescript
// Position on the 51×51 grid (Rulebook §2.1)
Position    { x: Float32, y: Float32 }

// Rendering interpolation (previous tick position)
PrevPosition { x: Float32, y: Float32 }

// Health pool
Health      { current: Float32, max: Float32 }

// Movement
Velocity    { speed: Float32, direction: Uint8 }  // direction from flowfield

// Tower-specific
Tower       { type: Uint8, level: Uint8, facing: Uint8 }
Targeting   { mode: Uint8, cooldownRemaining: Float32 }
Rotation    { angle: Float32, rotSpeed: Float32 }

// Enemy-specific
Enemy       { type: Uint8, tier: Uint8, damage: Float32 }
Immunity    { flags: Uint8 }  // bitmask: STUN, SLOW, ICE_DOT, FIREWALL_DMG, etc.

// Status effects (one of each may be active simultaneously — see §7.0.12–7.0.16)
Slow        { magnitude: Float32, remainingTicks: Uint32 }   // 0 = no active slow
Stun        { remainingTicks: Uint32 }                       // 0 = no active stun

// Economy
Pickup      { eddies: Float32, components: Float32, decayPerTick: Float32 }
Harvester   { eddiesPerTick: Float32, componentsPerTick: Float32 }
PingRange   { range: Float32 }  // Chebyshev pickup collection radius

// Abilities (unlocked at tower level 5 — Rulebook §6.0.1)
Ability     { type: Uint8, level: Uint8, cooldownRemaining: Float32 }

// Firewall pairing
FirewallLink { partnerEid: Uint32, gapX: Uint8, gapY: Uint8 }  // links two Firewall tower entities

// Blackwall
Gateway     { hp: Float32, maxHp: Float32, isClosing: Bool }
BlackwallTower { assignedGateway: Uint32, damagePerTick: Float32 }
```

### 4.3. Entity Archetypes

| Archetype       | Components                                                             |
| --------------- | ---------------------------------------------------------------------- |
| Enemy           | Position, PrevPosition, Health, Velocity, Enemy, Immunity, Slow, Stun  |
| Tower (combat)  | Position, Health, Tower, Targeting, Rotation                           |
| Tower (support) | Position, Health, Tower, Harvester or PingRange                        |
| Firewall Tower  | Position, Health, Tower, Targeting, FirewallLink (2 entities per pair) |
| Blackwall Tower | Position, Health, Tower, BlackwallTower                                |
| Pickup          | Position, Pickup                                                       |
| Gateway         | Position, Gateway                                                      |
| Core            | Position, Health                                                       |

### 4.4. Guidelines

4.4.1. **No heap allocations in the tick loop.** Pre-allocate all arrays at world creation. Reuse temp buffers.  
4.4.2. **No classes for components.** Components are data-only records backed by typed arrays.  
4.4.3. Systems must **never call other systems directly.** Communication happens through component mutations or a lightweight event queue.  
4.4.4. **Entity destruction is deferred** — systems mark entities for removal, but actual deletion happens in the cleanup system (§1.10.12) to avoid iterator invalidation. **Entity creation is immediate** within the system that creates it (e.g. `spawnSystem` creates enemy entities at §1.10.2, `cleanupSystem` creates pickup entities at §1.10.12).

---

## 5. Pathfinding

### 5.1. Algorithm: BFS Flood-Fill with Direction Cache

5.1.1. A **BFS flood-fill** from the Core tile (25, 25 in 0-indexed) computes the shortest orthogonal path from every reachable tile.  
5.1.2. Two fields are produced:

- **Cost field** — `Uint16Array[51×51]`: distance in tiles from each cell to Core. Unreachable = `0xFFFF`.
- **Direction field** — `Uint8Array[51×51]`: which of 4 orthogonal directions (N/S/E/W) to move toward Core. `0xFF` = no direction (unreachable or Core itself).

  5.1.3. **Enemy movement** reads one value from the direction field per tick — **O(1) per enemy**.  
  5.1.4. The fields are **recomputed only when the grid topology changes**:

- Tower placed or destroyed
- Gateway opened or closed

  5.1.5. Recompute cost: ~2,601 tiles × 4 neighbors = **~10K operations, < 0.1ms**.

### 5.2. Dual Flowfields

| Field    | Obstacles                                                | Used By                                                      |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Standard | All tower tiles blocked                                  | All enemies except Glitch                                    |
| Glitch   | All tower tiles blocked **except** ICE Wall and Firewall | Glitch enemies (§7.4 — phase through ICE Wall/Firewall only) |

5.2.1. Both fields share the same BFS implementation — only the blocked-tile set differs.  
5.2.2. Both are invalidated and recomputed together on any grid change.  
5.2.3. **Important:** Glitches only phase through **ICE Wall** and **Firewall** towers (Rulebook §7.4.1). They are still blocked by Data Spike, Daemon Turret, ICE Sniper, Blackwall Tower, Ping Tower, and Harvester tiles.

### 5.3. Placement Validation (Rulebook §2.6.4)

5.3.1. Before placing a tower, **temporarily add the tile to the blocked set** and run BFS from Core.  
5.3.2. Verify that **all active Gateway tiles** have `cost < 0xFFFF` (reachable).  
5.3.3. If any Gateway becomes unreachable, **reject the placement**.  
5.3.4. This validation must complete **synchronously** before the tower entity is created.

### 5.4. Data Layout

```typescript
const GRID_SIZE = 51;
const costField = new Uint16Array(GRID_SIZE * GRID_SIZE);
const dirField = new Uint8Array(GRID_SIZE * GRID_SIZE);
const glitchCost = new Uint16Array(GRID_SIZE * GRID_SIZE);
const glitchDir = new Uint8Array(GRID_SIZE * GRID_SIZE);

// Index helper: (x, y) → x + y * GRID_SIZE
function idx(x: number, y: number): number {
  return x + y * GRID_SIZE;
}

// Direction enum
const enum Dir {
  NONE = 0xff,
  N = 0,
  S = 1,
  E = 2,
  W = 3,
}
```

---

## 6. Rendering (PixiJS)

### 6.1. Setup

6.1.1. Create a single `PixiJS Application` mounted to a full-viewport `<canvas>`.  
6.1.2. Vue mounts its DOM **on top of** the canvas via `pointer-events: none` overlays.  
6.1.3. PixiJS handles all in-game visuals; Vue handles all HUD / UI chrome.

### 6.2. Render Layers (z-order, bottom to top)

| Order | Layer   | Contents                                        |
| ----- | ------- | ----------------------------------------------- |
| 0     | Grid    | Tile lines, Blackwall boundary, Gateway markers |
| 1     | Towers  | Tower sprites, range indicators                 |
| 2     | Enemies | Enemy sprites, health bars                      |
| 3     | Pickups | Resource drop sprites, decay indicators         |
| 4     | FX      | Particle effects, ability VFX, damage numbers   |

### 6.3. Interpolation

6.3.1. Each frame, the renderer interpolates between `PrevPosition` and `Position` using the `alpha` value from the game loop:

```typescript
renderX = prevX + (currX - prevX) * alpha;
renderY = prevY + (currY - prevY) * alpha;
```

6.3.2. This produces smooth 60fps+ visuals even though the simulation ticks at exactly 60Hz.

### 6.4. Object Pooling

6.4.1. Maintain **sprite pools** for enemies, pickups, damage numbers, and particles.  
6.4.2. On entity creation, **acquire** a sprite from the pool. On entity removal, **release** back.  
6.4.3. Pool size auto-grows (doubles) if exhausted. Never shrinks during gameplay.  
6.4.4. **Goal: zero `new Sprite()` calls during active gameplay** — all allocations happen during pool warm-up.

### 6.5. Camera

6.5.1. Support **pan** (drag / WASD / arrow keys) and **zoom** (scroll wheel / pinch).  
6.5.2. Clamp viewport to the 51×51 grid bounds.  
6.5.3. Implement as a `Container` transform on the root PixiJS stage.

---

## 7. UI Layer (Vue + Pinia)

### 7.1. Architecture

7.1.1. Vue renders **HTML/CSS overlay elements** positioned absolutely over the PixiJS canvas.  
7.1.2. Vue components are **purely presentational + interactive** — they dispatch actions to stores, never mutate game state directly.  
7.1.3. All game-state reads go through Pinia stores that are synced from the simulation.

### 7.2. Store Design

| Store        | Responsibility                                            | Reactive? |
| ------------ | --------------------------------------------------------- | --------- |
| `game.store` | Mirrored sim state: resources, wave, Core HP, tower list  | Yes       |
| `ui.store`   | UI-only state: selected tower, panel visibility, settings | Yes       |

7.2.1. `game.store` is updated **once per render frame** (not per tick) to avoid excessive reactivity overhead.  
7.2.2. `ui.store` is updated immediately on user interaction.

### 7.3. Input Handling

7.3.1. **Grid clicks** (tower placement, selection) → handled by PixiJS interaction events → dispatched to simulation command queue.  
7.3.2. **UI button clicks** (abilities, upgrades, wave skip) → handled by Vue event handlers → dispatched to simulation command queue.  
7.3.3. All player actions are enqueued as **commands** processed at the start of the next tick (before §1.10.1).

---

## 8. State Bridge: Sim ↔ UI

### 8.1. Sim → UI (Read Path)

```
simulation.tick()
    ↓ (every render frame, not every tick)
syncGameStore(world, gameStore)
    ↓
Vue reactivity triggers component re-renders
```

8.1.1. A `syncGameStore()` function extracts relevant data from the ECS world into plain JS objects for Pinia.  
8.1.2. Runs **once per animation frame**, after all ticks for that frame have completed.  
8.1.3. Only syncs **changed data** — use dirty flags or generation counters to skip unchanged fields.

### 8.2. UI → Sim (Write Path)

```
User clicks "Place Tower"
    ↓
Vue handler pushes { type: 'PLACE_TOWER', x, y, towerType } to commandQueue
    ↓
simulation.tick() → eventSystem processes commandQueue first
    ↓
Tower entity created (after validation)
```

8.2.1. The command queue is a **plain array** flushed at the start of each tick by `commandSystem`.  
8.2.2. Commands are **validated in the simulation** — the UI shows a **ghost preview** of the tower during placement, but does not commit it to the world. The preview is confirmed or rejected after `commandSystem` runs validation (e.g. pathfinding check). No rollback needed — only the preview is shown until confirmation.

---

## 9. Code Style & Conventions

### 9.1. TypeScript

9.1.1. **Strict mode** enabled (`strict: true` in tsconfig).  
9.1.2. **No `any`** — use `unknown` + type guards where types are uncertain.  
9.1.3. **Explicit return types** on all exported functions and system entry points.  
9.1.4. **`const enum`** for fixed sets (directions, enemy types, tower types, status effects).  
9.1.5. **`readonly`** on all component array references — mutations happen through indexed writes, not reassignment.

### 9.2. Naming Conventions

| Element            | Convention              | Example                      |
| ------------------ | ----------------------- | ---------------------------- |
| Files (systems)    | `camelCase.system.ts`   | `movement.system.ts`         |
| Files (components) | `camelCase.ts`          | `position.ts`                |
| Files (Vue)        | `PascalCase.vue`        | `TowerPanel.vue`             |
| Types / Interfaces | `PascalCase`            | `TowerComponent`             |
| Enums              | `PascalCase` + `UPPER`  | `EnemyType.DATA_LEECH`       |
| Functions          | `camelCase`             | `computeFlowfield()`         |
| Constants          | `UPPER_SNAKE_CASE`      | `TICK_RATE`, `GRID_SIZE`     |
| Entity IDs         | `eid` prefix in context | `const eid = world.create()` |

### 9.3. Rulebook Cross-References

9.3.1. Every constant derived from the rulebook must include a **doc comment** referencing the rulebook section:

```typescript
/** Rulebook §1.8 — Simulation runs at 60 ticks per second. */
export const TICK_RATE = 60;

/** Rulebook §2.1 — Map is a 51×51 tile grid. */
export const GRID_SIZE = 51;
```

9.3.2. System files should reference their corresponding §1.10.x step in the file header.

### 9.4. General Patterns

9.4.1. **No classes in the simulation layer.** Systems are functions. Components are data.  
9.4.2. **Composition over inheritance** everywhere.  
9.4.3. **Immutable public API, mutable internals** — expose `readonly` views of arrays to the renderer and UI.  
9.4.4. **All floating-point math** — the rulebook uses floats (§1.9). Do not truncate to integers mid-simulation. Floor/round only at display time.  
9.4.5. **Deterministic RNG** — use a seeded PRNG (e.g. xorshift128) for all random decisions (Gateway placement, etc.). Never use `Math.random()` in the simulation.  
9.4.6. **No string keys in hot paths.** Use numeric IDs and typed array lookups.

---

## 10. Testing Strategy

### 10.1. Unit Tests (Vitest)

10.1.1. **Simulation systems** — each system gets a test file asserting correct state transitions for known inputs.  
10.1.2. **Pathfinding** — test BFS output for hand-crafted grids, including blocked paths, Glitch field, and placement validation rejection.  
10.1.3. **Status effects** — test all interaction rules from §7.0.10–7.0.16 (stun > slow priority, replacement rules, immunity).  
10.1.4. **Wave scaling** — verify `stat × (1 + 0.1 × wave)` produces correct values from §8.4.  
10.1.5. **Resource calculations** — verify Eddie generation, Component drop values, decay rates.

### 10.2. Deterministic Replay Tests

10.2.1. Record a sequence of `{ tick, command }` pairs (player inputs + RNG seed).  
10.2.2. Replay the sequence and assert that the **final world state hash matches** a known-good snapshot.  
10.2.3. Use this to catch **simulation regressions** — any code change that alters tick behavior will change the hash.  
10.2.4. Maintain a library of replay fixtures:

- `smoke.replay` — basic 5-wave playthrough
- `boss.replay` — wave 50 AI Overlord fight
- `glitch-path.replay` — Glitch enemies phasing through towers
- `gateway-close.replay` — full Gateway closure sequence

### 10.3. E2E Tests (Playwright)

10.3.1. Verify **UI integration** — tower placement via click, ability activation, wave skip button.  
10.3.2. Verify **win/lose screens** trigger correctly.  
10.3.3. Verify **resource display** updates match simulation state.  
10.3.4. Run against a **headless Chromium** build in CI.

### 10.4. Test Commands

```bash
pnpm test           # Vitest — unit + replay tests
pnpm test:e2e       # Playwright — browser E2E
pnpm test:coverage  # Vitest with coverage report
```

---

## 11. Build & Deployment

### 11.1. Development

```bash
pnpm dev            # Vite dev server with HMR
```

11.1.1. Hot Module Replacement for Vue components and UI code.  
11.1.2. Simulation code changes require a **page refresh** (no HMR for typed array state).

### 11.2. Production Build

```bash
pnpm build          # Vite production build → dist/
```

11.2.1. Output is a **static SPA** — single `index.html` + hashed JS/CSS bundles.  
11.2.2. Enable **code splitting** — separate chunks for simulation, renderer, and UI.  
11.2.3. Target: **ES2022** (modern browsers only — no IE11).

### 11.3. Deployment

11.3.1. Deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).  
11.3.2. No server-side logic required.  
11.3.3. Configure SPA fallback (`/* → index.html`) for client-side routing if needed.

---

## 12. Performance Budget

### 12.1. Targets

| Metric                 | Target                 |
| ---------------------- | ---------------------- |
| Tick processing time   | < 2ms (at 60Hz)        |
| Frame render time      | < 8ms (120fps capable) |
| Total frame budget     | < 16ms (60fps minimum) |
| Memory (heap)          | < 128MB                |
| Initial load (gzipped) | < 1MB                  |
| Time to interactive    | < 3s                   |

### 12.2. Profiling Guidelines

12.2.1. Use `performance.now()` bracketing around `simulation.tick()` in dev mode.  
12.2.2. Log a warning if any single tick exceeds **4ms**.  
12.2.3. Use Chrome DevTools Performance tab for render profiling.  
12.2.4. Monitor GC pauses — the tick loop should produce **zero garbage** during normal play.

---

_End of technical specification. All section numbers (§) referencing game rules point to [rulebook.md](rulebook.md)._
