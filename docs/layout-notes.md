# Course Layout Analysis

## Blocking Obstacles Found

Using a script that computes perpendicular distance from each obstacle center to every straight-line segment between consecutive obstacles (including finish gate), the following blocking issues were found in the original layout:

| Segment | Blocker | Blocker Type | Distance | Hit Radius | Gap |
|---------|---------|-------------|----------|------------|-----|
| 3 → 4 | 10 | jump | 25.0 px | 35 px | -10.0 px |
| 4 → 5 | 6 | jump | 9.6 px | 35 px | -25.4 px |
| 6 → 7 | 4 | dogwalk | 13.7 px | 50 px | -36.3 px |
| 15 → 16 | 3 | aframe | 7.2 px | 40 px | -32.8 px |

A "block" means the perpendicular distance from the obstacle center to the line segment is **less than** the obstacle's hit radius, so the dog would clip through it when traveling directly.

## Adjusted Positions

| Obstacle | From | To | Rationale |
|----------|------|----|-----------|
| 3 | (600, 567) | (480, 430) | Clears 15→16 and 9→10 lines |
| 4 | (408, 279) | (300, 150) | Clears 6→7 line |
| 6 | (552, 225) | (680, 70) | Clears 4→5 line |
| 10 | (504, 468) | (620, 440) | Clears 3→4 line |

## Verification

After adjustment, zero blocking obstacles remain.
