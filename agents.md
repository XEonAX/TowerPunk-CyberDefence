# TowerPunk: Cyber Defence — Agentic Development Guide

> Best practices, rules, and context for AI coding agents working on this project.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Documents](#2-key-documents)
3. [Architecture & Tech Stack](#3-architecture--tech-stack)
4. [Development Principles](#4-development-principles)
5. [Code Conventions](#5-code-conventions)
6. [The Rulebook Is Law](#6-the-rulebook-is-law)
7. [ECS Patterns](#7-ecs-patterns)
8. [Simulation Rules](#8-simulation-rules)
9. [Rendering Rules](#9-rendering-rules)
10. [Testing Requirements](#10-testing-requirements)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Task Planning & Workflow](#12-task-planning--workflow)
13. [File & Folder Conventions](#13-file--folder-conventions)
14. [Performance Constraints](#14-performance-constraints)
15. [Dependency Policy](#15-dependency-policy)

---

## 1. Project Overview

TowerPunk: Cyber Defence is a **browser-based tower defence game** with a Cyberpunk 2077-inspired aesthetic. The player defends a NetWatch-owned Core on a 51×51 grid from waves of Rogue AIs breaching the Blackwall.

- **Genre:** Real-time tower defence
- **Platform:** Web (static SPA, no backend)
- **Engine:** Custom — PixiJS 8 for rendering, Vue 3 for UI, custom ECS for simulation
- **Language:** TypeScript (strict mode)

---

## 2. Key Documents

Before writing any code, **read and understand** these documents in order:

| Document                   | Purpose                                                              | Authority Level |
| -------------------------- | -------------------------------------------------------------------- | --------------- |
| [rulebook.md](docs/rulebook.md) | Complete game rules, stats, mechanics — the single source of truth   | **Canonical**   |
| [tech.md](docs/tech.md)         | Tech stack, architecture, algorithms, code patterns                  | **Canonical**   |
| [idea.md](docs/idea.md)         | Original design brainstorm — **outdated**, do NOT use as a reference | **Deprecated**  |

**Rule:** If `rulebook.md` and `tech.md` conflict, `rulebook.md` wins — it defines what the game _does_, `tech.md` defines how it's _built_.

**Rule:** `idea.md` is explicitly marked as outdated. Never reference it for game logic, stats, or mechanics. All authoritative information has been extracted into the rulebook and tech spec.

---

## 3. Architecture & Tech Stack

| Layer           | Technology           | Notes                                     |
| --------------- | -------------------- | ----------------------------------------- |
| Language        | TypeScript (strict)  | No `any`, explicit return types           |
| Simulation      | Custom ECS (SoA)     | No external ECS library                   |
| Rendering       | PixiJS 8             | 2D canvas, object pooling, layer system   |
| UI              | Vue 3 + Pinia        | HTML/CSS overlays on top of PixiJS canvas |
| Build           | Vite                 | HMR for Vue, full reload for simulation   |
| Testing         | Vitest + Playwright  | Unit + deterministic replay + E2E         |
| Package Manager | pnpm                 | Use `pnpm` for all package operations     |
| Linting         | ESLint (flat config) | Run before committing                     |
| Formatting      | Prettier             | Consistent style, auto-format on save     |

### Three-Layer Separation

The codebase has **strict boundaries** between three layers:

```
┌──────────────────────────────────────────────┐
│  UI Layer (Vue + Pinia)                      │
│  - HTML/CSS overlays, HUD, menus             │
│  - Reads from game.store (synced per frame)  │
│  - Writes to commandQueue only               │
├──────────────────────────────────────────────┤
│  Renderer (PixiJS)                           │
│  - Read-only access to ECS world             │
│  - Interpolates between ticks for visuals    │
│  - Never mutates game state                  │
├──────────────────────────────────────────────┤
│  Simulation (ECS)                            │
│  - Fixed 60 ticks/second                     │
│  - All state mutations happen here           │
│  - Deterministic — seeded RNG only           │
└──────────────────────────────────────────────┘
```

**Never cross these boundaries:** The renderer must never mutate ECS state. Vue must never read ECS directly — it reads from Pinia stores synced once per render frame. Player actions go through a command queue processed at tick start.

---

## 4. Development Principles

### 4.1. Read Before You Write

- Before implementing a feature, identify the relevant rulebook section(s) (e.g. §5.3 for Data Spike, §7.4 for Glitch).
- Read the corresponding tech.md section for implementation guidance.
- Check existing systems and components for patterns to follow.

### 4.2. Small, Focused Changes

- Implement one system, one component type, or one feature at a time.
- Each change should be testable independently.
- Avoid large refactors that touch many systems at once — prefer incremental changes.

### 4.3. Test-Driven When Possible

- Write or update tests alongside implementation.
- Simulation systems are pure functions — they are easy to unit test.
- Every rulebook stat should have a corresponding test asserting the value.

### 4.4. Determinism Is Non-Negotiable

- The simulation must produce **identical results** given the same inputs and RNG seed.
- Never use `Math.random()` in simulation code — use the seeded PRNG (xorshift128).
- Never use `Date.now()`, `performance.now()`, or any non-deterministic source in tick logic.
- Floating-point math only — do not truncate to integers mid-simulation (Rulebook §1.9).

### 4.5. Zero Allocation in Hot Paths

- The tick loop must produce **zero garbage**.
- Pre-allocate all typed arrays at world creation.
- Reuse scratch buffers for temporary calculations (e.g. BFS pathfinding).
- No `new` keyword, no array spread, no object literals in system functions.

### 4.6. Cross-Reference Everything

- Every constant from the rulebook must have a doc comment citing its section:
  ```typescript
  /** Rulebook §2.1 — Map is a 51×51 tile grid. */
  export const GRID_SIZE = 51;
  ```
- System files must reference their §1.10.x tick pipeline step in the header.
- Component definitions must reference the rulebook section they implement.

---

## 5. Code Conventions

### 5.1. Naming

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

### 5.2. TypeScript Rules

- **Strict mode** (`strict: true`) — no exceptions.
- **No `any`** — use `unknown` + type guards when types are uncertain.
- **Explicit return types** on all exported functions and system entry points.
- **`const enum`** for fixed sets: directions, enemy types, tower types, status effects.
- **`readonly`** on all component array references exposed to renderer/UI.

### 5.3. Code Style

- No classes in the simulation layer — systems are functions, components are data.
- Composition over inheritance everywhere.
- Immutable public API, mutable internals — expose `readonly` views to renderer and UI.
- No string keys in hot paths — use numeric IDs and typed array lookups.

---

## 6. The Rulebook Is Law

The [rulebook.md](rulebook.md) is the **single source of truth** for all game mechanics. When implementing any feature:

1. **Find the section** — Every mechanic has a numbered section (e.g. §5.1 for ICE Wall, §7.0.12 for status effect interactions).
2. **Quote the rule** — In code comments, cite the exact section number.
3. **Match the numbers** — All stats, costs, durations, percentages, and ranges must match the rulebook exactly.
4. **Respect interactions** — Status effects, immunities, and tower-enemy interactions are precisely defined. Do not approximate.

### Key Rulebook Sections to Know

| Topic                    | Section        | Notes                                           |
| ------------------------ | -------------- | ----------------------------------------------- |
| Tick processing order    | §1.10          | Systems must execute in this exact order        |
| Grid & placement rules   | §2.6           | Path validation, edge tile restrictions         |
| Spawning & movement      | §2.10          | 30-tick immunity, per-tile progress, rendering  |
| Core mechanics           | §3             | Health, damage on entry                         |
| Resources                | §4             | Eddies, Components, decay, conversion           |
| Tower stats & upgrades   | §5.1–5.8       | Every tower has exact stat tables               |
| Abilities                | §6.1–6.5       | Cooldowns, durations, upgrade paths             |
| Enemy stats & immunities | §7.0–7.8       | Tier multipliers, immunities, special behaviors |
| Status effect rules      | §7.0.10–7.0.16 | Slow/stun priority, replacement, immunity       |
| Wave composition         | §8             | Scaling formula, timing, skip bonus             |
| Blackwall & Gateways     | §9             | Gateway HP, closing mechanics, spawn rules      |
| Win/lose conditions      | §10            | Restoration requirements, Core HP = 0           |

---

## 7. ECS Patterns

### 7.1. Component Design

- Components are **data-only** — no methods, no behavior.
- Use **Struct-of-Arrays (SoA)** layout with typed arrays (`Float32Array`, `Uint8Array`, etc.) for cache-friendly iteration.
- Entity IDs are **unsigned 32-bit integers** from a free-list pool.
- Components are indexed by entity ID.
- Entities have a **bitmask** of active components for fast querying.

### 7.2. System Design

- Systems are **pure functions**: `(world: World) => void`.
- Systems read and write components on the shared World.
- Systems must **never call other systems directly** — communicate through components or event queues.
- System order is **fixed and deterministic** (see §1.10 tick pipeline).

### 7.3. Entity Lifecycle

- **Creation is immediate** within the system that creates (e.g. `spawnSystem` creates enemies, `cleanupSystem` creates pickups).
- **Destruction is deferred** — systems mark entities for removal, actual deletion happens in `cleanupSystem` (§1.10.12) to avoid iterator invalidation.

### 7.4. Adding a New Component Type

1. Define the component's data layout in `src/game/ecs/component.ts`.
2. Allocate its typed array(s) in `world.ts`.
3. Assign a bit flag for the component.
4. Add to the relevant entity archetype(s) in entity creation functions.
5. Reference the rulebook section in a doc comment.

### 7.5. Adding a New System

1. Create `src/game/systems/<name>.system.ts`.
2. Add a header comment referencing the §1.10.x step it implements.
3. Implement as a pure function: `(world: World) => void`.
4. Insert it at the correct position in the `TICK_PIPELINE` array in `simulation.ts`.
5. Write unit tests in `src/game/systems/__tests__/<name>.system.test.ts`.

---

## 8. Simulation Rules

### 8.1. Tick Pipeline

Every `simulation.tick()` executes systems in this **exact order** (Rulebook §1.10):

| Step | System                | Rulebook  | Purpose                                  |
| ---- | --------------------- | --------- | ---------------------------------------- |
| 0    | `commandSystem`       | Pre-§1.10 | Process player commands from UI          |
| 1    | `eventSystem`         | §1.10.1   | Scheduled events (phases, wave triggers) |
| 2    | `spawnSystem`         | §1.10.2   | Enemy spawning + 30-tick immunity        |
| 3    | `statusApplySystem`   | §1.10.3   | Apply status effects from previous tick  |
| 4    | `statusExpireSystem`  | §1.10.4   | Expire finished status effects           |
| 5    | `movementSystem`      | §1.10.5   | Per-tile progress movement               |
| 6    | `enemyAuraSystem`     | §1.10.6   | VDB Netrunner tower damage               |
| 7    | `targetingSystem`     | §1.10.7   | Tower target acquisition (skip disabled) |
| 8    | `damageSystem`        | §1.10.8–9 | Damage to enemies and towers             |
| 9    | `statusQueueSystem`   | §1.10.10  | Queue new status effects for next tick   |
| 10   | `pickupDecaySystem`   | §1.10.11  | Pickup decay                             |
| 11   | `cleanupSystem`       | §1.10.12  | Remove dead entities, drop pickups       |
| 12   | `pickupCollectSystem` | §1.10.13  | Collect pickups with Ping Towers         |
| 13   | `resourceSystem`      | §1.10.14  | Regeneration & auto-repair               |

**Never reorder these systems.** Changing order changes game behavior and breaks determinism.

### 8.2. Pathfinding

- **BFS flood-fill** from Core tile — produces cost field and direction field.
- **Two flowfields:** Standard (all towers block) and Glitch (ICE Wall + Firewall passable).
- Recomputed only on grid topology changes (tower placed/destroyed, gateway opened/closed).
- Placement validation uses a **scratch buffer** — zero allocations, ~0.1ms per check.
- `canPlaceTower()` is a **read-only query** safe to call on every tile hover.

### 8.3. Command Queue

Player actions flow through a command queue:

```
User interaction → Push command to queue → commandSystem processes at tick start → Validated in simulation
```

Command types include: `PLACE_TOWER`, `PLACE_FIREWALL`, `UPGRADE_TOWER`, `ACTIVATE_ABILITY`, `DISMANTLE_TOWER`, `SKIP_BREAK`, `START_WAVE`.

---

## 9. Rendering Rules

### 9.1. Renderer Is Read-Only

- The renderer **never mutates** ECS world state.
- It reads `TilePos`, `TileProgress`, `PathState`, and other components to compute visual positions.
- All visual interpolation (edge-to-edge movement, arc curves, alpha smoothing) is render-only.

### 9.2. Visual Movement System (Render-Only)

The complex movement rendering (§2.10.4–2.10.8) is **separate from simulation logic**:

- **Simulation:** Enemies are on a discrete tile. `TileProgress` tracks progress 0→1 within a tile.
- **Renderer:** Computes smooth edge-to-edge positions, quarter-circle arc turns, constant-speed visual movement.
- Implementation lives in `renderer/enemyMotion.ts` — a pure function returning `{ renderX, renderY, angleDeg }`.

### 9.3. Object Pooling

- Sprites are acquired from pools on entity creation, released on removal.
- Pools auto-grow but never shrink during gameplay.
- Goal: **zero `new Sprite()` calls during active gameplay**.

### 9.4. Ghost Preview

Tower placement preview is entirely in the renderer:

- Shows green/red tinted semi-transparent sprite based on `canPlaceTower()` result.
- Validated at most once per tile change, not every frame.
- Special handling for Firewall (3-tile pair), Data Spike (facing arc), Blackwall Tower (adjacent gateway highlight).

---

## 10. Testing Requirements

### 10.1. What Must Be Tested

| Category              | What to Test                                               | Framework  |
| --------------------- | ---------------------------------------------------------- | ---------- |
| Simulation systems    | State transitions for known inputs                         | Vitest     |
| Pathfinding           | BFS output, blocked paths, Glitch field, placement reject  | Vitest     |
| Status effects        | All §7.0.10–7.0.16 interaction rules                       | Vitest     |
| Wave scaling          | `stat × (1 + 0.1 × wave)` formula                          | Vitest     |
| Resource calculations | Eddie generation, Component drops, decay rates             | Vitest     |
| Spawn system          | 30-tick immunity, progress initialization, PathState setup | Vitest     |
| Movement system       | Tile-entered events, direction changes, stun freeze        | Vitest     |
| Enemy motion renderer | Edge positions, arc positions, progress factors            | Vitest     |
| Deterministic replay  | Record/replay command sequences, assert state hash         | Vitest     |
| UI integration        | Tower placement, ability activation, wave skip             | Playwright |
| Win/lose screens      | Trigger conditions                                         | Playwright |

### 10.2. Testing Commands

```bash
pnpm test           # Vitest — unit + replay tests
pnpm test:e2e       # Playwright — browser E2E
pnpm test:coverage  # Vitest with coverage report
```

### 10.3. Test File Location

- Unit tests: `src/game/systems/__tests__/<name>.system.test.ts`
- Pathfinding tests: `src/game/pathfinding/__tests__/`
- Replay fixtures: `tests/replays/`
- E2E tests: `tests/e2e/`

### 10.4. Writing a System Test

```typescript
import { describe, it, expect } from "vitest";
import { createTestWorld } from "../test-helpers";
import { movementSystem } from "../movement.system";

describe("movementSystem", () => {
  it("should advance enemy progress based on speed (§2.10.2)", () => {
    const world = createTestWorld();
    const eid = spawnTestEnemy(world, { speed: 0.5, tileX: 10, tileY: 10 });

    // Run one tick
    movementSystem(world);

    // speed = 0.5 tiles/sec → 0.5/60 tiles/tick
    expect(world.tileProgress[eid]).toBeCloseTo(0.5 / 60, 6);
  });
});
```

---

## 11. Common Pitfalls

### 11.1. Simulation Mistakes

| Pitfall                             | Why It's Wrong                         | Correct Approach                    |
| ----------------------------------- | -------------------------------------- | ----------------------------------- |
| Using `Math.random()` in simulation | Breaks determinism                     | Use seeded PRNG (xorshift128)       |
| Rounding floats mid-simulation      | Violates §1.9 (all numbers are floats) | Round only at display time          |
| Allocating objects in tick loop     | Creates GC pressure                    | Pre-allocate, reuse scratch buffers |
| Mutating state from renderer        | Breaks layer separation                | Renderer is read-only               |
| Processing systems out of order     | Changes game behavior                  | Follow §1.10 pipeline exactly       |
| Forgetting spawn immunity           | Enemies targetable immediately         | 30-tick immunity window (§2.10.1)   |
| Using `setTimeout`/`setInterval`    | Not tied to tick system                | Use tick-based scheduling           |

### 11.2. Pathfinding Mistakes

| Pitfall                              | Why It's Wrong                           | Correct Approach                            |
| ------------------------------------ | ---------------------------------------- | ------------------------------------------- |
| Allowing diagonal enemy movement     | Enemies only move orthogonally (§7.0.2)  | 4-directional BFS only                      |
| Forgetting Glitch flowfield          | Glitches use a separate flowfield (§5.2) | Maintain dual flowfields                    |
| Not validating placement             | Could block all paths to Core            | Always run `canPlaceTower()` before placing |
| Modifying live fields for validation | Corrupts active pathfinding              | Use scratch buffer for validation BFS       |

### 11.3. Status Effect Mistakes

| Pitfall                        | Why It's Wrong                      | Correct Approach                |
| ------------------------------ | ----------------------------------- | ------------------------------- |
| Stacking multiple slows        | Only one slow active (§7.0.15)      | Replace if new slow is stronger |
| Applying slow to stunned enemy | Slow cannot override stun (§7.0.13) | Check stun status first         |
| Forgetting stun clears slow    | Stun replaces slow (§7.0.12)        | Remove slow when stun applied   |
| Ignoring enemy immunities      | Data Leech is stun-immune (§7.1.3)  | Check immunity bitmask          |

### 11.4. Tower Mistakes

| Pitfall                             | Why It's Wrong                       | Correct Approach                      |
| ----------------------------------- | ------------------------------------ | ------------------------------------- |
| Firewall as 1 entity                | It's a paired tower (§5.2.1)         | 2 entities linked via `FirewallLink`  |
| Forgetting Firewall death cascade   | Both towers die together (§5.2.4)    | Destroy partner on either death       |
| Data Spike targeting all directions | Fixed 90° cone only (§5.3.1)         | Direction set at placement, immutable |
| ICE Sniper hitting close enemies    | Minimum range of 3 tiles (§5.5.2)    | Skip targets within min range         |
| Harvester generating without Ping   | Needs Ping Tower connection (§5.7.2) | Check Ping network before generating  |

---

## 12. Task Planning & Workflow

### 12.1. Before Starting a Feature

1. **Identify rulebook sections** — List every § that applies to the feature.
2. **Identify tech.md sections** — Find architecture guidance.
3. **Check dependencies** — Does this require components/systems that don't exist yet?
4. **Plan the work** — Break into: components → systems → tests → renderer → UI.
5. **Estimate scope** — A single system should be implementable in one session.

### 12.2. Implementation Order

When building a new game mechanic, follow this order:

1. **Constants** — Add to `src/game/constants.ts` with rulebook cross-references.
2. **Components** — Define data layout in `src/game/ecs/component.ts`.
3. **System** — Implement game logic in `src/game/systems/`.
4. **Tests** — Write unit tests asserting rulebook-specified behavior.
5. **Renderer** — Add visual representation in `src/renderer/layers/`.
6. **UI** — Wire up Vue components and Pinia store updates.
7. **Integration test** — Verify end-to-end flow.

### 12.3. Modifying Existing Systems

1. **Read the existing system code** fully before modifying.
2. **Check all tests** that cover the system.
3. **Make the change** — keep it minimal and focused.
4. **Run tests** — ensure all existing tests still pass.
5. **Add new tests** for the changed behavior.

### 12.4. Debugging Simulation Issues

1. Use deterministic replay — record the command sequence and replay it.
2. Add tick logging (dev-mode only) to trace state changes.
3. Check system execution order — is the system running at the right pipeline step?
4. Check component bitmasks — is the entity being picked up by the system's query?
5. Check spawn immunity — is the entity still in its 30-tick immunity window?

---

## 13. File & Folder Conventions

### 13.1. Project Structure Reference

```
src/
├── main.ts                         # Entry point
├── game/
│   ├── ecs/                        # ECS core: world, entity, component, system
│   ├── systems/                    # One file per tick pipeline system
│   │   └── __tests__/              # System unit tests
│   ├── pathfinding/                # BFS, flowfield, grid, placement validation
│   │   └── __tests__/              # Pathfinding tests
│   ├── simulation.ts               # Game loop driver
│   ├── wave.ts                     # Wave definitions and scheduling
│   └── constants.ts                # All rulebook numbers as named constants
├── renderer/
│   ├── pixiApp.ts                  # PixiJS setup
│   ├── layers/                     # One layer per render z-order
│   ├── enemyMotion.ts              # Render-only movement interpolation
│   ├── camera.ts                   # Pan, zoom
│   └── spritePool.ts               # Object pooling
├── ui/
│   ├── App.vue                     # Root Vue component
│   ├── components/                 # Vue UI components
│   └── stores/                     # Pinia stores
├── audio/                          # Sound (TBD)
└── assets/                         # Sprites, fonts, shaders
```

### 13.2. Where to Put Things

| Thing you're adding        | Where it goes                               |
| -------------------------- | ------------------------------------------- |
| New game constant          | `src/game/constants.ts`                     |
| New component type         | `src/game/ecs/component.ts`                 |
| New simulation system      | `src/game/systems/<name>.system.ts`         |
| System test                | `src/game/systems/__tests__/<name>.test.ts` |
| Pathfinding logic          | `src/game/pathfinding/`                     |
| Enemy visual interpolation | `src/renderer/enemyMotion.ts`               |
| New render layer           | `src/renderer/layers/<name>.layer.ts`       |
| New Vue component          | `src/ui/components/<Name>.vue`              |
| New Pinia store            | `src/ui/stores/<name>.store.ts`             |
| Replay test fixture        | `tests/replays/<name>.replay`               |
| E2E test                   | `tests/e2e/<name>.spec.ts`                  |

---

## 14. Performance Constraints

These budgets are **hard limits** — do not exceed them:

| Metric                 | Budget                 |
| ---------------------- | ---------------------- |
| Tick processing time   | < 2ms (at 60Hz)        |
| Frame render time      | < 8ms (120fps capable) |
| Total frame budget     | < 16ms (60fps minimum) |
| Memory (heap)          | < 128MB                |
| Initial load (gzipped) | < 1MB                  |
| Time to interactive    | < 3s                   |

### Performance Rules

- **Zero heap allocations** in the tick loop. Pre-allocate everything.
- **No string keys** in hot paths. Use numeric IDs and typed array lookups.
- **Typed arrays** (Float32Array, Uint8Array, etc.) for all component data.
- **Object pooling** for all sprites — no `new Sprite()` during gameplay.
- **Dirty flags** on state bridge sync — only copy changed data to Pinia stores.
- **Cache BFS results** — recompute only on grid topology changes.
- If a tick exceeds **4ms**, log a warning in dev mode.

---

## 15. Dependency Policy

### 15.1. Approved Dependencies

The following are the project's core dependencies. Do not replace them:

- **TypeScript** — all code
- **Vue 3** (Composition API) — UI layer
- **Pinia** — UI state management
- **PixiJS 8** — 2D rendering
- **Vite** — build tool
- **Vitest** — unit testing
- **Playwright** — E2E testing
- **ESLint** — linting
- **Prettier** — formatting
- **pnpm** — package management

### 15.2. Adding New Dependencies

Before adding any new dependency:

1. **Check if it can be done without a library.** The simulation layer especially should have zero external dependencies.
2. **Justify the addition** — it must solve a problem that would take significant effort to implement correctly.
3. **Check bundle size** — must not push initial load above the 1MB gzipped budget.
4. **No ECS libraries** — the custom ECS is intentional and tailored to the rulebook.
5. **No physics engines** — movement is tile-based, not physics-based.

---

_This document should be updated as the project evolves. All agents working on this codebase must follow these guidelines._
