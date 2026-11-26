# Section 21-8: Transparent Surfaces & Blending

**Phase:** 3 (Core 3D)
**Priority:** HIGH
**Dependencies:** 21-6
**Estimated Effort:** 2 days

---

## Overview

Validate transparent surface rendering using SURF_TRANS33 and SURF_TRANS66 flags, including alpha blending, depth sorting, and render order.

**Renderer Components:**
- `packages/engine/src/render/bspPipeline.ts` (transparent surface handling)
- `packages/engine/src/render/frame.ts` (`sortVisibleFacesBackToFront`)
- `@quake2ts/shared` (SURF_TRANS33, SURF_TRANS66 constants)

---

## Visual Tests

### Transparency Levels (~3 tests)
- [x] 33% transparent surfaces (SURF_TRANS33)
- [x] 66% transparent surfaces (SURF_TRANS66)
- [x] Mixed transparency levels

### Blending & Sorting (~4 tests)
- [x] Back-to-front sorting validation
- [x] Overlapping transparent surfaces
- [x] Transparent over opaque geometry
- [x] Z-fighting prevention

### Edge Cases (~2 tests)
- [x] Fully transparent surfaces
- [x] Transparent + warp surfaces

---

## Deliverables
- `tests/webgl/visual/world/transparent-surfaces.test.ts`
- ~9 visual tests

---

**Next Section:** [21-9: MD2 Character Models](section-21-9.md)
