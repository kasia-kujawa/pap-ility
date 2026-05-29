# Pap-ility Architecture Notes

## 1. Current Architecture

The game is a **single-file static Phaser 4 app**:

| File | Responsibility |
|------|---------------|
| `papility.html` | Bootstraps Phaser CDN + `game.js` |
| `game.js` | All game logic: scenes, physics, rendering, HUD |
| `style.css` | Minimal global reset (`body { overflow: hidden; background: #2d5a27; }`) |

There is no module system, no bundler, and no build step. Everything lives in the global scope of `game.js`. This is intentional — the game runs by simply opening `papility.html` in a browser.

### 1.1 Scene Breakdown

```
StartScene  →  GameScene
   │               │
   │               ├── create()
   │               │   ├── drawGrass()
   │               │   ├── drawCoursePath()
   │               │   ├── createFinishGateGraphics()
   │               │   ├── obstacleGraphics[]  (16 items)
   │               │   ├── dogBody (physics body)
   │               │   ├── dogGfx, pawGfx, particleGfx,
   │               │   │   distanceLineGfx, guideArrowGfx
   │               │   ├── createHUD()
   │               │   ├── createFinishScreen()
   │               │   └── keyboard input
   │               │
   │               └── update(time, delta)
   │                   ├── redrawObstacles()
   │                   ├── drawFinishGateOb()
   │                   ├── updateDog(delta)
   │                   ├── checkObstacle()
   │                   ├── checkFinishGate()
   │                   ├── drawPapillon()
   │                   ├── drawPawPrints()
   │                   ├── drawParticles()
   │                   ├── drawDistanceLine()
   │                   ├── drawGuideArrow()
   │                   └── updateBoostBar()
```

### 1.2 Key State Objects

| Variable | Scope | Purpose |
|----------|-------|---------|
| `courseObs[]` | Global | 16 obstacles with `num, type, cx, cy, angle` |
| `finishGate` | Global | `{ cx, cy, angle }` for the finish line |
| `coursePath[]` | Global | Array of `{x,y}` derived from `courseObs` + `finishGate` |
| `OBS_TYPES` | Global | Maps obstacle type to label and color |
| `CW`, `CH` | Global | Canvas width (1200) and height (900) |
| `RES` | Global | Camera zoom multiplier (3x) |
| `BASE_MAX_SPEED`, `BASE_ACCEL` | Global | Physics constants |
| `BOOST_*` | Global | Boost duration, cooldown, multiplier constants |

---

## 2. Speed Modifiers — Integration Points

### 2.1 New Global Data

Add alongside `courseObs`:

```js
const courseModifiers = [
  { type: 'mud',    cx: 950, cy: 780, rx: 60, ry: 30, angle: 0.3 },
  { type: 'wetGrass', cx: 550, cy: 400, rx: 80, ry: 40, angle: -0.1 },
  { type: 'kids',   cx: 400, cy: 650, rx: 40, ry: 40, angle: 0 },
];
```

### 2.2 New Methods on GameScene

```js
// Called from create()
createModifierGraphics() {
  // Create Graphics objects for each modifier zone
  // Store in this.modifierGraphics[]
}

drawModifier(g, mod) {
  // Draw ellipse with fill color based on type:
  // mud = #5a3a1a, wetGrass = #3a7a2a, kids = invisible (draw kids separately)
}

drawKids(g, mod) {
  // Draw small stick-figure kids at the edge of the zone
}

// Called from updateDog() — this is the critical physics hook
getSpeedMultiplier() {
  // For each modifier, test if dogBody is inside the rotated ellipse
  // Return min multiplier across all overlapping zones
  // Returns 1.0 if no overlap
}

// Called from update() for HUD feedback
updateModifierHUD() {
  // Show/hide modifier label text, set color
}
```

### 2.3 Touch Points in Existing Code

| Existing Method | Change |
|-----------------|--------|
| `GameScene.create()` | Add `createModifierGraphics()` call after `drawGrass()` |
| `GameScene.updateDog(delta)` | Replace `effMaxSpeed = ds.boosting ? ... : BASE_MAX_SPEED` with `effMaxSpeed = BASE_MAX_SPEED * getSpeedMultiplier() * (ds.boosting ? BOOST_MULTIPLIER : 1)` |
| `GameScene.update()` | Add `updateModifierHUD()` call |
| `GameScene.createHUD()` | Add modifier label text object (hidden by default) |

### 2.4 Collision Math

Ellipse point test in rotated frame:

```js
function pointInRotatedEllipse(px, py, cx, cy, rx, ry, angle) {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const dx = px - cx;
  const dy = py - cy;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return (localX / rx) ** 2 + (localY / ry) ** 2 <= 1;
}
```

This is pure math — no Phaser physics bodies needed. Avoids adding 10+ physics bodies and keeps performance trivial.

### 2.5 Visual Layer Order

```
Background (grass)
  ├── Course path (white faint line)
  ├── Modifier zones (mud, wet grass fills)
  ├── Obstacles
  ├── Kids figures
  ├── Finish gate
  ├── Paw prints
  ├── Ghost dog (if implemented)
  ├── Live dog
  ├── Particles
  ├── HUD (top layer)
```

---

## 3. Ghost System — Integration Points

### 3.1 New Class/Module

Because there is no module system, add a class definition in `game.js` before `StartScene`:

```js
class GhostRecorder {
  constructor() { this.snapshots = []; this.recording = false; }
  start() { this.snapshots = []; this.recording = true; this.startTime = performance.now(); }
  record(state) { /* push snapshot */ }
  stop() { this.recording = false; return this.snapshots; }
  static save(run) { localStorage.setItem('papility_ghost_v1_A1(1)', JSON.stringify(run)); }
  static load() { /* read + validate version */ }
}
```

### 3.2 Ghost State on GameScene

```js
// In create()
this.ghostRun = GhostRecorder.load(); // null if none stored
this.ghostGfx = this.add.graphics();
this.ghostState = { x: 0, y: 0, angle: 0, boosting: false, visible: false };

// If ghost exists, draw the ghost papillon in update()
if (this.ghostRun && this.timerStarted && !this.finished) {
  this.updateGhost();
  this.drawGhost();
}
```

### 3.3 Recording Lifecycle

| Trigger | Action | Location in Code |
|---------|--------|------------------|
| `timerStarted` first becomes true | Call `this.ghostRecorder.start()` | Inside `completeOb()` when `ob.num === 1` or in `update()` guarded by a one-shot flag |
| Every frame while running | Call `this.ghostRecorder.record({t, x, y, angle, boosting})` | Inside `update()` after `updateDog()` |
| `finished` becomes true | Call `this.evaluateGhostRun()` | Inside `checkFinishGate()` or at the end of `update()` |

### 3.4 Evaluation Logic

```js
evaluateGhostRun() {
  const newRun = {
    version: 1,
    courseName: 'A1(1)',
    finishTime: this.finishTime,
    totalTime: this.finishTime + this.faultsCount * 5,
    faults: this.faultsCount,
    snapshots: this.ghostRecorder.snapshots
  };
  const stored = GhostRecorder.load();
  if (!stored || newRun.totalTime < stored.totalTime) {
    GhostRecorder.save(newRun);
  }
}
```

### 3.5 Ghost Replay — Interpolation

```js
updateGhost() {
  const t = this.elapsedTime;
  const snaps = this.ghostRun.snapshots;
  // Find bracketing snapshots
  let i = 0;
  while (i < snaps.length - 1 && snaps[i + 1].t < t) i++;
  if (i >= snaps.length - 1) {
    // Ghost is done — freeze at last position or hide
    this.ghostState.visible = false;
    return;
  }
  const a = snaps[i], b = snaps[i + 1];
  const p = (t - a.t) / (b.t - a.t);
  this.ghostState.x = a.x + (b.x - a.x) * p;
  this.ghostState.y = a.y + (b.y - a.y) * p;
  this.ghostState.angle = a.angle + (b.angle - a.angle) * p;
  this.ghostState.boosting = a.boosting || b.boosting;
  this.ghostState.visible = true;
}
```

### 3.6 Ghost Drawing

Reuse `drawPapillon()` by extracting the dog-drawing logic into a helper:

```js
drawPapillonAt(g, x, y, angle, boosting, options = {}) {
  // options: { isGhost: false, opacity: 1.0 }
  // ... all existing dog drawing code, but:
  //   - if isGhost: replace fill colors with desaturated blue-grey tints
  //   - if isGhost: skip shadow ellipse
  //   - if isGhost: add trailing glow circles
  //   - apply opacity to all fillStyle calls
}
```

Then:
- `drawPapillon()` calls `drawPapillonAt(this.dogGfx, dogBody.x, dogBody.y, ..., { isGhost: false, opacity: 1 })`
- `drawGhost()` calls `drawPapillonAt(this.ghostGfx, ghostState.x, ghostState.y, ..., { isGhost: true, opacity: 0.4 })`

**Refactoring note:** `drawPapillon()` is ~200 lines. Extracting `drawPapillonAt()` is a pure mechanical refactor with zero behavior change for the live dog. The teammate working on ghosts should do this refactor first.

### 3.7 StartScreen Ghost Display

Add to `StartScene.create()`:

```js
const stored = GhostRecorder.load();
if (stored) {
  const pen = stored.faults * 5;
  const text = stored.faults === 0
    ? `Best: ${stored.finishTime.toFixed(2)}s`
    : `Best: ${stored.totalTime.toFixed(2)}s (${stored.faults} faults)`;
  this.add.text(CW / 2, 390, text, {
    fontSize: '18px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#ffcc00'
  }).setOrigin(0.5);
  this.add.text(CW / 2, 415, 'Beat the ghost!', {
    fontSize: '14px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#aaddff'
  }).setOrigin(0.5);
}
```

---

## 4. Parallel Work Boundaries

These two features touch **disjoint regions** of `game.js` once a small shared refactor is done.

### 4.1 Shared Prerequisite

**Refactor `drawPapillon()` → `drawPapillonAt()`** (required by Ghost, harmless to Modifiers).

- **Owner:** Ghost implementer.
- **Impact:** Zero behavior change. All existing `drawPapillon()` calls remain identical.

### 4.2 Modifier Owner — Safe Touch Points

| Code Area | Change Type |
|-----------|-------------|
| `courseModifiers[]` (new global) | Add |
| `GameScene.createModifierGraphics()` | Add |
| `GameScene.drawModifier()` | Add |
| `GameScene.drawKids()` | Add |
| `GameScene.getSpeedMultiplier()` | Add |
| `GameScene.updateModifierHUD()` | Add |
| `GameScene.create()` | Append call |
| `GameScene.updateDog()` | Modify speed formula |
| `GameScene.update()` | Append call |
| `GameScene.createHUD()` | Add text object |

### 4.3 Ghost Owner — Safe Touch Points

| Code Area | Change Type |
|-----------|-------------|
| `GhostRecorder` class | Add |
| `GhostRun` / `GhostSnapshot` types | Add (comments only) |
| `drawPapillonAt()` | Refactor from existing |
| `GameScene.ghostRun`, `ghostGfx`, `ghostState` | Add properties |
| `GameScene.create()` | Add ghost setup + StartScene load |
| `GameScene.update()` | Add ghost update + draw calls |
| `GameScene.completeOb()` | Start recorder at ob #1 |
| `GameScene.checkFinishGate()` | Evaluate and save ghost |
| `StartScene.create()` | Display best time |

### 4.4 Merge Safety

Because:
- Modifiers add new arrays and methods that do not rename existing ones.
- Ghost adds a new class and new `this.*` properties that do not collide with modifier properties.
- Both append calls to `create()` and `update()` at well-separated locations.

The features are **mechanically mergeable** without conflicts even if both developers edit the same `game.js` file. Git may produce an automatic merge for the `create()` and `update()` methods. If not, the conflict resolution is trivial (accept both appended blocks).

---

## 5. localStorage Schema

### 5.1 Key

```
papility_ghost_v1_A1(1)
```

Format: `papility_ghost_v{COURSE_VERSION}_{COURSE_NAME}`

- `v1` — schema version for backward compatibility
- `A1(1)` — course identifier (matches the start-screen label)

### 5.2 Value (JSON)

```json
{
  "version": 1,
  "courseName": "A1(1)",
  "finishTime": 23.45,
  "totalTime": 23.45,
  "faults": 0,
  "snapshots": [
    { "t": 0.000, "x": 1150.0, "y": 840.0, "angle": 3.142, "boosting": false },
    { "t": 0.050, "x": 1148.2, "y": 839.1, "angle": 3.120, "boosting": false },
    ...
  ]
}
```

### 5.3 Migration Strategy

If we later change the schema to `v2`:

```js
static load() {
  const raw = localStorage.getItem('papility_ghost_v2_A1(1)');
  if (raw) return JSON.parse(raw);
  const legacy = localStorage.getItem('papility_ghost_v1_A1(1)');
  if (legacy) {
    const run = JSON.parse(legacy);
    // migrate to v2 if needed
    return run;
  }
  return null;
}
```

---

## 6. Performance Notes

- **Modifiers:** 5–10 ellipse point tests per frame. Negligible cost.
- **Ghost snapshots:** At 20 Hz, a 30-second run produces 600 snapshots. JSON string is ~30 KB. `localStorage` limit is ~5 MB — comfortable.
- **Ghost replay:** One interpolation + one Graphics draw per frame. No physics. Negligible cost.

---

## 7. Testing Without a Browser

Since there is no test framework, manual verification is the only approach:

1. Open `papility.html` in a browser.
2. **Modifiers:** Run through each zone and watch the dog slow. Use the guide arrow to see if it takes longer to reach the next obstacle.
3. **Ghost:**
   - Run the course once. Finish.
   - Run again. Verify a ghost dog appears at the start after obstacle #1.
   - Verify the ghost follows the same path.
   - Run slower. Verify the ghost finishes before you.
   - Run faster. Verify a new ghost is recorded (check `localStorage` contents).
   - Reload the page. Verify the ghost still replays.

To inspect `localStorage`:
- Open DevTools → Application → Local Storage → file://...
- Key `papility_ghost_v1_A1(1)` should contain JSON with `snapshots` array.
