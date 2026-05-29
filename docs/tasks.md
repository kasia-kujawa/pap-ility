# Pap-ility Task Breakdown

## How to Use This Document

- Each task has an **Owner**, **Effort** (S/M/L), and **Dependencies**.
- Tasks with the same `parallel_group` can be worked on simultaneously by different people.
- Tasks in `Group A` depend on nothing except the shared `drawPapillonAt` refactor (Task 0).
- The `drawPapillonAt` refactor must land first because both Ghost tasks need it.

---

## Shared Prerequisite

### Task 0 — Refactor `drawPapillon()` into `drawPapillonAt()`
- **Owner:** Ghost implementer (assignee of Tasks 4–6)
- **Effort:** S (~30 min)
- **Group:** — (must land before any Ghost work)
- **Dependencies:** None
- **Description:**
  Extract the ~200-line `drawPapillon()` method into a new `drawPapillonAt(g, x, y, angle, ds, options)` helper where `options = { isGhost: false, opacity: 1.0 }`. The existing `drawPapillon()` should become a one-liner: `drawPapillonAt(this.dogGfx, dogBody.x, dogBody.y, dogBody.angle, ds, { isGhost: false, opacity: 1 })`. This is a pure refactor — zero behavior change for the live dog.
- **Acceptance:**
  - [ ] Game still draws the dog identically.
  - [ ] No console errors.
  - [ ] `drawPapillonAt` accepts an `options` object.

---

## Parallel Group A — Speed Modifiers

*These three tasks are sequential within the group but can be developed in parallel with Group B once Task 0 is done.*

### Task 1 — Add Modifier Zone Data and Rendering
- **Owner:** Modifier implementer
- **Effort:** S (~45 min)
- **Group:** A
- **Dependencies:** None
- **Description:**
  1. Add `courseModifiers[]` array to `game.js` with at least 7 zones (3 mud, 2 wetGrass, 2 kids).
  2. Add `createModifierGraphics()` and `drawModifier()` to `GameScene`.
  3. Call `createModifierGraphics()` from `GameScene.create()` after `drawGrass()`.
  4. Draw kids as small stick figures using simple Graphics primitives.
- **Acceptance:**
  - [ ] Modifier zones are visible on the course.
  - [ ] Kids are visible near their zone centers.
  - [ ] Zones do not affect physics yet (that is Task 2).

### Task 2 — Implement Speed Multiplier Physics
- **Owner:** Modifier implementer
- **Effort:** M (~60 min)
- **Group:** A
- **Dependencies:** Task 1
- **Description:**
  1. Implement `pointInRotatedEllipse()` math helper.
  2. Implement `getSpeedMultiplier()` on `GameScene` that iterates `courseModifiers` and returns the minimum multiplier for all overlapping zones.
  3. Modify `updateDog()` to apply the multiplier: `effMaxSpeed = BASE_MAX_SPEED * multiplier * (boosting ? BOOST_MULTIPLIER : 1)`.
  4. Add modifier-label HUD text in `createHUD()` and toggle visibility in `update()`.
- **Acceptance:**
  - [ ] Dog slows inside each modifier type.
  - [ ] Boost still works inside modifiers (reduced base, but boost multiplier stacks).
  - [ ] HUD shows active modifier label while inside a zone.
  - [ ] Overlapping zones apply the most severe multiplier (min), not additive.

### Task 3 — Modifier Visual Polish
- **Owner:** Modifier implementer
- **Effort:** S (~30 min)
- **Group:** A
- **Dependencies:** Task 2
- **Description:**
  1. Add splash particles when entering a mud zone.
  2. Add a faint sheen effect to wet grass zones.
  3. Add a proximity halo around kids when the dog is inside their zone.
  4. Fine-tune zone positions so they feel fair (not blocking critical paths but punishing lazy lines).
- **Acceptance:**
  - [ ] Splash particles trigger on mud entry.
  - [ ] Wet grass has a visible sheen.
  - [ ] Kids zone shows a halo while active.
  - [ ] Visual effects do not tank frame rate.

---

## Parallel Group B — Ghost System

*These three tasks are sequential within the group but can be developed in parallel with Group A once Task 0 is done.*

### Task 4 — Implement GhostRecorder and Persistence
- **Owner:** Ghost implementer
- **Effort:** M (~60 min)
- **Group:** B
- **Dependencies:** Task 0
- **Description:**
  1. Add the `GhostRecorder` class to `game.js` (before `StartScene`).
  2. Add recording start logic in `completeOb()` when `ob.num === 1` (or a flag in `update()`).
  3. Add snapshot capture in `update()` at ~20 Hz while `timerStarted && !finished`.
  4. Add `evaluateGhostRun()` called at finish: compare `totalTime` against stored best, save if better.
  5. Implement `GhostRecorder.save()` and `GhostRecorder.load()` with the `papility_ghost_v1_A1(1)` key.
- **Acceptance:**
  - [ ] First run saves to localStorage after finish.
  - [ ] localStorage contains a JSON object with `version`, `finishTime`, `totalTime`, `faults`, and `snapshots`.
  - [ ] No save happens on runs with `totalTime` worse than stored.

### Task 5 — Implement Ghost Replay Rendering
- **Owner:** Ghost implementer
- **Effort:** M (~60 min)
- **Group:** B
- **Dependencies:** Task 4
- **Description:**
  1. In `GameScene.create()`, load the stored ghost and create `this.ghostGfx`.
  2. Implement `updateGhost()` with linear interpolation between snapshots by elapsed time.
  3. Implement `drawGhost()` using the refactored `drawPapillonAt()` with `isGhost: true, opacity: 0.4`.
  4. Add a trailing glow effect behind the ghost (expanding, fading circles).
  5. Ensure the ghost is hidden when the stored run is shorter than the current elapsed time.
- **Acceptance:**
  - [ ] Ghost appears on run 2+ after obstacle #1.
  - [ ] Ghost follows the exact stored path.
  - [ ] Ghost is semi-transparent and visually distinct from the live dog.
  - [ ] Ghost freezes or hides when it reaches the end of its recording.

### Task 6 — Start Screen Best-Time Display
- **Owner:** Ghost implementer
- **Effort:** S (~20 min)
- **Group:** B
- **Dependencies:** Task 4
- **Description:**
  1. In `StartScene.create()`, call `GhostRecorder.load()`.
  2. If a ghost exists, display best time text below the instruction text.
  3. Format: `"Best: 23.45s"` (no faults) or `"Best: 28.45s (3 faults)"` (with faults).
  4. Add `"Beat the ghost!"` subtext.
- **Acceptance:**
  - [ ] Start screen shows best time when a ghost is stored.
  - [ ] Time includes penalty display when faults > 0.
  - [ ] Text disappears if localStorage is cleared.

---

## Integration & Merge Order

```
Task 0 ──────────────────────────────────────────┐
                                                 │
    ┌────────────────────────────┐               │
    ↓                            ↓               │
 Task 1  →  Task 2  →  Task 3   │               │
 (Modifiers)                    │               │
    │                            │               │
    └────────┬───────────────────┘               │
             ↓                                   │
        Merge PR A                               │
             │                                   │
    ┌────────┴───────────────────┐               │
    ↓                            ↓               │
 Task 4  →  Task 5  →  Task 6   │               │
 (Ghost)                        │               │
    │                            │               │
    └────────┬───────────────────┘               │
             ↓                                   │
        Merge PR B                               │
             │                                   │
             ↓                                   │
        Manual test both features together ──────┘
```

**Suggested branches:**
- `main` — stable; docs + Task 0 merged here first.
- `feature/modifiers` — Tasks 1–3.
- `feature/ghost` — Tasks 4–6.

**Merge strategy:**
1. Open PR for `feature/modifiers` → `main`.
2. Open PR for `feature/ghost` → `main`.
3. Because the features touch disjoint code regions, both should auto-merge cleanly.
4. After both merge, open the game in a browser and verify:
   - Modifiers slow the dog.
   - Ghost replays.
   - Best time shows on start screen.
   - No console errors.

---

## Effort Summary

| Task | Effort | Owner | Group |
|------|--------|-------|-------|
| 0 | S | Ghost owner | Prerequisite |
| 1 | S | Modifier owner | A |
| 2 | M | Modifier owner | A |
| 3 | S | Modifier owner | A |
| 4 | M | Ghost owner | B |
| 5 | M | Ghost owner | B |
| 6 | S | Ghost owner | B |
| **Total** | **~5.5 hrs** | 2 people | Parallel |

With two developers working in parallel, estimated wall-clock time is **~2.5 hours** (Task 0 + longest sequential chain).
