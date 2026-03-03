# TowerPunk: Cyber Defence — Rulebook

> A structured reference document derived from the game design idea. All rules, stats, and mechanics are numbered for easy cross-referencing.

---

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [Map & Grid](#2-map--grid)
3. [Core](#3-core)
4. [Resources](#4-resources)
5. [Towers](#5-towers)
6. [Abilities](#6-abilities)
7. [Enemies](#7-enemies)
8. [Waves](#8-waves)
9. [The Blackwall & Gateways](#9-the-blackwall--gateways)
10. [Win & Lose Conditions](#10-win--lose-conditions)

---

## 1. Game Overview

1.1. The player controls a **NetWatch-owned Core** situated in the **Net** — a virtual world connected to the real world.  
1.2. The player must defend the Core against waves of **Rogue AIs** coming through the **Blackwall** from beyond.  
1.3. The game is set in a **Cyberpunk 2077-inspired** aesthetic: neon lights, dark atmosphere, digital grid visuals.  
1.4. The player defends by placing **Towers** on a grid, using **Abilities**, and managing two resources: **Eddies** and **Components**.  
1.5. The **Blackwall** weakens over time due to **VDBs** and **Corporations** interfering with it, allowing progressively stronger **Rogue AIs** through.  
1.6. The player must restore the Blackwall by building **Blackwall Towers** and permanently closing all **Blackwall Gateways**.  
1.7. Gameplay is **real-time** and **strategic** — players must manage resources, tower placement, and ability timing simultaneously.  
1.8. The simulation runs at 60 ticks per second.  
1.9. All time-based mechanics (e.g. cooldowns, durations, damage over time) are applied based on the 60 ticks per second simulation. All numbers are floats. For reference: 1 second = 60 ticks.  
1.10. Systems process ticks as shown below:

- 1.10.1 Process scheduled events (phase transitions, wave triggers, Gateway HP reduction)
- 1.10.2 Spawn enemies
- 1.10.3 Apply status effects from previous tick (slow, stun, Saboteur tower disable)
- 1.10.4 Expire finished status effects (slow, stun, Saboteur tower disable)
- 1.10.5 Move enemies (respecting current status effects)
- 1.10.6 Apply enemy aura effects (VDB Netrunner tower damage)
- 1.10.7 Apply tower targeting (skip disabled towers)
- 1.10.8 Apply damage to enemies
- 1.10.9 Apply damage to towers (from enemies)
- 1.10.10 Queue new status effects for next tick (on-hit slow, stun, Saboteur disable pulse)
- 1.10.11 Apply decay to pickups
- 1.10.12 Remove defeated enemies and destroyed towers, drop pickups
- 1.10.13 Collect pickups with Ping Towers
- 1.10.14 Regenerate resources / auto-repair Blackwall Towers

---

## 2. Map & Grid

2.1. The map is a **51×51 tile grid** representing a sector of the Net.  
2.2. The grid is displayed as **blue dotted lines** on a dark background.  
2.3. The **Core occupies exactly 1 tile** at the center of the map (position 26, 26 on a 1-indexed grid).  
2.4. **Enemies enter the map through Blackwall Gateways** (see §9.2) on the boundary or interior, and pathfind toward the Core.  
2.5. The **Blackwall boundary** is displayed as **red dotted lines** around the outer edge of the map.

- 2.5.1. As the game progresses, the red dotted lines **break and fade**, visually indicating Blackwall degradation. Each break point on the boundary becomes a **Blackwall Gateway** (see §9.2) — all enemy entry into the map occurs through these Gateways.

  2.6. **Tower placement rules:**

- 2.6.1. Towers may only be placed on empty grid tiles.
- 2.6.2. At least **one valid path** from all **Blackwall Gateway** tiles to the Core tile must exist at all times.
- 2.6.3. Edge tiles themselves **cannot be built on**.
- 2.6.4. A placement that would **completely block all paths** to the Core is **illegal** and must be rejected via pre-validation before the tower is placed.

  2.7. **Blackwall Gateways** (see §9) appear as additional enemy spawn points on the map when triggered — either on **boundary tiles** (from Blackwall degradation) or on **interior tiles** (from Orchestrators/AI Overlords).
  2.8 All ranges are measured in **tiles**. Use **Chebyshev Distance** for Ranges.
  2.9 The Core occupies the tile at position (26, 26).

  2.10. **Spawning and movement rules:**

- 2.10.1. Enemies spawn at center of each active **Blackwall Gateway** tile. At the start of their spawn, they are completely immune to everything for 30 ticks (they are only used for rendering/animation). Then we mark their per-tile progress as 0.5. This is when they are considered to have entered the tile. Then they need to make 0.5 tile movement instead of 1 tile movement to reach next tile. This depends on their speed.
- 2.10.2. Per-Tile Progress: Enemies move from tile to tile based on their speed. For example, an enemy with speed 1 tile/60 ticks = 0.0167 tiles/tick, so it moves 0.5 tiles every 30 ticks. When its per-tile progress reaches 1, it moves to the next tile and resets progress to 0. This also corresponds to tile entered event. This allows for smooth movement and accurate timing of when enemies enter new tiles, which is important for tower targeting and damage application. At tile boundaries, the progress is 0, at the center of the tile, the progress is 0.5, and just before leaving the tile, the progress is close to 1.
- 2.10.3. Enemies are animated to move smoothly across tiles based on their speed and per-tile progress, but for all game logic purposes (tower targeting, damage application, status effects), they are considered to be on the tile they last entered until they enter the next tile.
- 2.10.4. **Edge-to-Edge Movement (render only):** For rendering, enemies move between **tile edges** rather than tile centers. The edge point between two adjacent tiles is the midpoint of their shared boundary. The only exception is the destination (Core) tile, where the exit point is the tile center. This means the visual path goes: spawn center → first edge → second edge → … → Core center.

- 2.10.5. **Orientation:** Each tile on the flowfield has a **path direction** (N, S, E, W). Enemies face the direction they are currently travelling. When moving straight (no direction change), the enemy faces the path direction for the entire segment.

- 2.10.6. **Direction Changes:** When an enemy transitions between tiles, the direction change is classified as one of four types:

  | Change         | Condition                             | Angle Delta |
  | -------------- | ------------------------------------- | ----------- |
  | **None**       | Same direction as previous tile       | 0°          |
  | **TurnRight**  | 90° clockwise from previous direction | +90°        |
  | **TurnLeft**   | 90° counter-clockwise from previous   | −90°        |
  | **TurnAround** | 180° reversal (e.g. path changed)     | ±180°       |

- 2.10.7. **Curving Motion at Turns (render only):** When turning right or left, enemies follow a **quarter-circle arc** instead of a straight line. The arc's center is the **corner point** shared by the From-tile, To-tile, and the diagonal tile between them, on the same edge the enemy entered from. The arc radius is **0.5 tiles** (half a tile width). The enemy's position is computed by rotating around this pivot point, and the facing angle is interpolated linearly from the entry angle to the exit angle over the segment's progress. When going straight (None), the enemy interpolates position linearly between edges. When turning around, the enemy pivots in place (no positional interpolation, only rotation).

```
  Example: Path (1,1) → (1,2) → (2,2)  —  going North, then turning East

  Direction change: TurnRight (+90°)
  Arc center: corner between (1,1), (1,2), (2,2) = top-right corner of (1,1)

       (1,3)          (2,3)
    ┌──────────┬──────────┐
    │          │          │
    │          │          │
    │  (1,2)   │  (2,2)   │
    │          │          │
    │     ╭────┤←exit     │   exit edge: midpoint of (1,2)↔(2,2)
    │     │  ◯ │          │   ◯ = arc center (corner point)
    ├─────┤────┼──────────┤
    │     │    │          │
    │     ↑    │          │
    │  (1,1)   │  (2,1)   │   ↑ = entry edge: midpoint of (1,1)↔(1,2)
    │  entry   │          │
    │          │          │
    └──────────┴──────────┘

  The enemy follows the quarter-circle arc (╭) from the entry edge
  to the exit edge, rotating from facing North (↑) to facing East (→).
```

- 2.10.8. **Constant Speed:** The enemy's speed is expressed in **tiles per second** (e.g. 0.5 tiles/sec). To maintain constant visual speed across different movement states, the per-tick progress increment is adjusted by a **progress factor** that accounts for the actual distance covered in each state:

  | State          | Distance Covered                    | Progress Factor                                  |
  | -------------- | ----------------------------------- | ------------------------------------------------ |
  | **Intro**      | 0.5 tiles (center to edge)          | `2 × speed` (half the distance, double the rate) |
  | **Forward**    | 1 tile (edge to edge)               | `speed` (baseline)                               |
  | **TurnRight**  | ¼ circle, radius 0.5 = π/4 ≈ 0.785  | `speed / (π × 0.25)` ≈ `speed / 0.785`           |
  | **TurnLeft**   | ¼ circle, radius 0.5 = π/4 ≈ 0.785  | `speed / (π × 0.25)` ≈ `speed / 0.785`           |
  | **TurnAround** | ½ circle, radius 0 (pivot in place) | `2 × speed` (fast pivot, ≤ 0.5 sec at speed 1)   |
  | **Outro**      | 0.5 tiles (edge to Core center)     | `2 × speed` (half the distance, double the rate) |

  When transitioning between states, leftover progress must be **normalized** before applying the new factor: `progress = (progress - 1) / oldFactor; progress *= newFactor;`

- 2.10.9. **Rendering vs Simulation Boundary:** All of §2.10.4–2.10.8 are **rendering-only** concerns. The simulation (tick pipeline §1.10) uses only the discrete tile position from §2.10.3 — the enemy is "on" the tile it last entered. Edge-to-edge interpolation, arc curves, orientation, and progress factors exist solely for smooth visual presentation and do not affect game logic.

---

## 3. Core

3.1. The Core is displayed as a **blue dotted square** in the center of the map and occupies **exactly 1 tile**.  
3.2. **Core Health** is displayed as a **blue bar** above the Core.  
3.3. **Starting Health:** 100 HP at game start.  
3.4. An enemy must **enter the Core tile** (move onto position 26,26) to deal damage. Damage equal to the enemy's full damage value is applied on entry.  
3.5. If Core Health reaches **0**, the game ends in a **loss** (see §10.2).  
3.6. [TBD] Core Health **may increase** through upgrades as the game progresses.  
3.7. [TBD] The Core may gain additional **defensive effects or abilities** through upgrades at later stages.

---

## 4. Resources

### 4.1. **Eddies**

4.1.1. **Eddies** are the primary currency of the game. Indicated with €$ symbol.
4.1.2. Used to: build towers, upgrade towers, activate abilities, and purchase **Components**.  
4.1.3. Generated by **Ping** networked **Harvester** towers to the core (see §5.8).  
4.1.4. Boosted temporarily by **skipping wave breaks** (see §8.7).  
4.1.5. Boosted permanently on Harvesters via the **Boosted** ability (see §6.4).

### 4.2. **Components**

4.2.1. **Components** are the secondary resource used for building and upgrading towers.  
4.2.2. Acquired by: spending **Eddies**, or collecting drops via **Ping Towers** (see §5.7).  
4.2.3. **Components** dropped by defeated enemies or dismantled towers exist on the map as **pickups**.  
4.2.4. Pickups within range of a **Ping Tower** are automatically collected.  
4.2.5. Pickups **outside** Ping Tower range will **decay at (5/60) ≈ 0.083% of their initial value per tick** and are fully lost when they reach 0.
4.2.6. Towers dismantled **within** Ping Tower range return **100% of their **Components\***\*.  
4.2.7. Towers dismantled **outside** Ping Tower range return **0% of their **Components\*\*** (left to decay).  
4.2.8. Decaying **Components** can be saved by building a new Ping Tower near them before they expire.
4.2.9. 100 **Eddies** can be converted into 1 **Component** at any time from the player's **Eddie** pool.

### 4.3. **Initial Resources**

## 4.3.1. The player starts with **400 Eddies** and **3 Components** at the beginning of the game.

## 5. Towers

### General Tower Rules

5.0.1. Towers are placed on the grid and **automatically attack** enemies within Chebyshev distance tile range.  
5.0.2. Each tower has **Health (HP)**; if reduced to 0, the tower is **destroyed and removed** from the map.  
5.0.3. Towers are upgraded using **Components** (and sometimes **Eddies**).  
5.0.4. **Upgrade cost doubles** at each upgrade level (both **Eddies** and **Components**).  
5.0.5. **Maximum tower level is 10.**  
5.0.6. Towers **unlock an Ability at level 5**. Abilities are **tower-instance specific** — unlocking on one tower does not unlock it on others of the same type.  
5.0.7. Abilities can be further upgraded with **Components** up to a **maximum ability level of 5**.  
5.0.8. All Damages are applied every tick. For example, a tower with 10 DPS applies 10/60 ≈ 0.167 damage per tick to enemies within range, distributed according to the tower's targeting rules (e.g. single-target, multi-target, area damage, etc.).

---

### 5.1. ICE Wall

| Stat          | Value                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Role          | Obstacle / Crowd Control                                                        |
| Health        | 200 HP (level 1)                                                                |
| Range         | 1 block in all directions                                                       |
| Damage        | 1/60 ≈ 0.0167 damage/tick to adjacent enemies and **Glitches** passing through. |
| Slow          | 20% at level 1 → 50% at max upgrade                                             |
| Unlocks (Lv5) | EMP Blast (see §6.1)                                                            |

**Cost & Upgrade Path**

| Level | Eddies | Components | Effect                                              |
| ----- | ------ | ---------- | --------------------------------------------------- |
| 1     | 50     | -          | Basic ICE Wall                                      |
| 2     | -      | 1          | +200 HP, +1 Damage/sec, +10% slow                   |
| 3     | -      | 2          | +200 HP, +1 Damage/sec, +9% slow                    |
| 4     | -      | 4          | +200 HP, +1 Damage/sec, +8% slow                    |
| 5     | -      | 8          | +200 HP, +1 Damage/sec, +7% slow, Unlocks EMP Blast |
| 6     | -      | 16         | +200 HP, +1 Damage/sec, +6% slow                    |
| 7     | -      | 32         | +200 HP, +1 Damage/sec, +5% slow                    |
| 8     | -      | 64         | +200 HP, +1 Damage/sec, +4% slow                    |
| 9     | -      | 128        | +200 HP, +1 Damage/sec, +3% slow                    |
| 10    | -      | 256        | +200 HP, +1 Damage/sec, +2% slow                    |

5.1.1. Slows all enemies in adjacent tiles.  
5.1.2. Applies a small **damage-over-time** effect to adjacent enemies.  
5.1.3. Acts as a **physical obstacle** — enemies must path around it, enabling choke points.  
5.1.4. Cheap and high-health; ideal as a foundational defensive structure.  
5.1.5. Upgrades increase health and slow percentage.  
5.1.6. Upgrade cost: doubles in **Components** at each level (base 50 Eddies at level 1).

---

### 5.2. Firewall

| Stat          | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Role          | Trap / Area Denial                                                                            |
| Health        | 500 HP per tower (level 1)                                                                    |
| Placement     | Pair of towers occupying 3 tiles (horizontal, vertical, or diagonal)                          |
| Range         | 1 tile between the two towers                                                                 |
| Damage        | 10/60 ≈ 0.167 damage/tick to enemies passing between them                                     |
| Effect        | Stuns enemies (full stop) for 60 ticks while in the gateway, applied every tick (Stun-locked) |
| Unlocks (Lv5) | Tuned (see §6.3)                                                                              |

**Cost & Upgrade Path**

| Level | Eddies | Components | Effect                                           |
| ----- | ------ | ---------- | ------------------------------------------------ |
| 1     | 75     | 1          | Basic Firewall                                   |
| 2     | 50     | 3          | +500 HP per tower, +10 damage/sec                |
| 3     | -      | 7          | +500 HP per tower, +10 damage/sec                |
| 4     | -      | 14         | +500 HP per tower, +10 damage/sec                |
| 5     | -      | 28         | +500 HP per tower, +10 damage/sec, Unlocks Tuned |
| 6     | -      | 56         | +500 HP per tower, +10 damage/sec                |
| 7     | -      | 112        | +500 HP per tower, +10 damage/sec                |
| 8     | -      | 224        | +500 HP per tower, +10 damage/sec                |
| 9     | -      | 448        | +500 HP per tower, +10 damage/sec                |
| 10    | -      | 896        | +500 HP per tower, +10 damage/sec                |

5.2.1. Placed as a **pair** — two towers with exactly 1 tile gap between them forming a "gateway."  
5.2.2. Damages and **stuns** (fully stops, see §7.0.7) enemies that pass through the gap. Except **Firewall Breacher** enemies, which are immune to the stun effect but still take damage.
5.2.3. Can be oriented **horizontally, vertically, or diagonally**.  
5.2.4. If **either tower is destroyed**, both towers are destroyed simultaneously.  
5.2.5. On destruction of one tower, deals **the tower's current damage value** to all enemies in adjoining tiles of the other tower (same damage as its active DPS, applied once as a burst to all enemies on 8 surrounding tiles).  
5.2.6. Upgrade cost: doubles in **Eddies** and **Components** at each level.

---

### 5.3. Data Spike

| Stat          | Value                                     |
| ------------- | ----------------------------------------- |
| Role          | Offensive / Line Damage                   |
| Health        | 500 HP (level 1)                          |
| Range         | 2 tiles in facing direction (level 1)     |
| Damage        | 10 damage/spike; hits all enemies in path |
| Fire Rate     | 1 spike every 120 ticks (2 seconds)       |
| Fire Arc      | Fixed 90° cone (3 side-by-side tiles)     |
| Unlocks (Lv5) | Overclock (see §6.2)                      |

**Cost & Upgrade Path**

| Level | Eddies | Components | Effect                                                |
| ----- | ------ | ---------- | ----------------------------------------------------- |
| 1     | 150    | 2          | Basic Data Spike                                      |
| 2     | -      | 7          | +500HP, +1 Range, +10 damage/spike                    |
| 3     | -      | 14         | +500HP, +1 Range, +10 damage/spike                    |
| 4     | -      | 28         | +500HP, +1 Range, +10 damage/spike                    |
| 5     | -      | 56         | +500HP, +1 Range, +10 damage/spike, Unlocks Overclock |
| 6     | -      | 112        | +500HP, +10 damage/spike                              |
| 7     | -      | 224        | +500HP, +10 damage/spike                              |
| 8     | -      | 448        | +500HP, +10 damage/spike                              |
| 9     | -      | 896        | +500HP, +10 damage/spike                              |
| 10    | -      | 1792       | +500HP, +10 damage/spike                              |

5.3.1. Fires in a **fixed direction** — direction is set at placement and cannot be changed.  
5.3.2. Attacks a cone **90-degree arc** (3 adjacent tiles in the facing direction). Starting with 3 horizontal tiles if facing up/down, 3 vertical tiles if facing left/right, and 3 diagonal tiles if facing diagonally. Upto Range determines how far the spike travels in that direction, damaging all enemies in its path. Chebyshev distance is used to determine range and affected tiles.
5.3.3. Damages **every enemy** in its path (piercing).  
5.3.4. Short range but high damage; upgrades increase both range and damage significantly.  
5.3.5. Upgrade cost: doubles in **Eddies** and **Components** at each level.
5.3.6. Arc Shapes as below based on facing direction:

```
┌───┬───┬───┬───┬───┐              ┌───┬───┬───┐
│ X │ X │ X │ X │ X │              │ X │ X │ X │
└───┼───┼───┼───┼───┘          ┌───┼───┼───┼───┤
    │ X │ X │ X │              │   │ X │ X │ X │
    ├───┼───┼───┤              ├───┼───┼───┼───┤
    │   │ T │   │              │   │ T │ X │ X │
    ├───┼───┼───┤              ├───┼───┼───┼───┘
    │   │   │   │              │   │   │   │
    └───┴───┴───┘              └───┴───┴───┘
```

---

### 5.4. Daemon Turret

| Stat          | Value                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| Role          | Offensive / Multi-target                                                           |
| Health        | 100 HP (level 1)                                                                   |
| Range         | 1 tile (level 1)                                                                   |
| Damage        | 10 damage/daemon (level 1); applied to **each enemy** on the tile the daemon hits. |
| Fire Rate     | 1 daemon every 120 ticks (2 seconds, level 1)                                      |
| Rotation      | 0.5 degree/tick (level 1)                                                          |
| Unlocks (Lv5) | Overclock (see §6.2)                                                               |

**Cost & Upgrade Path**

| Level | Eddies | Components | Effect                                                        |
| ----- | ------ | ---------- | ------------------------------------------------------------- |
| 1     | -      | 5          | Basic turret                                                  |
| 2     | -      | 10         | +100 HP, +5 damage/daemon                                     |
| 3     | -      | 20         | +100 HP, +5 damage/daemon                                     |
| 4     | -      | 40         | +100 HP, +5 damage/daemon                                     |
| 5     | -      | 80         | +100 HP, 1 degree/tick Rotation, Unlocks Overclock (see §6.2) |
| 6     | -      | 160        | 1 daemon/108 ticks (1.8 sec)                                  |
| 7     | -      | 320        | 1 daemon/96 ticks (1.6 sec)                                   |
| 8     | -      | 640        | 1 daemon/84 ticks (1.4 sec)                                   |
| 9     | -      | 1280       | 1 daemon/72 ticks (1.2 sec)                                   |
| 10    | -      | 2560       | 1 daemon/60 ticks (1 sec)                                     |

5.4.1. **Rotates** to face enemies — rotation speed increases with upgrades.  
5.4.2. Can target **multiple enemies simultaneously**; deals 10 damage/daemon to every enemy on the impacted tile (not split — each enemy takes the full amount). Player selects targetting mode.
5.4.2.1 **Closest Enemy Mode:** (Default) Targets the tile with the closest enemy.
5.4.2.2 **Highest HP Mode:** Targets the tile with the enemy that has the highest HP.
5.4.2.3 **Lowest HP Mode:** Targets the tile with the enemy that has the lowest HP.
5.4.3. More effective against **groups of weaker enemies** than single strong ones.  
5.4.4. Upgrades increase health, range, and fire rate.  
5.4.5. Upgrade cost: doubles in **Eddies** and **Components** at each level.

---

### 5.5. ICE Sniper

| Stat          | Value                                       |
| ------------- | ------------------------------------------- |
| Role          | Offensive / Single-target Sniper            |
| Health        | 100 HP (level 1)                            |
| Range         | 3–5 tiles (minimum 3, maximum 5 at level 1) |
| Damage        | 50 damage/shot (level 1)                    |
| Targets       | 1 enemy at a time                           |
| Fire Rate     | 1 shot every 180 ticks (3 seconds)          |
| On-hit Effect | Slow 20% for 120 ticks (2 seconds, level 1) |
| Rotation      | 0.5 degree/tick (level 1)                   |
| Unlocks (Lv5) | Overclock (see §6.2)                        |

**Cost & Upgrade Path**

| Level | Eddies | Components | Effect                                                         |
| ----- | ------ | ---------- | -------------------------------------------------------------- |
| 1     | -      | 10         | Basic sniper                                                   |
| 2     | -      | 15         | +100 HP, +10 damage/daemon                                     |
| 3     | -      | 30         | +100 HP, +10 damage/daemon                                     |
| 4     | -      | 60         | +100 HP, +10 damage/daemon                                     |
| 5     | -      | 120        | Unlocks Overclock (see §6.2)                                   |
| 6     | -      | 240        | 30% slow, 1 daemon/168 ticks (2.8 sec), 1 degree/tick Rotation |
| 7     | -      | 480        | 40% slow, 1 daemon/156 ticks (2.6 sec)                         |
| 8     | -      | 960        | 50% slow, 1 daemon/144 ticks (2.4 sec)                         |
| 9     | -      | 1920       | 60% slow, 1 daemon/132 ticks (2.2 sec)                         |
| 10    | -      | 3840       | 70% slow, 1 daemon/120 ticks (2 sec), 2 degree/tick Rotation   |

5.5.1. Fires in **one direction** but can rotate to track targets.  
5.5.2. Has a **minimum range of 3 tiles** — does not attack enemies closer than 3 tiles.  
5.5.3. Applies a **20% slow for 120 ticks (2 seconds)** on every hit at level 1; slow percentage and duration increase with upgrades.  
5.5.4. Targets only **one enemy at a time** — best used against high-HP priority targets. Player selects targetting mode.
5.5.4.1 **Closest Enemy Mode:** (Default) Targets the closest enemy.
5.5.4.2 **Highest HP Mode:** Targets the enemy with the highest HP.
5.5.4.3 **Lowest HP Mode:** Targets the enemy with the lowest HP.

5.5.5. Requires supporting towers to handle enemies that close within the minimum range.  
5.5.6. Upgrades increase health, range, damage, and fire rate.  
5.5.7. Upgrade cost: doubles in **Eddies** and **Components** at each level.

---

### 5.6. Blackwall Tower

| Stat                 | Value                                                       |
| -------------------- | ----------------------------------------------------------- |
| Role                 | Support / Blackwall Restoration                             |
| Health               | 1000 HP (level 1)                                           |
| Passive Damage Taken | -1000 HP/7200 ticks (2 mins) per adjacent Gateway           |
| Damage               | Damages adjacent Gateway by 1000 HP/7200 ticks (2 mins)     |
| Repair Cost          | 10 **Components** for a full repair; consumed automatically |

**Cost & Upgrade Path**

| Level | Eddies | Components | Effect                               |
| ----- | ------ | ---------- | ------------------------------------ |
| 1     | -      | 20         | Basic Blackwall Tower                |
| 2     | -      | 40         | +1000 HP, +1000 HP/7200 ticks damage |
| 3     | -      | 80         | +1000 HP, +1000 HP/7200 ticks damage |
| 4     | -      | 160        | +1000 HP, +1000 HP/7200 ticks damage |
| 5     | -      | 320        | +1000 HP, +1000 HP/7200 ticks damage |
| 6     | -      | 640        | +1000 HP, +1000 HP/7200 ticks damage |
| 7     | -      | 1280       | +1000 HP, +1000 HP/7200 ticks damage |
| 8     | -      | 2560       | +1000 HP, +1000 HP/7200 ticks damage |
| 9     | -      | 5120       | +1000 HP, +1000 HP/7200 ticks damage |
| 10    | -      | 10240      | +1000 HP, +1000 HP/7200 ticks damage |

5.6.1. Must be placed **adjacent** (orthogonally or diagonally) to a Blackwall Gateway to begin closing it. A Blackwall Tower can only be assigned to close a Gateway if it is placed in one of the 8 tiles surrounding that Gateway.  
5.6.2. Each Blackwall Tower reduces the assigned Gateway's HP by **1000 HP / 7200 ticks** (≈0.139 HP/tick, applied every tick; see §9.2.9). Multiple towers stack additively.  
5.6.3. A Gateway that is being closed **does not spawn enemies**.  
5.6.4. If a Blackwall Tower is **destroyed**, it stops contributing HP reduction to the Gateway. If no Blackwall Towers remain assigned, the Gateway **immediately reopens** and resumes spawning.  
5.6.5. A **permanently closed** Gateway (HP = 0) is removed from the map and cannot reopen.  
5.6.6. Takes **1000 HP / 7200 ticks** (≈0.139 HP/tick, applied every tick) damage while adjacent to an open Gateway. A level 1 tower (1000 HP) is destroyed after **7200 ticks** (2 minutes) without repair.  
5.6.7. Repair costs **10 **Components\***\* for a full HP restore at level 1. Repair is **automatic** — **Components** are consumed from the player's pool continuously as needed. Partial repairs occur if the player has fewer **Components** than required for a full restore.  
5.6.8. Upgrade cost: doubles in **Eddies** and **Components\*\* at each level.

---

### 5.7. Ping Tower

| Stat          | Value                                   |
| ------------- | --------------------------------------- |
| Role          | Support / Resource Gathering            |
| Health        | 100 HP (level 1)                        |
| Range         | 3 tiles (level 1)                       |
| Unlocks (Lv5) | Oracle (see §6.5) or Boosted (see §6.4) |

**Cost & Upgrade Path**

| Level | Eddies | Components | Effect                    |
| ----- | ------ | ---------- | ------------------------- |
| 1     | -      | 2          | Basic Ping Tower          |
| 2     | -      | 4          | +100HP, +1 Range          |
| 3     | -      | 8          | +100HP, +1 Range          |
| 4     | -      | 16         | +100HP, +1 Range          |
| 5     | -      | 32         | Unlocks Oracle or Boosted |
| 6     | -      | 64         | +100HP, +1 Range          |
| 7     | -      | 128        | +100HP, +1 Range          |
| 8     | -      | 256        | +100HP, +1 Range          |
| 9     | -      | 512        | +100HP, +1 Range          |
| 10    | -      | 1024       | +100HP, +1 Range          |

5.7.1. Automatically **collects **Components\***\* dropped by defeated enemies and destroyed towers within range.  
5.7.2. **Harvesters within range** of a Ping Tower send their generated **Eddies\*\* **directly to the player's Eddie pool**. Harvesters not connected to any Ping Tower do **not** generate **Eddies** for the player.  
5.7.3. Towers dismantled within range return **100% of their **Components\***\*.  
5.7.4. A network of Ping Towers can cover large areas of the map for efficient resource collection.  
5.7.5. Vulnerable to enemy attacks — must be protected.  
5.7.6. Upgrades increase health and collection range.  
5.7.7. Upgrade cost: doubles in **Eddies** and **Components\*\* at each level.

---

### 5.8. Harvester

| Stat          | Value                              |
| ------------- | ---------------------------------- |
| Role          | Support / Economy                  |
| Health        | 100 HP (level 1)                   |
| Generation    | 1/60 ≈ 0.0167 Eddie/tick (level 1) |
| Unlocks (Lv5) | Overclock (see §6.2)               |

**Cost & Upgrade Path**

| Level | Eddies | Components | Effect                                          |
| ----- | ------ | ---------- | ----------------------------------------------- |
| 1     | -      | 2          | Basic Harvester                                 |
| 2     | -      | 4          | +100HP, +1/60 Eddie/tick                        |
| 3     | -      | 8          | +100HP, +1/60 Eddie/tick, +1/600 Component/tick |
| 4     | -      | 16         | +100HP, +1/60 Eddie/tick, +1/600 Component/tick |
| 5     | -      | 32         | Unlocks Overclock (see §6.2)                    |
| 6     | -      | 64         | +100HP, +1/60 Eddie/tick, +1/600 Component/tick |
| 7     | -      | 128        | +100HP, +1/60 Eddie/tick, +1/600 Component/tick |
| 8     | -      | 256        | +100HP, +1/60 Eddie/tick, +1/600 Component/tick |
| 9     | -      | 512        | +100HP, +1/60 Eddie/tick, +1/600 Component/tick |
| 10    | -      | 1024       | +100HP, +1/60 Eddie/tick, +1/600 Component/tick |

5.8.1. Generates **Eddies over time** if connected to a **Ping Tower** network.  
5.8.2. Upgraded Harvesters can also generate **Components** starting at level 3, 1 component per 600 ticks (10 seconds).  
5.8.3. Can be **damaged or disabled** by certain enemy types.  
5.8.4. Must be protected with combat towers and abilities.  
5.8.5. Upgrades increase health and Eddie (and eventually Component) generation rate.  
5.8.6. Upgrade cost: doubles in **Eddies** and **Components** at each level.

---

## 6. Abilities

### General Ability Rules

6.0.1. Abilities are **unlocked at Tower level 5** and are **specific to that tower instance**.  
6.0.2. Abilities can be **upgraded with **Components\***\* to increase their effectiveness.  
6.0.3. Most abilities have a **cooldown** and cost **Eddies** to activate.  
6.0.4. Abilities can be **combined\*\* with other abilities for synergistic effects.

---

### 6.1. EMP Blast

| Stat          | Value                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Type          | Offensive / Crowd Control                                                                 |
| Unlocked By   | ICE Wall (level 5)                                                                        |
| Cooldown      | 600 ticks (base) → 900 ticks (max upgrade)                                                |
| Range         | Same as the ICE Wall it is attached to (1 tile at level 1, increases with tower upgrades) |
| Stun Duration | 120 ticks (base) → 600 ticks (max upgrade)                                                |

**Cost & Upgrade Path**

| Level | Components | Effect                                            |
| ----- | ---------- | ------------------------------------------------- |
| 1     | 1          | Base EMP Blast (120 tick stun, 600 tick cooldown) |
| 2     | 2          | +120 tick stun duration, +60 tick cooldown        |
| 3     | 4          | +120 tick stun duration, +60 tick cooldown        |
| 4     | 8          | +120 tick stun duration, +60 tick cooldown        |
| 5     | 16         | +120 tick stun duration, 900 tick cooldown        |

6.1.1. **Fully stops** all enemies within the ICE Wall's current range for the stun duration (speed reduced to 0).  
6.1.2. Stun is a **hard crowd-control** effect — enemies cannot move or act while stunned (see §7.0.7).  
6.1.3. **Data Leech** is immune to EMP Blast stun.  
6.1.4. Synergises with **Overclock** to increase range and stun duration temporarily. Applies the overclock fire rate boost to the stun duration as well, effectively increasing it by up to 200% at max upgrade (e.g. 600 tick base duration becomes 1800 ticks with max Overclock boost).
6.1.5. Cooldown **increases** at max upgrade (900 ticks vs 600 ticks base) due to stun duration increase.

---

### 6.2. Overclock

| Stat            | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Type            | Offensive / Buff                                           |
| Unlocked By     | Data Spike, Daemon Turret, ICE Sniper, Harvester (level 5) |
| Cooldown        | 1200 ticks (20 seconds)                                    |
| Duration        | 300 ticks (5 seconds)                                      |
| Fire Rate Boost | +50% (base) → +200% (max upgrade)                          |

**Cost & Upgrade Path**

| Level | Components | Effect                                     |
| ----- | ---------- | ------------------------------------------ |
| 1     | 1          | Base Overclock (+50% fire rate, 300 ticks) |
| 2     | 2          | +25% fire rate boost                       |
| 3     | 4          | +25% fire rate boost                       |
| 4     | 8          | +25% fire rate boost                       |
| 5     | 16         | +25% fire rate boost (total +200%)         |

6.2.1. Temporarily increases the **firing rate** of the tower it is attached to for **5 seconds**.  
6.2.2. On Harvesters, increases **Eddie generation rate** instead of fire rate.  
6.2.3. Synergises with **EMP Blast** to increase that ability's range and stun duration.  
6.2.4. Duration and boost percentage increase with upgrades.

---

### 6.3. Tuned

| Stat                   | Value                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Type                   | Offensive / Type Bonus                                                                                                 |
| Unlocked By            | Firewall (level 5)                                                                                                     |
| Damage Bonus           | Base = Firewall's current damage value (e.g. 10 DPS at level 1) added on top → +100% of Firewall damage at max upgrade |
| Target Switch Cooldown | 1200 ticks (level 1) → 300 ticks (max upgrade)                                                                         |

**Cost & Upgrade Path**

| Level | Components | Effect                                                    |
| ----- | ---------- | --------------------------------------------------------- |
| 1     | 1          | Base Tuned (+10 DPS bonus, 1200 tick switch cooldown)     |
| 2     | 2          | +25% damage bonus, -180 tick switch cooldown              |
| 3     | 4          | +25% damage bonus, -180 tick switch cooldown              |
| 4     | 8          | +25% damage bonus, -180 tick switch cooldown              |
| 5     | 16         | +25% damage bonus (total +100%), 300 tick switch cooldown |

6.3.1. Increases the Firewall's damage against a **player-chosen enemy type** by an amount equal to the Firewall's current base damage (e.g. +10 DPS at level 1, doubling effective damage against that type).  
6.3.2. The player can **manually switch the target enemy type** at any time, subject to a cooldown.  
6.3.3. Target switch cooldown is **20 seconds at level 1**, reducing to **5 seconds at max upgrade**.  
6.3.4. Synergises with **Overclock** to increase damage bonus and duration.  
6.3.5. Upgrade increases both the damage bonus percentage and reduces the target switch cooldown.

---

### 6.4. Boosted

| Stat        | Value                             |
| ----------- | --------------------------------- |
| Type        | Support / Permanent Buff          |
| Unlocked By | Ping Tower (level 5)              |
| Eddie Boost | +50% (base) → +200% (max upgrade) |

**Cost & Upgrade Path**

| Level | Components | Effect                               |
| ----- | ---------- | ------------------------------------ |
| 1     | 1          | Base Boosted (+50% Eddie generation) |
| 2     | 2          | +50% Eddie boost (total +100%)       |
| 3     | 4          | +33% Eddie boost (total +133%)       |
| 4     | 8          | +33% Eddie boost (total +166%)       |
| 5     | 16         | +34% Eddie boost (total +200%)       |

6.4.1. **Permanently** increases the Eddie generation rate of all **Harvesters within the Ping Tower's range**.  
6.4.2. Effect is **permanent** — no cooldown or activation cost.  
6.4.3. Can only be unlocked on a **Ping Tower** instance.  
6.4.4. Upgrade increases the generation rate bonus percentage. **Maximum ability level: 5.**

---

### 6.5. Oracle

| Stat        | Value                             |
| ----------- | --------------------------------- |
| Type        | Support / Permanent Buff          |
| Unlocked By | Ping Tower (level 5)              |
| Range Boost | +50% (base) → +200% (max upgrade) |

**Cost & Upgrade Path**

| Level | Components | Effect                         |
| ----- | ---------- | ------------------------------ |
| 1     | 1          | Base Oracle (+50% range)       |
| 2     | 2          | +50% range boost (total +100%) |
| 3     | 4          | +33% range boost (total +133%) |
| 4     | 8          | +33% range boost (total +166%) |
| 5     | 16         | +34% range boost (total +200%) |

6.5.1. **Permanently** increases the collection range of the Ping Tower it is attached to.  
6.5.2. Effect is **permanent** — no cooldown or activation cost.  
6.5.3. Can only be unlocked on a **Ping Tower** instance.  
6.5.4. Upgrade increases the range bonus percentage. **Maximum ability level: 5.**

> **Note:** A Ping Tower at level 5 must choose between **Boosted** or **Oracle** — they are mutually exclusive unlocks on the same tower instance.

---

## 7. Enemies

### General Enemy Rules

7.0.1. Enemies are displayed as **red dots** on the map.  
7.0.2. All enemies use **pathfinding** to find the shortest valid path to the Core. Enemies do not travel diagonally — they only move orthogonally, so they must navigate around obstacles accordingly. Enemy movement is updated every tick based on their speed in tiles/tick.
7.0.3. Enemies that reach the Core deal their **damage value** to Core Health.  
7.0.4. Enemies scale in strength with **wave multipliers** — the same enemy type is stronger in later waves.  
7.0.5. Each enemy type has specific **resistances, immunities, and vulnerabilities** that must be accounted for strategically.
7.0.6. During a wave, exactly one enemy is spawned per tick globally. Active Gateways are iterated in deterministic round-robin order. Each tick spawns one enemy from the next Gateway until the wave’s total enemy count is exhausted. If a Gateway is closed or destroyed, it is removed from the Active Gateways immediately.
7.0.7. Enemies drop **Eddies** and **Components** equivalent to their value when defeated. The player collects these resources by placing **Ping Towers** within range of the drops. Enemies that reach the Core do not drop resources.
7.0.8. Values are calculated as: **Enemy Value = (Damage + Health) x Speed x Tier Multiplier x Level**, if the value has X multiples of 100 Eddies, replace it with X components (e.g. 150 Eddies becomes 1 Component and 50 Eddies (1 Component = 100 Eddies)).  
7.0.9. Enemies can be affected by **status effects** that modify their behavior temporarily, such as slowing or stunning them.

**Status Effect Definitions:**  
7.0.10. **Slow** — Reduces an enemy's movement speed by a percentage for a duration. Does not stop movement entirely.  
7.0.11. **Stun** — Brings an enemy's movement speed to **0** (full stop) for a duration. The enemy cannot move or act while stunned.

**Status Effect Interactions:**
7.0.12. If Stun is applied to a slowed enemy, the slow effect is removed and the enemy is fully stopped for the stun duration in ticks. When the stun expires, the enemy's speed returns to normal (not slowed).
7.0.13. Slow cannot be applied to Stunned enemies.
7.0.14. If an enemy is immune to Stun, it cannot be stunned but can still be slowed if it is not already at minimum speed. If it is already at minimum speed, slow effects have no impact.
7.0.15. Only one Slow may be active on an enemy at a time. If a new Slow is applied: if its reduction percentage is **greater** than the current Slow, it **replaces** the current Slow and **resets the duration**; otherwise the new Slow is **ignored**. Stuns always take priority over slows regardless of duration or strength.
7.0.16. Only one Stun may be active on an enemy at a time. If a new Stun is applied: if its duration is **greater** than the remaining duration of the current Stun, it **replaces** the current Stun; otherwise the new Stun is **ignored**. Stuns always take priority over slows regardless of duration or strength.

---

### 7.1. Data Leech

| Stat            | Level 1 Value                                 |
| --------------- | --------------------------------------------- |
| Damage          | 5                                             |
| Health          | 10                                            |
| Speed           | 0.5/60 ≈ 0.0083 tiles/tick                    |
| Stun Immune     | Yes (immune to EMP Blast)                     |
| Slow Immune     | Yes (already at minimum speed)                |
| Tier Multiplier | 1 (base)                                      |
| Value           | (5 + 10) x 0.5 x 1 = 7.5 **Eddies** (level 1) |

7.1.1. Slow and weak — the most basic enemy type.  
7.1.2. Countered effectively by ICE Wall and Data Spike.  
7.1.3. **Cannot be stunned** by EMP Blast. or Firewall stun.
7.1.4. **Cannot be slowed** — already moves at minimum speed; slow effects have no impact.

---

### 7.2. Code Runner

| Stat            | Level 1 Value                                |
| --------------- | -------------------------------------------- |
| Damage          | 10                                           |
| Health          | 5                                            |
| Speed           | 1.0/60 ≈ 0.0167 tiles/tick                   |
| Tier Multiplier | 2 (level 1)                                  |
| Value           | (10 + 5) x 1.0 x 2 = 30 **Eddies** (level 1) |

7.2.1. Fast and fragile — dangerous in large numbers due to speed.  
7.2.2. Countered by ICE Wall (slow) and Data Spike.  
7.2.3. Can be stunned by EMP Blast. and Firewall stun.

---

### 7.3. Firewall Breacher

| Stat            | Level 1 Value                                  |
| --------------- | ---------------------------------------------- |
| Damage          | 20                                             |
| Health          | 50                                             |
| Speed           | 0.5/60 ≈ 0.0083 tiles/tick                     |
| Immune To       | ICE Wall slow, Firewall stun                   |
| Vulnerable To   | Daemon Turret                                  |
| Tier Multiplier | 3 (level 1)                                    |
| Value           | (20 + 50) x 0.5 x 3 = 105 **Eddies** (level 1) |

7.3.1. Slow and tanky — Immune to wall-type towers.  
7.3.2. Can be **stunned** (fully stopped) by EMP Blast. but not by Firewall stun.
7.3.3. Requires Daemon Turret or similar active-fire towers to deal with effectively.

---

### 7.4. Glitch

| Stat            | Level 1 Value                                  |
| --------------- | ---------------------------------------------- |
| Damage          | 20                                             |
| Health          | 50                                             |
| Speed           | 0.5 tiles/second                               |
| Special         | Phases through ICE Wall and Firewall tiles     |
| Tier Multiplier | 4 (level 1)                                    |
| Value           | (20 + 50) x 0.5 x 4 = 140 **Eddies** (level 1) |

7.4.1. Can **phase through** ICE Wall and Firewall towers — it passes through their tiles with **no collision** (not blocked, not slowed, not stunned by them).  
7.4.2. Still takes **full damage** from any active-fire tower (Data Spike, Daemon Turret, ICE Sniper) that targets it.  
7.4.3. Can be stunned by EMP Blast. and Firewall stun.
7.4.4. DoT from ICE Wall still applies if the Glitch passes through an adjacent tile — only the blocking/pathing collision is ignored.

---

### 7.5. Orchestrator

| Stat            | Level 1 Value                                    |
| --------------- | ------------------------------------------------ |
| Damage          | 100                                              |
| Health          | 200                                              |
| Speed           | 0.5/60 ≈ 0.0083 tiles/tick                       |
| Immune To       | ICE Wall damage over time, Firewall damage       |
| On Death        | Spawns 1 Blackwall Gateway at its death location |
| Tier Multiplier | 5 (level 1)                                      |
| Value           | (100 + 200) x 0.5 x 5 = 750 **Eddies** (level 1) |

7.5.1. A **mini-boss** that must be prioritised — killing it spawns a Gateway (see §9).  
7.5.2. Immune to ICE Wall damage over time and Firewall damage.  
7.5.3. Countered by Data Spike and Daemon Turret.  
7.5.4. Can be stunned by EMP Blast. and Firewall stun.
7.5.5. **High priority target** — the Gateway it spawns on death can permanently change the battlefield.

---

### 7.6. VDB Netrunner

| Stat            | Level 1 Value                                                     |
| --------------- | ----------------------------------------------------------------- |
| Damage          | 30                                                                |
| Health          | 750                                                               |
| Speed           | 0.5/60 ≈ 0.0083 tiles/tick                                        |
| Special         | Deals 30 damage (level 1) to all towers within 1 tile as it moves |
| Tier Multiplier | 6 (level 1)                                                       |
| Value           | (30 + 750) x 0.5 x 6 = 2340 **Eddies** (level 1)                  |

7.6.1. A **mini-boss** that deals damage to towers, not just the Core.  
7.6.2. Deals its **base damage value** (30 at level 1, scaled by wave multiplier) to all towers within **1 tile** as it enters each tile every tick.  
7.6.3. Best countered by ICE Sniper (long-range, high single-target damage).  
7.6.4. Can be stunned by EMP Blast. and Firewall stun.
7.6.5. Must be eliminated quickly to prevent tower attrition.

---

### 7.7. Saboteur

| Stat             | Level 1 Value                                    |
| ---------------- | ------------------------------------------------ |
| Damage           | 20                                               |
| Health           | 500                                              |
| Speed            | 0.5/60 ≈ 0.0083 tiles/tick                       |
| Disable Radius   | 1 tile (8 adjacent tiles)                        |
| Disable Duration | 300 ticks (level 1); increases with wave scaling |
| Tier Multiplier  | 7 (level 1)                                      |
| Value            | (20 + 500) x 0.5 x 7 = 1820 **Eddies** (level 1) |

7.7.1. **Disables all towers** within a 1-tile radius (8 adjacent tiles) for 300 ticks (5 seconds) every 600 ticks (10 seconds). Disabled towers cannot attack or use abilities, but still block enemy movement.  
7.7.2. Best countered by ICE Sniper.  
7.7.3. Can be stunned by EMP Blast. and Firewall stun.
7.7.4. Extremely dangerous near clusters of towers — spread tower placement to mitigate.

---

### 7.8. AI Overlord _(Boss)_

| Stat            | Level 1 Value                                     |
| --------------- | ------------------------------------------------- |
| Damage          | 50                                                |
| Health          | 1000                                              |
| Speed           | 0.5/60 ≈ 0.0083 tiles/tick                        |
| Phases          | 3                                                 |
| Tier Multiplier | 8 (level 1)                                       |
| Value           | (50 + 1000) x 0.5 x 8 = 4200 **Eddies** (level 1) |

**Phase 1:**  
7.8.1. **Immune to all damage types.** Except for slowing and stunning effects, the Overlord cannot be damaged in this phase.
7.8.2. Spawns **Blackwall Gateways** on every 5th tile it walks over.

**Phase 2:**  
7.8.3. Becomes **vulnerable to damage**.  
7.8.4. Spawns **Glitches** on every 5th tile it walks over.

**Phase 3:**  
7.8.5. Becomes **even more vulnerable** to damage (50% more damage taken).  
7.8.6. Spawns **Orchestrators** on every 5th tile it walks over.
7.8.7. **Phase transitions** occur every **1800 ticks** (30 seconds) regardless of HP — the Overlord moves to the next phase automatically on the timer.  
7.8.8. **Phase 1 → Phase 2** at 1800 ticks. **Phase 2 → Phase 3** at 3600 ticks.  
7.8.9. Requires a combination of tower types and abilities to defeat.  
7.8.10. Appears every **10 waves starting from wave 50**.  
7.8.11. Defeating all AI Overlords is required for the **win condition** (see §10.1).
7.8.12. Can be slowed and stunned.

---

## 8. Waves

### 8.1. Wave Structure Pattern

Each cycle of waves follows this escalation pattern:  
8.1.1. Small number of easy enemies.  
8.1.2. Large number of easy enemies.  
8.1.3. Small number of easy enemies + a few hard enemies.  
8.1.4. Large number of easy enemies + a few hard enemies.  
8.1.5. Small number of hard enemies.  
8.1.6. Large number of hard enemies.  
8.1.7. **Boss wave.**

### 8.2. Wave Timing

8.2.1. **Waves 1–10:** Player manually triggers each wave (no auto-start).  
8.2.2. **Wave 11 onwards:** Waves start automatically with a break between them.  
8.2.3. Break duration scales **linearly** from **1800 ticks (30 seconds) at wave 10** down to **60 ticks (1 second) at wave 40** using the formula: `break = 1800 - ((wave - 10) × (1740 / 30))` ticks, floored at 60 ticks. From wave 40 onwards the break is fixed at **60 ticks (1 second)**.  
8.2.4. The player may **skip the break** at any time to start the next wave early.

### 8.3. Skip Break Bonus

8.3.1. Skipping a break grants a **2× Eddie generation boost** on all Harvesters for the next **600 ticks (10 seconds)**.  
8.3.2. This bonus should be used strategically to fund emergency builds or upgrades.

### 8.4. Enemy Scaling

8.4.1. All enemy stats (HP, damage, speed) are scaled by the formula: `stat × (1 + 0.1 × wave)`.

- Example: A Data Leech at wave 1 has 10 HP × (1 + 0.1 × 0) = **10 HP**. At wave 10: 10 × (1 + 0.1 × 9) = **19 HP**.

  8.4.2. The multiplier applies to the enemy's **base level 1 stats** as defined in §7.

### 8.5. Blackwall Degradation Effect on Waves

8.5.1. As the Blackwall weakens, waves begin to include **more powerful enemy types**. It weakens every 5 waves starting from first wave thus creating the first **Blackwall Gateway spawn** at wave 1. then at wave 5, wave 10, and so on. Each new Gateway spawn allows stronger enemies to enter from the **Blackwall Gateways**, increasing wave difficulty. Every degradation adds 1 new **Blackwall Gateway** spawn and thus increases the number and strength of enemies in subsequent waves.
8.5.2. Waves begin to include **Blackwall Gateway spawns** from interior map positions, placing enemies closer to the Core.

### 8.6. Boss Waves

8.6.1. An **AI Overlord** appears every **10 waves starting from wave 50** (waves 50, 60, 70, ...).  
8.6.2. Boss waves are **marked** on the wave counter UI in advance.  
8.6.3. Boss waves are significantly harder than regular waves and require full resource preparation.

### 8.7. Example Wave Compositions

| Wave | Enemies                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| 1    | 5 Data Leeches                                                                                                      |
| 2    | 10 Data Leeches                                                                                                     |
| 3    | 5 Data Leeches, 5 Code Runners                                                                                      |
| 4    | 10 Data Leeches, 10 Code Runners                                                                                    |
| 5    | 20 Data Leeches, 20 Code Runners, 1 Firewall Breacher                                                               |
| 6    | 5 Firewall Breachers                                                                                                |
| 7    | 50 Data Leeches                                                                                                     |
| 8    | 20 Code Runners, 20 Firewall Breachers                                                                              |
| 9    | 10 Code Runners, 10 Firewall Breachers, 1 Glitch                                                                    |
| 10   | 1 Orchestrator                                                                                                      |
| 15   | 5 Orchestrators, 5 Glitches                                                                                         |
| 50   | 500 Data Leeches, 100 Code Runners, 50 Firewall Breachers, 20 Glitches, 1 Saboteur, 5 VDB Netrunners, 1 AI Overlord |

---

## 9. The Blackwall & Gateways

### 9.1. The Blackwall

9.1.1. The Blackwall is the boundary separating the Net from the Rogue AIs beyond.  
9.1.2. Displayed as **red dotted lines** around the map perimeter.  
9.1.3. Weakens progressively as the game advances — shown visually by lines **breaking and fading**.  
9.1.4. A weakened Blackwall allows **stronger and more numerous enemies** through.  
9.1.5. The Blackwall is **restored** by permanently closing all Blackwall Gateways (see §9.2) and eliminating all Orchestrators and AI Overlords.

### 9.2. Blackwall Gateways

9.2.1. Gateways are enemy spawn points that can appear **anywhere on the map** — on boundary tiles or interior tiles.  
9.2.2. Gateways are created by three sources:

- **Blackwall boundary degradation** (see §2.5.1) — break points on the boundary edge become boundary Gateways, spawning enemies at the map perimeter. These are randomly (seedable RNG) selected on the boundary edge whenever a new Gateway is due to spawn from degradation.
- **Orchestrators** dying (see §7.5) — spawn a Gateway at their death location on an interior tile.
- **AI Overlords** walking across tiles in Phase 1 (see §7.8) — spawn Gateways on every 5 tiles they traverse.

  9.2.3. **Boundary Gateways** (from degradation) spawn enemies at the map edge — these are the sole means of enemy entry from the perimeter.  
  9.2.4. **Interior Gateways** (from Orchestrators/AI Overlords) spawn enemies deep inside the map, bypassing the player's outer defences entirely.  
  9.2.5. An **open Gateway** of either type spawns enemies in round-robbin fashion till the expected number of enemies is reached. There is **no cap** on the number of simultaneous active Gateways.  
  9.2.6. A Gateway being **actively closed** by Blackwall Towers does **not spawn enemies**.  
  9.2.7. If all assigned Blackwall Towers are destroyed, the Gateway **immediately reopens**.  
  9.2.8. A **permanently closed** Gateway is removed from the map entirely and cannot reopen.
  9.2.9. A **Blackwall Gateway** has 10000 HP. Each adjacent Blackwall Tower reduces the Gateway's HP by 1000 HP/7200 ticks (≈0.139 HP/tick). When the Gateway's HP reaches 0, it is permanently closed and removed from the map.

### 9.3. Closing Gateways (Summary)

| Configuration                              | Time to Close (Gateway HP = 10,000) |
| ------------------------------------------ | ----------------------------------- |
| 1 Blackwall Tower (1,000 HP/7200 ticks)    | 72,000 ticks (20 minutes)           |
| 4 Blackwall Towers (4,000 HP/7200 ticks)   | 18,000 ticks (5 minutes)            |
| 4 Fully Upgraded Level 10 Blackwall Towers | Faster (40,000 HP/7200 ticks)       |

---

## 10. Win & Lose Conditions

### 10.1. Win Condition

10.1.1. The player wins by **fully restoring the Blackwall**.  
10.1.2. The Blackwall is fully restored when **all Blackwall Gateways are permanently closed** AND **no Orchestrators or AI Overlords remain alive**.  
10.1.3. Optimal play achieves the win condition around **wave 60–80**.  
10.1.4. On winning, the game ends with a victory screen.

### 10.2. Lose Condition

10.2.1. The player loses when **Core Health reaches 0**.  
10.2.2. On losing, the player is presented with two options:

- **Restart** — begin a new game from wave 1.
- **Exit** — quit the game.
