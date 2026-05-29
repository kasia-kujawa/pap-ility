# Pap-ility Feature Specification

## Overview

This document specifies the next feature set for the **Papillon Agility Course** game. The goal is to add two major gameplay systems:

1. **Speed Modifiers** — environmental and NPC elements that slow the dog down
2. **Ghost System** — a personal-best replay that races alongside the player

Both systems keep the existing core loop intact: 16 numbered obstacles, timer from #1 to finish, +5s penalty for wrong order, and spacebar boost.

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

## 2. Ghost System

### 2.1 Motivation
The ideas doc requests a "semi-transparent ghost dog" that plays back the fastest run, creating a competitive chase-your-best loop similar to Trackmania.

### 2.2 Data Model

#### 2.2.1 Snapshot Format
During an active run (timer started at obstacle #1), record the dog state at **20 Hz** (every 50 ms):

```ts
interface GhostSnapshot {
  t: number;      // elapsed time in seconds since timer start
  x: number;      // dog body x
  y: number;      // dog body y
  angle: number;  // facing angle
  boosting: boolean;
}
```

#### 2.2.2 Run Record Format
```ts
interface GhostRun {
  version: 1;
  courseName: 'A1(1)';
  finishTime: number;       // raw time without penalty
  totalTime: number;        // finishTime + (faults * 5)
  faults: number;
  snapshots: GhostSnapshot[];
}
```

#### 2.2.3 localStorage Schema
Key: `papility_ghost_v1_A1(1)`
Value: JSON-serialized `GhostRun`.

On game load, attempt to read this key. If missing or `version` mismatch, ignore (no ghost shown).

### 2.3 Recording Lifecycle

1. **Start recording** — When `timerStarted` becomes true (dog clears obstacle #1), begin capturing snapshots into `this.currentRunSnapshots`.
2. **Continue recording** — Every frame, if `timerStarted && !finished`, push a snapshot with the current elapsed time.
3. **Stop recording** — On finish gate trigger.
4. **Evaluate & persist** —
   - If no stored ghost exists, save this run as the new ghost.
   - If a stored ghost exists, compare `totalTime` (time + penalty). If the new run is strictly better, overwrite.
   - If equal or worse, discard the new recording.

### 2.4 Replay Lifecycle

1. **Load** — In `GameScene.create()`, read `localStorage`. If a valid run exists, store it in `this.ghostRun`.
2. **Render** — Create a separate `Graphics` object (`ghostGfx`) drawn **under** the live dog but **over** the grass/path.
3. **Update** — Each frame while `timerStarted && !finished`, compute `ghostElapsed = this.elapsedTime`. Find the two bracketing snapshots and linearly interpolate position and angle. Set `ghostBoosting` from the nearest snapshot.
4. **Draw** — Call a modified `drawPapillon(g, x, y, angle, state)` that renders the same dog art but with:
   - Body filled at 40% opacity (`#ffffff` base tint)
   - Ears and details desaturated to a cool blue-grey
   - No shadow ellipse
   - A faint trailing glow (expanding, fading circles behind the ghost)

### 2.5 StartScreen Ghost Info

On the start screen, if a ghost exists, display:
- `Best: 23.45s` (or `Best: 28.45s (3 faults)` if faults exist)
- Small text: `"Beat the ghost!"`

### 2.6 Acceptance Criteria
- [ ] First run records and saves to localStorage after crossing the finish gate.
- [ ] Second run shows a semi-transparent ghost dog that follows the exact path of the first run, synced by elapsed time.
- [ ] Ghost does not affect physics, collisions, or obstacle completion.
- [ ] A faster run overwrites the stored ghost; a slower run does not.
- [ ] Reloading the page still loads the ghost from localStorage.
- [ ] Start screen displays the best time when a ghost is stored.

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
