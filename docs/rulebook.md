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
1.5. The **Blackwall** weakens over time due to VDBs and Corporations interfering with it, allowing progressively stronger Rogue AIs through.  
1.6. The player must restore the Blackwall by building **Blackwall Towers** and permanently closing all **Blackwall Gateways**.  
1.7. Gameplay is **real-time** and **strategic** — players must manage resources, tower placement, and ability timing simultaneously.

---

## 2. Map & Grid

2.1. The map is a **51×51 tile grid** representing a sector of the Net.  
2.2. The grid is displayed as **blue dotted lines** on a dark background.  
2.3. The **Core occupies the center tile** (position 26, 26 on a 1-indexed grid).  
2.4. **Enemies enter the map through Blackwall Gateways** (see §9.2) on the boundary or interior, and pathfind toward the Core.  
2.5. The **Blackwall boundary** is displayed as **red dotted lines** around the outer edge of the map.  
   - 2.5.1. As the game progresses, the red dotted lines **break and fade**, visually indicating Blackwall degradation. Each break point on the boundary becomes a **Blackwall Gateway** (see §9.2) — all enemy entry into the map occurs through these Gateways.  
2.6. **Tower placement rules:**  
   - 2.6.1. Towers may only be placed on empty grid tiles.  
   - 2.6.2. At least **one valid path** from any map edge to the Core must exist at all times.  
   - 2.6.3. A placement that would **completely block all paths** to the Core is **illegal** and must be rejected.  
2.7. **Blackwall Gateways** (see §9) appear as additional enemy spawn points on the map when triggered — either on **boundary tiles** (from Blackwall degradation) or on **interior tiles** (from Orchestrators/AI Overlords).

---

## 3. Core

3.1. The Core is displayed as a **blue dotted square** in the center of the map.  
3.2. **Core Health** is displayed as a **blue bar** above the Core.  
3.3. **Starting Health:** 100 HP at game start.  
3.4. Enemies that reach the Core tile deal their **full damage value** to Core Health.  
3.5. If Core Health reaches **0**, the game ends in a **loss** (see §10.2).  
3.6. Core Health **may increase** through upgrades as the game progresses.  
3.7. The Core may gain additional **defensive effects or abilities** through upgrades at later stages.

---

## 4. Resources

### 4.1. Eddies
4.1.1. **Eddies** are the primary currency of the game. Indicated with €$ symbol.
4.1.2. Used to: build towers, upgrade towers, activate abilities, and purchase Components.  
4.1.3. Generated passively by **Harvester** towers (see §5.8).  
4.1.4. Boosted temporarily by **skipping wave breaks** (see §8.7).  
4.1.5. Boosted permanently on Harvesters via the **Boosted** ability (see §6.4).

### 4.2. Components
4.2.1. **Components** are the secondary resource used for building and upgrading towers.  
4.2.2. Acquired by: spending Eddies, or collecting drops via **Ping Towers** (see §5.7).  
4.2.3. Components dropped by defeated enemies or dismantled towers exist on the map as **pickups**.  
4.2.4. Pickups within range of a **Ping Tower** are automatically collected.  
4.2.5. Pickups **outside** Ping Tower range will **decay** after a set time and are lost.  
4.2.6. Towers dismantled **within** Ping Tower range return **100% of their Components**.  
4.2.7. Towers dismantled **outside** Ping Tower range return **0% of their Components** (left to decay).  
4.2.8. Decaying Components can be saved by building a new Ping Tower near them before they expire.

### 4.3. Component Tiers
4.3.1. Components have **tiers** that determine their power and rarity.  
4.3.2. Higher-tier Components are required to build and upgrade more powerful towers.  
4.3.3. Lower-tier Components can be **merged** into higher-tier ones by paying an Eddie conversion cost.  
4.3.4. Higher-tier Components can also be gathered by **upgraded Ping Towers**.

---

## 5. Towers

### General Tower Rules
5.0.1. Towers are placed on the grid and **automatically attack** enemies within range.  
5.0.2. Each tower has **Health (HP)**; if reduced to 0, the tower is **destroyed and removed** from the map.  
5.0.3. Towers are upgraded using **Components** (and sometimes Eddies).  
5.0.4. **Upgrade cost doubles** at each upgrade level (both Eddies and Components).  
5.0.5. Towers **unlock an Ability at level 5**. Abilities are **tower-instance specific** — unlocking on one tower does not unlock it on others of the same type.  
5.0.6. Abilities can be further upgraded with Components.

---

### 5.1. ICE Wall
| Stat | Value |
|---|---|
| Role | Obstacle / Crowd Control |
| Cost | 50 Eddies (level 1) |
| Health | 200 HP (level 1) |
| Range | 1 block in all directions |
| Damage | 1 damage/second (DoT) |
| Slow | 20% at level 1 → 50% at max upgrade |
| Unlocks (Lv5) | EMP Blast (see §6.1) |

5.1.1. Slows all enemies in adjacent tiles.  
5.1.2. Applies a small **damage-over-time** effect to adjacent enemies.  
5.1.3. Acts as a **physical obstacle** — enemies must path around it, enabling choke points.  
5.1.4. Cheap and high-health; ideal as a foundational defensive structure.  
5.1.5. Upgrades increase health and slow percentage.  
5.1.6. Upgrade cost: doubles in Eddies at each level (no Component cost at level 1).

---

### 5.2. Firewall
| Stat | Value |
|---|---|
| Role | Trap / Area Denial |
| Cost | 75 Eddies + 1 Component (level 1) |
| Health | 500 HP per tower (level 1) |
| Placement | Pair of towers occupying 3 tiles (horizontal, vertical, or diagonal) |
| Range | 1 tile between the two towers |
| Damage | 10 damage/second to enemies passing between them |
| Slow | 100% (full stop) while in the gateway |
| Unlocks (Lv5) | Tuned (see §6.3) |

5.2.1. Placed as a **pair** — two towers with exactly 1 tile gap between them forming a "gateway."  
5.2.2. Damages and fully stops enemies that pass through the gap.  
5.2.3. Can be oriented **horizontally, vertically, or diagonally**.  
5.2.4. If **either tower is destroyed**, both towers are destroyed simultaneously.  
5.2.5. On destruction, deals **burst damage** to all enemies in adjoining tiles.  
5.2.6. Upgrade cost: doubles in Eddies and Components at each level.

---

### 5.3. Data Spike
| Stat | Value |
|---|---|
| Role | Offensive / Line Damage |
| Cost | 150 Eddies + 2 Components (level 1) |
| Health | 500 HP (level 1) |
| Range | 2 tiles in facing direction (level 1) |
| Damage | 10 damage/spike (level 1); hits all enemies in path |
| Fire Arc | Fixed 90° cone (3 side-by-side tiles) |
| Unlocks (Lv5) | Overclock (see §6.2) |

5.3.1. Fires in a **fixed direction** — direction is set at placement and cannot be changed.  
5.3.2. Attacks a **90-degree arc** (3 adjacent tiles in the facing direction).  
5.3.3. Damages **every enemy** in its path (piercing).  
5.3.4. Short range but high damage; upgrades increase both range and damage significantly.  
5.3.5. Upgrade cost: doubles in Eddies and Components at each level.

---

### 5.4. Daemon Turret
| Stat | Value |
|---|---|
| Role | Offensive / Multi-target |
| Cost | 200 Eddies + 3 Components (level 1) |
| Health | 100 HP (level 1) |
| Range | 1 tile (level 1) |
| Damage | 10 damage/daemon (level 1); split across multiple targets |
| Rotation | Slow at level 1; faster at higher levels |
| Unlocks (Lv5) | Overclock (see §6.2) |

5.4.1. **Rotates** to face enemies — rotation speed increases with upgrades.  
5.4.2. Can target **multiple enemies simultaneously**, but deals less damage per target than the Data Spike.  
5.4.3. More effective against **groups of weaker enemies** than single strong ones.  
5.4.4. Upgrades increase health, range, and fire rate.  
5.4.5. Upgrade cost: doubles in Eddies and Components at each level.

---

### 5.5. ICE Sniper
| Stat | Value |
|---|---|
| Role | Offensive / Single-target Sniper |
| Cost | 500 Eddies + 5 Components (level 1) |
| Health | 100 HP (level 1) |
| Range | 3–5 tiles (minimum 3, maximum 5 at level 1) |
| Damage | 50 damage/shot (level 1) |
| Targets | 1 enemy at a time |
| On-hit Effect | Slow |
| Rotation | Can rotate to face target |
| Unlocks (Lv5) | Overclock (see §6.2) |

5.5.1. Fires in **one direction** but can rotate to track targets.  
5.5.2. Has a **minimum range of 3 tiles** — does not attack enemies closer than 3 tiles.  
5.5.3. Applies a **slow effect** on every hit.  
5.5.4. Targets only **one enemy at a time** — best used against high-HP priority targets.  
5.5.5. Requires supporting towers to handle enemies that close within the minimum range.  
5.5.6. Upgrades increase health, range, damage, and fire rate.  
5.5.7. Upgrade cost: doubles in Eddies and Components at each level.

---

### 5.6. Blackwall Tower
| Stat | Value |
|---|---|
| Role | Support / Blackwall Restoration |
| Cost | 1000 Eddies + 10 Components (level 1) |
| Health | 1000 HP (level 1) |
| Passive Damage | Takes damage over time (requires periodic repair) |
| Repair Cost | Components |

5.6.1. Assigned to a **Blackwall Gateway** to begin closing it.  
5.6.2. **1 Blackwall Tower** closes 1 Gateway in **8 waves**.  
5.6.3. **4 Blackwall Towers** on the same Gateway close it in **2 waves**.  
5.6.4. **4 fully upgraded Blackwall Towers** on the same Gateway close it in **1 wave**.  
5.6.5. A Gateway that is being closed **does not spawn enemies**.  
5.6.6. If a Blackwall Tower is **destroyed**, the Gateway it was assigned to **immediately reopens** and resumes spawning.  
5.6.7. A **permanently closed** Gateway is removed from the map and cannot reopen.  
5.6.8. Takes **passive damage over time** and must be repaired with Components to prevent destruction.  
5.6.9. Upgrade cost: doubles in Eddies and Components at each level.

---

### 5.7. Ping Tower
| Stat | Value |
|---|---|
| Role | Support / Resource Gathering |
| Cost | 100 Eddies + 1 Component (level 1) |
| Health | 100 HP (level 1) |
| Range | 3 tiles (level 1) |
| Unlocks (Lv5) | Oracle (see §6.5) or Boosted (see §6.4) |

5.7.1. Automatically **collects Components** dropped by defeated enemies and destroyed towers within range.  
5.7.2. Automatically **collects Eddies** generated by Harvesters within range.  
5.7.3. Towers dismantled within range return **100% of their Components**.  
5.7.4. A network of Ping Towers can cover large areas of the map for efficient resource collection.  
5.7.5. Vulnerable to enemy attacks — must be protected.  
5.7.6. Upgrades increase health and collection range.  
5.7.7. Upgrade cost: doubles in Eddies and Components at each level.

---

### 5.8. Harvester
| Stat | Value |
|---|---|
| Role | Support / Economy |
| Cost | 100 Eddies + 1 Component (level 1) |
| Health | 100 HP (level 1) |
| Generation | 1 Eddie/second (level 1) |
| Unlocks (Lv5) | Overclock (see §6.2) |

5.8.1. Passively generates **Eddies over time**.  
5.8.2. Upgraded Harvesters can also generate **Components**.  
5.8.3. Can be **damaged or disabled** by certain enemy types.  
5.8.4. Must be protected with combat towers and abilities.  
5.8.5. Upgrades increase health and Eddie (and eventually Component) generation rate.  
5.8.6. Upgrade cost: doubles in Eddies and Components at each level.

---

## 6. Abilities

### General Ability Rules
6.0.1. Abilities are **unlocked at Tower level 5** and are **specific to that tower instance**.  
6.0.2. Abilities can be **upgraded with Components** to increase their effectiveness.  
6.0.3. Most abilities have a **cooldown** and cost **Eddies** to activate.  
6.0.4. Abilities can be **combined** with other abilities for synergistic effects.

---

### 6.1. EMP Blast
| Stat | Value |
|---|---|
| Type | Offensive / Crowd Control |
| Unlocked By | ICE Wall (level 5) |
| Cooldown | 10 seconds (base) → 15 seconds (max upgrade) |
| Stun Duration | 2 seconds (base) → 10 seconds (max upgrade) |
| Cost | 100 Eddies (level 1); increases with upgrades |

6.1.1. **Fully stops** all enemies within range of the ICE Wall for the stun duration (speed reduced to 0).  
6.1.2. Stun is a **hard crowd-control** effect — enemies cannot move or act while stunned (see §7.0.7).  
6.1.3. **Data Leech** is immune to EMP Blast stun.  
6.1.4. Synergises with **Overclock** to increase range and stun duration temporarily.  
6.1.5. Cooldown **increases** at max upgrade (15s vs 10s base) due to increased power.

---

### 6.2. Overclock
| Stat | Value |
|---|---|
| Type | Offensive / Buff |
| Unlocked By | Data Spike, Daemon Turret, ICE Sniper, Harvester (level 5) |
| Cooldown | 20 seconds |
| Fire Rate Boost | +50% (base) → +200% (max upgrade) |
| Cost | 100 Eddies (level 1); increases with upgrades |

6.2.1. Temporarily increases the **firing rate** of the tower it is attached to.  
6.2.2. On Harvesters, increases **Eddie generation rate** instead of fire rate.  
6.2.3. Synergises with **EMP Blast** to increase that ability's range and stun duration.  
6.2.4. Duration and boost percentage increase with upgrades.

---

### 6.3. Tuned
| Stat | Value |
|---|---|
| Type | Offensive / Type Bonus |
| Unlocked By | Firewall (level 5) |
| Damage Bonus | Variable (base) → +100% (max upgrade) |
| Target Switch Cooldown | 20 seconds (level 1) → 5 seconds (max upgrade) |
| Cost | 100 Eddies (level 1); increases with upgrades |

6.3.1. Increases the Firewall's damage against a **player-chosen enemy type**.  
6.3.2. The player can **manually switch the target enemy type** at any time, subject to a cooldown.  
6.3.3. Target switch cooldown is **20 seconds at level 1**, reducing to **5 seconds at max upgrade**.  
6.3.4. Synergises with **Overclock** to increase damage bonus and duration.  
6.3.5. Upgrade increases both the damage bonus percentage and reduces the target switch cooldown.

---

### 6.4. Boosted
| Stat | Value |
|---|---|
| Type | Support / Permanent Buff |
| Unlocked By | Ping Tower (level 5) |
| Eddie Boost | +50% (base) → +200% (max upgrade) |
| Cost | None (permanent upgrade) |

6.4.1. **Permanently** increases the Eddie generation rate of all **Harvesters within the Ping Tower's range**.  
6.4.2. Effect is **permanent** — no cooldown or activation cost.  
6.4.3. Can only be unlocked on a **Ping Tower** instance.  
6.4.4. Upgrade increases the generation rate bonus percentage.

---

### 6.5. Oracle
| Stat | Value |
|---|---|
| Type | Support / Permanent Buff |
| Unlocked By | Ping Tower (level 5) |
| Range Boost | +50% (base) → +200% (max upgrade) |
| Cost | None (permanent upgrade) |

6.5.1. **Permanently** increases the collection range of the Ping Tower it is attached to.  
6.5.2. Effect is **permanent** — no cooldown or activation cost.  
6.5.3. Can only be unlocked on a **Ping Tower** instance.  
6.5.4. Upgrade increases the range bonus percentage.

> **Note:** A Ping Tower at level 5 must choose between **Boosted** or **Oracle** — they are mutually exclusive unlocks on the same tower instance.

---

## 7. Enemies

### General Enemy Rules
7.0.1. Enemies are displayed as **red dots** on the map.  
7.0.2. All enemies use **pathfinding** to find the shortest valid path to the Core.  
7.0.3. Enemies that reach the Core deal their **damage value** to Core Health.  
7.0.4. Enemies scale in strength with **wave multipliers** — the same enemy type is stronger in later waves.  
7.0.5. Each enemy type has specific **resistances, immunities, and vulnerabilities** that must be accounted for strategically.

**Status Effect Definitions:**  
7.0.6. **Slow** — Reduces an enemy's movement speed by a percentage for a duration. Does not stop movement entirely.  
7.0.7. **Stun** — Brings an enemy's movement speed to **0** (full stop) for a duration. The enemy cannot move or act while stunned. Stun and Slow are mutually exclusive — a stunned enemy cannot also be slowed.

---

### 7.1. Data Leech
| Stat | Level 1 Value |
|---|---|
| Damage | 5 |
| Health | 10 |
| Speed | 0.5 tiles/second |
| Stun Immune | Yes (immune to EMP Blast) |
| Slow Immune | Yes (already at minimum speed) |

7.1.1. Slow and weak — the most basic enemy type.  
7.1.2. Countered effectively by ICE Wall and Data Spike.  
7.1.3. **Cannot be stunned** by EMP Blast.  
7.1.4. **Cannot be slowed** — already moves at minimum speed; slow effects have no impact.

---

### 7.2. Code Runner
| Stat | Level 1 Value |
|---|---|
| Damage | 10 |
| Health | 5 |
| Speed | 1.0 tile/second |

7.2.1. Fast and fragile — dangerous in large numbers due to speed.  
7.2.2. Countered by ICE Wall (slow) and Data Spike.  
7.2.3. Can be stunned by EMP Blast.

---

### 7.3. Firewall Breacher
| Stat | Level 1 Value |
|---|---|
| Damage | 20 |
| Health | 50 |
| Speed | 0.5 tiles/second |
| Resistant To | ICE Wall, Firewall |
| Vulnerable To | Daemon Turret |

7.3.1. Slow and tanky — resistant to wall-type towers.  
7.3.2. Can be **stunned** (fully stopped) by EMP Blast.  
7.3.3. Requires Daemon Turret or similar active-fire towers to deal with effectively.

---

### 7.4. Glitch
| Stat | Level 1 Value |
|---|---|
| Damage | 20 |
| Health | 50 |
| Speed | 0.5 tiles/second |
| Special | Phases through ICE Wall and Firewall tiles |

7.4.1. Can **phase through** ICE Wall and Firewall towers — they do not block or slow it.  
7.4.2. Must be countered with active-fire towers (Data Spike, Daemon Turret).  
7.4.3. Can be stunned by EMP Blast.

---

### 7.5. Orchestrator
| Stat | Level 1 Value |
|---|---|
| Damage | 50 |
| Health | 200 |
| Speed | 0.5 tiles/second |
| Immune To | ICE Wall, Firewall |
| On Death | Spawns 1 Blackwall Gateway at its death location |

7.5.1. A **mini-boss** that must be prioritised — killing it spawns a Gateway (see §9).  
7.5.2. Immune to ICE Wall and Firewall damage.  
7.5.3. Countered by Data Spike and Daemon Turret.  
7.5.4. Can be stunned by EMP Blast.  
7.5.5. **High priority target** — the Gateway it spawns on death can permanently change the battlefield.

---

### 7.6. VDB Netrunner
| Stat | Level 1 Value |
|---|---|
| Damage | 30 |
| Health | 750 |
| Speed | 0.5 tiles/second |
| Special | Actively damages towers it passes near |

7.6.1. A **mini-boss** that deals damage to towers, not just the Core.  
7.6.2. Best countered by ICE Sniper (long-range, high single-target damage).  
7.6.3. Can be stunned by EMP Blast.  
7.6.4. Must be eliminated quickly to prevent tower attrition.

---

### 7.7. Saboteur
| Stat | Level 1 Value |
|---|---|
| Damage | 20 |
| Health | 500 |
| Speed | 0.5 tiles/second |
| Disable Radius | 2 tiles |
| Disable Duration | 5 seconds (level 1); increases with wave scaling |

7.7.1. **Disables all towers** within a 2-tile radius for 5 seconds when it activates its ability.  
7.7.2. Best countered by ICE Sniper.  
7.7.3. Can be stunned by EMP Blast.  
7.7.4. Extremely dangerous near clusters of towers — spread tower placement to mitigate.

---

### 7.8. AI Overlord *(Boss)*
| Stat | Level 1 Value |
|---|---|
| Damage | 50 |
| Health | 1000 |
| Speed | 0.5 tiles/second |
| Phases | 3 |

**Phase 1:**  
7.8.1. **Resistant to all damage types.**  
7.8.2. Spawns **Blackwall Gateways** on every tile it walks over.

**Phase 2:**  
7.8.3. Becomes **vulnerable to damage**.  
7.8.4. Spawns **Glitches** periodically to bypass tower lines.

**Phase 3:**  
7.8.5. Becomes **even more vulnerable** to damage.  
7.8.6. Spawns **Orchestrators** periodically.

7.8.7. Requires a combination of tower types and abilities to defeat.  
7.8.8. Appears every **10 waves starting from wave 50**.  
7.8.9. Defeating all AI Overlords is required for the **win condition** (see §10.1).

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
8.2.3. Break duration scales from **30 seconds at wave 10** down to **1 second at wave 40**, then stays at 1 second.  
8.2.4. The player may **skip the break** at any time to start the next wave early.

### 8.3. Skip Break Bonus
8.3.1. Skipping a break grants a **temporary Eddie generation boost** for the next **10 seconds**.  
8.3.2. This bonus should be used strategically to fund emergency builds or upgrades.

### 8.4. Enemy Scaling
8.4.1. All enemies receive a **wave multiplier** that increases their stats (HP, damage, speed) with each wave.  
8.4.2. The same enemy type in wave 50 is significantly stronger than in wave 1.

### 8.5. Blackwall Degradation Effect on Waves
8.5.1. As the Blackwall weakens, waves begin to include **more powerful enemy types**.  
8.5.2. Waves begin to include **Blackwall Gateway spawns** from interior map positions, placing enemies closer to the Core.

### 8.6. Boss Waves
8.6.1. An **AI Overlord** appears every **10 waves starting from wave 50** (waves 50, 60, 70, ...).  
8.6.2. Boss waves are **marked** on the wave counter UI in advance.  
8.6.3. Boss waves are significantly harder than regular waves and require full resource preparation.

### 8.7. Example Wave Compositions
| Wave | Enemies |
|---|---|
| 1 | 5 Data Leeches |
| 2 | 10 Data Leeches |
| 3 | 5 Data Leeches, 5 Code Runners |
| 4 | 10 Data Leeches, 10 Code Runners |
| 5 | 20 Data Leeches, 20 Code Runners, 1 Firewall Breacher |
| 6 | 5 Firewall Breachers |
| 7 | 50 Data Leeches |
| 8 | 20 Code Runners, 20 Firewall Breachers |
| 9 | 10 Code Runners, 10 Firewall Breachers, 1 Glitch |
| 10 | 1 Orchestrator |
| 15 | 5 Orchestrators, 5 Glitches |
| 50 | 500 Data Leeches, 100 Code Runners, 50 Firewall Breachers, 20 Glitches, 1 Saboteur, 5 VDB Netrunners, 1 AI Overlord |

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
   - **Blackwall boundary degradation** (see §2.5.1) — break points on the boundary edge become boundary Gateways, spawning enemies at the map perimeter.  
   - **Orchestrators** dying (see §7.5) — spawn a Gateway at their death location on an interior tile.  
   - **AI Overlords** walking across tiles in Phase 1 (see §7.8) — spawn Gateways on every 5 tiles they traverse.  
9.2.3. **Boundary Gateways** (from degradation) spawn enemies at the map edge — these are the sole means of enemy entry from the perimeter.  
9.2.4. **Interior Gateways** (from Orchestrators/AI Overlords) spawn enemies deep inside the map, bypassing the player's outer defences entirely.  
9.2.5. An **open Gateway** of either type spawns enemies continuously.  
9.2.6. A Gateway being **actively closed** by Blackwall Towers does **not spawn enemies**.  
9.2.7. If all assigned Blackwall Towers are destroyed, the Gateway **immediately reopens**.  
9.2.8. A **permanently closed** Gateway is removed from the map entirely and cannot reopen.

### 9.3. Closing Gateways (Summary)
| Configuration | Waves to Close |
|---|---|
| 1 Blackwall Tower | 8 waves |
| 4 Blackwall Towers | 2 waves |
| 4 Fully Upgraded Blackwall Towers | 1 wave |

---

## 10. Win & Lose Conditions

### 10.1. Win Condition
10.1.1. The player wins by **fully restoring the Blackwall**.  
10.1.2. The Blackwall is fully restored when **all Blackwall Gateways are permanently closed** AND **no Orchestrators or AI Overlords remain alive**.  
10.1.3. To sustain the win condition, the player must have sufficient **Eddie generation** to maintain Blackwall Towers.  
10.1.4. Optimal play achieves the win condition around **wave 60–80**.  
10.1.5. On winning, the game ends with a victory screen.

### 10.2. Lose Condition
10.2.1. The player loses when **Core Health reaches 0**.  
10.2.2. On losing, the player is presented with two options:  
   - **Restart** — begin a new game from wave 1.  
   - **Exit** — quit the game.
