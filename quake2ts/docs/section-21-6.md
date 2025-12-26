# Section 21-6: BSP World Geometry & Lightmaps

**Phase:** 3 (Core 3D)
**Priority:** HIGH
**Dependencies:** 21-1, 21-4
**Estimated Effort:** 4-5 days

---

## Overview

Validate BSP world geometry rendering including surface batching, lightmap application, multi-style lightmap blending, texture coordinate generation, and sorting. This is the foundation for most other world-based tests.

**Renderer Components:**
- `packages/engine/src/render/bspPipeline.ts` (`BspSurfacePipeline` class)
- `packages/engine/src/render/bsp.ts` (BSP geometry processing)
- `packages/engine/src/render/bsp/geometry.ts` (`BspSurfaceGeometry`)
- `packages/engine/src/render/bsp/renderer.ts` (BSP rendering logic)
- `packages/engine/src/render/frame.ts` (`createFrameRenderer` - BSP rendering orchestration)
- `packages/engine/src/render/materials.ts` (`MaterialManager`)

---

## Objectives

1. Validate basic BSP surface rendering
2. Test lightmap application and blending
3. Verify multi-style lightmap accumulation
4. Test texture coordinate generation
5. Validate surface batching and sorting
6. Test PVS-based visibility culling results
7. Verify face culling and depth testing

---

## Test Files Structure

```
tests/webgl/visual/world/
├── bsp-geometry.test.ts      # Basic geometry, textures
├── lightmaps.test.ts         # Lightmap application
└── bsp-batching.test.ts      # Batching, sorting, performance
```

---

## Tasks

### Task 1: Basic BSP Geometry Tests

**File:** `tests/webgl/visual/world/bsp-geometry.test.ts`

**Visual Tests:**

1. **BSP: Single textured quad**
   - Create minimal BSP surface (single quad)
   - Apply base texture
   - Validate texture mapping, UVs

2. **BSP: Multiple surfaces - different textures**
   - Create 3 surfaces with different base textures
   - Validate texture switching
   - Verify batching separates by texture

3. **BSP: Textured cube - 6 faces**
   - Create simple cube BSP geometry
   - Different texture per face
   - Validate face culling, depth testing

4. **BSP: Surface with scrolling texture coordinates**
   - Create surface with animated UVs
   - Freeze animation at specific time
   - Validate texture coordinate offset

**Implementation Pattern:**

```typescript
import { test } from 'vitest';
import { createRenderer } from '../../../src/render/renderer';
import { createWebGLRenderTestSetup, expectSnapshot } from '@quake2ts/test-utils';
import { createTestBspGeometry, createTestBspMap } from '@quake2ts/test-utils';
import { Camera } from '../../../src/render/camera';
import { mat4 } from 'gl-matrix';
import path from 'path';

const snapshotDir = path.join(__dirname, '..', '__snapshots__');

test('bsp: single textured quad', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  // Create test BSP geometry (helper creates minimal valid BSP data)
  const bspMap = createTestBspMap({
    surfaces: [
      {
        vertices: [/* quad vertices */],
        texInfo: { textureName: 'test-brick', /* ... */ }
      }
    ]
  });

  const geometry = renderer.uploadBspGeometry(bspMap);

  // Setup camera to view the quad
  const camera = new Camera(mat4.create());
  camera.setPosition([0, 0, 5]);
  camera.lookAt([0, 0, 0]);
  camera.setPerspective(90, 1.0, 0.1, 100);

  // Render frame
  renderer.renderFrame({
    camera,
    world: {
      map: bspMap,
      surfaces: [geometry],
      textures: renderer.getTextures()
    },
    clearColor: [0, 0, 0, 1]
  });

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: 'bsp-single-quad',
    description: 'Single textured quad from BSP geometry',
    width: 256,
    height: 256,
    snapshotDir
  });

  setup.cleanup();
});
```

**Subtasks:**
1. Create `createTestBspGeometry` helper in test-utils
2. Implement minimal BSP data generation
3. Setup camera for good viewing angle
4. Render and capture
5. Implement each visual test

**Assets Needed:**
- Simple test textures (brick, metal, etc.)
- Can use procedural textures or load from pak.pak
- Minimal BSP geometry (no full maps needed)

---

### Task 2: Lightmap Application Tests

**File:** `tests/webgl/visual/world/lightmaps.test.ts`

**Visual Tests:**

1. **Lightmap: Single surface with static lightmap**
   - Create surface with baked lightmap
   - Render with lightmap applied
   - Validate multiplicative blending

2. **Lightmap: Surface with base texture + lightmap**
   - Render surface with both base texture and lightmap
   - Validate multi-texturing
   - Check blend mode (multiply)

3. **Lightmap: Multiple surfaces sharing lightmap atlas**
   - Create 3 surfaces using same lightmap atlas
   - Different regions of atlas
   - Validate atlas UV coordinate generation

4. **Lightmap: Light styles - multiple lightmaps blended**
   - Create surface with 4 lightmap styles
   - Set different intensities for each style
   - Validate additive accumulation

5. **Lightmap: Fullbright mode (lightmaps disabled)**
   - Render with `fullbright: true` option
   - Verify lightmaps are ignored
   - Base texture only

**Implementation Notes:**
- Use `BspSurfaceGeometry` with `lightmapAtlas` data
- Test `applySurfaceState` from `bspPipeline.ts`
- Validate light style array indices [0-3]
- Check lightmap coordinate generation

**Subtasks:**
1. Create lightmap test data generator
2. Implement static lightmap test
3. Implement multi-style blending test
4. Test fullbright override
5. Validate blend equations

**Assets Needed:**
- Simple lightmap textures (grayscale, colored lighting)
- Can generate procedurally (gradient, spots, etc.)

---

### Task 3: Batching and Sorting Tests

**File:** `tests/webgl/visual/world/bsp-batching.test.ts`

**Visual Tests:**

1. **Batching: Multiple surfaces - same texture**
   - Create 10 surfaces with same texture
   - Verify single draw call (batching)
   - Validate visual correctness

2. **Batching: Multiple surfaces - different textures**
   - Create 10 surfaces, 3 different textures
   - Verify 3 draw calls (sorted by texture)
   - Validate batching per texture

3. **Sorting: Opaque surfaces front-to-back**
   - Create surfaces at varying depths
   - Verify opaque surfaces sorted front-to-back
   - Validate render order (performance optimization)

4. **Sorting: Transparent surfaces back-to-front**
   - Create transparent surfaces (SURF_TRANS33)
   - Verify sorted back-to-front
   - Validate blending order

**Implementation Notes:**
- Check `sortVisibleFacesFrontToBack` and `sortVisibleFacesBackToFront` in `frame.ts`
- Use render statistics to verify draw calls
- Visual output should be identical regardless of batching (performance vs correctness)

**Subtasks:**
1. Create multi-surface test scenarios
2. Capture render statistics (draw calls)
3. Verify batching behavior
4. Validate sorting via visual output

---

## Deliverables

### Test Files Created
- `tests/webgl/visual/world/bsp-geometry.test.ts` (~200 lines, 4 tests)
- `tests/webgl/visual/world/lightmaps.test.ts` (~250 lines, 5 tests)
- `tests/webgl/visual/world/bsp-batching.test.ts` (~200 lines, 4 tests)

### Test Utilities
- `packages/test-utils/src/shared/bsp.ts` (enhance existing)
  - `createTestBspGeometry()`
  - `createTestLightmap()`
  - `createLightmapAtlas()`

### Baseline Images (~13 images)
- `__snapshots__/baselines/bsp-*.png`
- `__snapshots__/baselines/lightmap-*.png`

---

## Success Criteria

- [ ] BSP surfaces render correctly
- [ ] Texture mapping works
- [ ] Lightmaps apply properly
- [ ] Multi-style lightmaps blend correctly
- [ ] Batching optimizes draw calls
- [ ] Sorting produces correct visual output
- [ ] Face culling works (back faces not rendered)
- [ ] Depth testing prevents Z-fighting
- [ ] ~13 visual tests passing

---

## Notes for Implementer

- **BSP Complexity:** Start with simple geometry (quads, cubes), not full maps
- **Lightmap Format:** Understand lightmap atlas structure (packed texture, UV regions)
- **Light Styles:** Typically 4 styles max (indices 0-3), each has intensity value
- **Blend Modes:** Lightmaps multiply with base texture, then styles add together
- **Camera Setup:** Position camera for good view of test geometry
- **Performance:** Batching tests validate optimization, not just correctness
- **Assets:** Use test-utils helpers to generate minimal BSP data, avoid full map loading

---

**Next Section:** [21-7: Water & Warp Surfaces](section-21-7.md)
