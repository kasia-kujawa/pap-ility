# Pap-ility Feature Specification

## Overview

This document specifies the next feature set for the **Papillon Agility Course** game. The goal is to add two major gameplay systems:

1. **Speed Modifiers** — environmental and NPC elements that slow the dog down
2. **Ghost System** — a personal-best replay that races alongside the player

Both systems keep the existing core loop intact: 16 numbered obstacles, timer from #1 to finish, +5s penalty for wrong order, and spacebar boost.

---

## Course Layout (v2)

### Blocking Analysis
The initial course layout had four obstacles whose hit radii overlapped the direct path between consecutive obstacles, forcing the dog to clip through them:

| Segment | Blocker | Distance | Hit Radius | Gap |
|---------|---------|----------|------------|-----|
| 3 → 4 | Obstacle 10 (jump) | 25.0 px | 35 px | −10.0 px |
| 4 → 5 | Obstacle 6 (jump) | 9.6 px | 35 px | −25.4 px |
| 6 → 7 | Obstacle 4 (dogwalk) | 13.7 px | 50 px | −36.3 px |
| 15 → 16 | Obstacle 3 (aframe) | 7.2 px | 40 px | −32.8 px |

### Adjusted Positions

| Obstacle | Type | Old Position | New Position | Rationale |
|----------|------|--------------|--------------|-----------|
| 3 | aframe | (600, 567) | (480, 430) | Clears 15→16 and 9→10 lines |
| 4 | dogwalk | (408, 279) | (300, 150) | Clears 6→7 line; keeps 3→4→5 triangular flow |
| 6 | jump | (552, 225) | (680, 70) | Clears 4→5 line; moved further from direct route |
| 10 | jump | (504, 468) | (620, 440) | Clears 3→4 line; shifted right and down |

All other obstacles remain at their original positions. After adjustment, a geometric check confirms **zero blocking obstacles** remain.

---

## 1. Speed Modifiers

### 1.1 Motivation
The ideas doc calls for three slowdown sources:
- **Mud** — patches on the track that slow the dog
- **Wet grass** — areas with reduced traction
- **Kids on the sides** — proximity to children causes the dog to run slower

These add skill expression: the player must navigate the optimal line to avoid slowdown while still hitting obstacles in order.

### 1.2 Course Data Model

Modifiers are defined as static geometry, similar to obstacles. Add a new top-level array:

```js
const courseModifiers = [
  { type: 'mud',    cx: 950, cy: 780, rx: 60, ry: 30, angle: 0.3  },
  { type: 'wetGrass', cx: 550, cy: 400, rx: 80, ry: 40, angle: -0.1 },
  { type: 'kids',   cx: 400, cy: 650, rx: 40, ry: 40, angle: 0    },
  // ... more as designed
];
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `'mud'`, `'wetGrass'`, or `'kids'` |
| `cx`, `cy` | number | Center position in course pixels |
| `rx`, `ry` | number | Ellipse half-axes |
| `angle` | number | Rotation in radians |

### 1.3 Modifier Effects

All modifiers apply a **multiplicative speed multiplier** to `effMaxSpeed` and `effAccel` inside `updateDog()`.

| Modifier | Speed Multiplier | Accel Multiplier | Notes |
|----------|------------------|------------------|-------|
| `mud` | 0.45 | 0.40 | Strongest slowdown; splash particles on entry |
| `wetGrass` | 0.65 | 0.60 | Moderate slowdown; ground tint change |
| `kids` | 0.75 | 0.80 | Mild slowdown; visible kid stick figures on sides |

**Stacking rule:** If the dog overlaps multiple zones, apply the **minimum** multiplier (most severe). The boost multiplier then stacks on top: `finalSpeed = baseSpeed * min(modifierMultipliers) * (boosting ? BOOST_MULTIPLIER : 1)`.

**Value source:** Zone overlap is computed by transforming the dog position into the zone's local ellipse frame and using the standard ellipse interior test: `(dx/rx)² + (dy/ry)² ≤ 1`.

### 1.4 Visual Design

Each modifier needs distinct visuals so the player can read the course:

- **Mud patches** — dark brown ellipse with irregular edges drawn on the grass layer. A "splash" particle burst spawns when the dog first enters each frame.
- **Wet grass** — slightly darker/desaturated green ellipse with a subtle sheen (white horizontal streaks).
- **Kids** — small stick-figure sprites placed on the track edge. Use simple `graphics` ellipses/circles for head and body, colored in bright clothing colors. A small "proximity halo" ellipse shows the active slowdown radius when the dog is inside.

### 1.5 HUD Feedback

Add a small text indicator near the timer (or reuse the boost bar area) that shows the active modifier:
- Text: `"MUD"`, `"WET GRASS"`, or `"KIDS"`
- Color: `#8B4513` for mud, `#4a7c59` for wet grass, `#ff69b4` for kids
- Only visible while inside a zone; fades out 0.3s after leaving.

### 1.6 Acceptance Criteria
- [ ] At least 3 mud patches, 2 wet grass zones, and 2 kid groups are placed on the course.
- [ ] Dog speed visibly drops inside each zone type compared to clean grass.
- [ ] Splash particles spawn on entering mud.
- [ ] HUD shows the active modifier label while inside a zone.
- [ ] Boosting inside a modifier still gives a speed burst, but the base is reduced.

---

## 2. Optimal-Path Ghost System

### 2.1 Motivation
The ideas doc requests a ghost dog that plays back the **optimal fastest route** between obstacles, considering modifier slowdowns. This replaces the previous personal-best replay with a deterministic, pre-computed optimal path.

### 2.2 Grid-Based Pathfinding

#### 2.2.1 Course Grid
The course area (1200×900) is discretized into a **40×30 grid** (30×30 px cells). Each cell stores:
- `speedMul` — minimum speed multiplier from overlapping modifiers (1.0 default)
- `blocked` — true if the cell center lies inside any obstacle hit radius
- `cx`, `cy` — world-space center of the cell

#### 2.2.2 A* Pathfinding
- 8-connected neighbors (cardinal + diagonal)
- Edge cost = `distance / speedMul`
- Heuristic = Euclidean distance to goal
- Blocked cells are skipped entirely
- Falls back to a straight line if no route is found

#### 2.2.3 Segment Pre-Computation
For every consecutive obstacle pair (including start position → obstacle #1 and obstacle #16 → finish gate), `findPath()` computes the fastest route on the grid. The resulting segments are stored in `this.optimalPaths`.

### 2.3 Ghost Timing

`buildTimedGhostPath()` concatenates all optimal path segments and assigns a cumulative travel-time `t` to each waypoint:

```
time += distance_between_waypoints / (BASE_MAX_SPEED * midpoint_speedMul)
```

The ghost waypoints have the structure `{ t, x, y }`.

### 2.4 Ghost Replay

`updateGhost()` interpolates the ghost along the timed waypoint list (`this.ghostPath`) using the same linear interpolation as the old snapshot-based ghost. The ghost angle is derived from the direction vector between consecutive waypoints.

### 2.5 Removed Features

The following features from the previous personal-best ghost were removed:

| Feature | Replacement |
|---------|-------------|
| `GhostRecorder` class | Grid-based A* pathfinder |
| `localStorage` save/load | Nothing (path is computed at runtime) |
| Personal-best comparison | Deterministic optimal route |
| Snapshot-based replay | Waypoint-based interpolation |

### 2.6 Acceptance Criteria
- [ ] Ghost follows the pre-computed optimal path on every run.
- [ ] Ghost accounts for modifier slowdowns in its route timing.
- [ ] Ghost replays consistently (same path every time for the same course layout).
- [ ] Ghost does not affect physics, collisions, or obstacle completion.
- [ ] No localStorage access for ghost data.

---

## 3. Out of Scope (for this Feature Set)

- Multiplayer ghosts or server-side leaderboards
- Procedural modifier placement
- Audio/SFX
- Additional dog breeds or character skins
- Mobile touch controls (keyboard only for now)

---

## 4. File Checklist

| File | Purpose |
|------|---------|
| `game.js` | All implementation: modifiers, ghost recording, ghost replay, drawing |
| `papility.html` | No changes expected (still loads `game.js` + Phaser CDN) |
| `style.css` | No changes expected |
| `docs/spec.md` | This document |
| `docs/architecture.md` | Code boundaries and module map |
| `docs/tasks.md` | Assignable task list for parallel work |
