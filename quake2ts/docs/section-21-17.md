# Section 21-17: PVS & Culling Validation

**Phase:** 5 (Integration)
**Priority:** LOW
**Dependencies:** 21-6
**Estimated Effort:** 2 days

---

## Overview

Validate Potentially Visible Set (PVS) culling, frustum culling, portal visibility, and area visibility systems.

**Renderer Components:**
- `packages/engine/src/render/bspTraversal.ts` (`gatherVisibleFaces`, `isClusterVisible`)
- `packages/engine/src/render/culling.ts` (`boxIntersectsFrustum`, `extractFrustumPlanes`)
- `packages/engine/src/render/renderer.ts` (portal state management)

---

## Visual Tests

### PVS Culling (~3 tests)
1. Visible surfaces from camera position
2. Surfaces culled by PVS
3. PVS debug visualization

### Frustum Culling (~3 tests)
1. Objects outside frustum culled
2. Partially visible objects rendered
3. Frustum planes visualization

### Portal Visibility (~2 tests)
1. Open portals allow visibility
2. Closed portals block visibility

---

## Deliverables
- `tests/webgl/visual/integration/pvs-culling.test.ts`
- ~8 visual tests

---

**Next Section:** [21-18: Render Modes & Overrides](section-21-18.md)
