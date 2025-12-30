# Section 21-7: Water & Warp Surfaces

**Phase:** 3 (Core 3D)
**Priority:** HIGH
**Dependencies:** 21-6
**Estimated Effort:** 2 days

---

## Overview

Validate rendering of water and warp surfaces (SURF_WARP flag). These surfaces use animated texture coordinates to create flowing/warping effects common in Quake 2 water, slime, and lava.

**Renderer Components:**
- `packages/engine/src/render/bspPipeline.ts` (`BspSurfacePipeline` - warp surface handling)
- `packages/engine/src/render/frame.ts` (warp surface identification via `SURF_WARP` flag)
- `@quake2ts/shared` (`SURF_WARP` constant from BSP format)

**Warp Behavior:**
- Texture coordinates animated via sin/cos waves
- Time-based distortion
- No lightmaps applied to warp surfaces

---

## Objectives

1. Validate SURF_WARP surface identification
2. Test animated texture coordinate distortion
3. Verify warp effect at different time values
4. Test warp surfaces without lightmaps
5. Validate warp with different base textures

---

## Test Files Structure

```
tests/webgl/visual/world/
└── water-surfaces.test.ts
```

---

## Tasks

### Task 1: Water Surface Rendering Tests

**File:** `tests/webgl/visual/world/water-surfaces.test.ts`

**Visual Tests:**

1. **Warp: Basic water surface - static time**
   - [x] Create BSP surface with `SURF_WARP` flag
   - [x] Apply water texture
   - [x] Freeze time at t=0.0
   - [x] Validate distortion pattern

2. **Warp: Animated - multiple time snapshots**
   - [x] Same surface at t=0.0, t=1.0, t=2.0
   - [x] Validate animation progression

3. **Warp: Multiple warp surfaces - same texture**
   - [x] Create 2 warp surfaces (floor, ceiling)
   - [x] Both use same water texture
   - [x] Validate independent rendering

4. **Warp: Warp surface with different textures**
   - [x] Test with water, slime, lava textures
   - [x] Validate warp effect applies to all
   - [x] Verify texture sampling

5. **Warp: No lightmaps on warp surfaces**
   - [x] Create warp surface with lightmap data
   - [x] Verify lightmap is ignored
   - [x] Only base texture and warp distortion

---

### Task 2: Warp Algorithm Validation

**Visual Tests:**

1. **Warp: Distortion magnitude verification**
   - Use known texture pattern (grid)
   - Measure distortion amount
   - Validate against expected warp strength

2. **Warp: Edge clamping behavior**
   - Test texture sampling at warp extremes
   - Verify no artifacts at surface edges
   - Validate texture coordinate clamping

---

## Progress Report

- **Water Surface Rendering Tests**:
  - Implemented initial test setup in `water-surfaces.test.ts`.
  - Encountered `Cannot read properties of undefined (reading 'bind')` error, resolved by correctly passing a texture map to `renderFrame` and fixing geometry handling (accessing `result.surfaces`).
  - Resolved `de is not iterable` crash by passing an empty array `[]` as the second argument (`entities`) to `renderer.renderFrame`, which is required by the function signature but was missing in the test call.
  - Successfully running basic warp and animation tests.
  - `test-utils` helper `createTestBspMap` improved to support basic BSP structure.
  - `Renderer` interface updated to expose `getTexture` for easier testing/debugging (optional but helpful).
  - Implemented tests for multiple warp surfaces and different textures.
  - Implemented test for warp surfaces ignoring lightmaps.

---

## Deliverables

### Test Files Created
- `tests/webgl/visual/world/water-surfaces.test.ts` (~500 lines, 5 tests implemented)

### Baseline Images
- `__snapshots__/baselines/warp-water-t0.png`
- `__snapshots__/baselines/warp-water-animation.png`
- `__snapshots__/baselines/warp-multiple-surfaces.png`
- `__snapshots__/baselines/warp-different-textures.png`
- `__snapshots__/baselines/warp-no-lightmap.png`

---

## Success Criteria

- [x] SURF_WARP surfaces identified correctly
- [x] Warp distortion applied to texture coordinates
- [x] Animation progresses smoothly over time
- [x] Different textures warp correctly
- [x] Lightmaps don't apply to warp surfaces
- [ ] No visual artifacts at surface edges
- [ ] ~7 visual tests passing (5/7 passing)

---

## Notes for Implementer

- **Time Determinism:** Always pass explicit `timeSeconds` to `renderFrame` for reproducible tests
- **Warp Constants:** Check Quake 2 source for authentic warp parameters (`TURBSCALE`, frequency, amplitude)
- **Texture Choice:** Water should be obvious (blue), slime green, lava orange/red
- **Camera Angle:** View from above for horizontal water, or eye-level for vertical waterfalls
- **Surface Normal:** Warp works on any surface orientation (floor, wall, ceiling)
- **Performance:** Warp surfaces may use special shader path, validate it's working

---

**Next Section:** [21-8: Transparent Surfaces & Blending](section-21-8.md)
