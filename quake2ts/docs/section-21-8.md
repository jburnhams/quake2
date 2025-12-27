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
1. 33% transparent surfaces (SURF_TRANS33)
2. 66% transparent surfaces (SURF_TRANS66)
3. Mixed transparency levels

### Blending & Sorting (~4 tests)
1. Back-to-front sorting validation
2. Overlapping transparent surfaces
3. Transparent over opaque geometry
4. Z-fighting prevention

### Edge Cases (~2 tests)
1. Fully transparent surfaces
2. Transparent + warp surfaces

---

## Deliverables
- `tests/webgl/visual/world/transparent-surfaces.test.ts`
- ~9 visual tests

---

**Next Section:** [21-9: MD2 Character Models](section-21-9.md)
