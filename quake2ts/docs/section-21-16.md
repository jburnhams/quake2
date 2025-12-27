# Section 21-16: Debug Rendering & Visualization

**Phase:** 4 (Advanced Features)
**Priority:** MEDIUM
**Dependencies:** 21-6, 21-9, 21-10
**Estimated Effort:** 2 days

---

## Overview

Validate debug rendering modes including wireframe, bounding boxes, normals, and collision visualization.

**Renderer Components:**
- `packages/engine/src/render/debug.ts` (`DebugRenderer`)
- `packages/engine/src/render/collisionVis.ts` (`CollisionVisRenderer`)
- `packages/engine/src/render/debugMode.ts` (`DebugMode` enum)

---

## Visual Tests

### Wireframe Rendering (~3 tests)
1. BSP geometry wireframe
2. Model wireframe (MD2/MD3)
3. Wireframe + solid combination

### Bounding Volumes (~3 tests)
1. AABB (axis-aligned bounding boxes)
2. Model bounds
3. Frustum visualization

### Collision Vis (~2 tests)
1. Collision geometry overlay
2. Trace debugging

### Normals & Tangents (~2 tests)
1. Surface normal visualization
2. Vertex normals on models

---

## Deliverables
- `tests/webgl/visual/debug/wireframe.test.ts`
- `tests/webgl/visual/debug/collision-vis.test.ts`
- ~10 visual tests

---

**Next Section:** [21-17: PVS & Culling Validation](section-21-17.md)
