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
   - Create BSP surface with `SURF_WARP` flag
   - Apply water texture
   - Freeze time at t=0.0
   - Validate distortion pattern

2. **Warp: Animated - multiple time snapshots**
   - Same surface at t=0.0, t=1.0, t=2.0
   - Validate animation progression
   - Compare different time values

3. **Warp: Multiple warp surfaces - same texture**
   - Create 2 warp surfaces (floor, ceiling)
   - Both use same water texture
   - Validate independent rendering

4. **Warp: Warp surface with different textures**
   - Test with water, slime, lava textures
   - Validate warp effect applies to all
   - Verify texture sampling

5. **Warp: No lightmaps on warp surfaces**
   - Create warp surface with lightmap data
   - Verify lightmap is ignored
   - Only base texture and warp distortion

**Implementation Pattern:**

```typescript
import { test } from 'vitest';
import { createRenderer } from '../../../src/render/renderer';
import { createWebGLRenderTestSetup, expectSnapshot } from '@quake2ts/test-utils';
import { createTestBspMap } from '@quake2ts/test-utils';
import { Camera } from '../../../src/render/camera';
import { SURF_WARP } from '@quake2ts/shared';
import { mat4 } from 'gl-matrix';
import path from 'path';

const snapshotDir = path.join(__dirname, '..', '__snapshots__');

test('warp: basic water surface at t=0', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  // Create BSP surface with SURF_WARP flag
  const bspMap = createTestBspMap({
    surfaces: [
      {
        vertices: [/* horizontal quad */],
        flags: SURF_WARP,
        texInfo: { textureName: 'water1', /* ... */ }
      }
    ]
  });

  const geometry = renderer.uploadBspGeometry(bspMap);
  const camera = new Camera(mat4.create());
  camera.setPosition([0, 3, 0]);  // Above water
  camera.lookAt([0, 0, 0]);
  camera.setPerspective(90, 1.0, 0.1, 100);

  // Render at specific time for determinism
  renderer.renderFrame({
    camera,
    world: {
      map: bspMap,
      surfaces: [geometry],
      textures: renderer.getTextures()
    },
    timeSeconds: 0.0,  // Freeze time
    clearColor: [0.5, 0.7, 1.0, 1.0]  // Sky blue background
  });

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: 'warp-water-t0',
    description: 'Water surface with warp distortion at time=0',
    width: 256,
    height: 256,
    snapshotDir
  });

  setup.cleanup();
});

test('warp: animated water over time', async () => {
  const setup = await createWebGLRenderTestSetup(768, 256);  // 3 frames side-by-side
  const renderer = createRenderer(setup.gl);

  const bspMap = createTestBspMap({/* same as above */});
  const geometry = renderer.uploadBspGeometry(bspMap);
  const camera = new Camera(mat4.create());

  // Render 3 time samples side-by-side
  const times = [0.0, 1.0, 2.0];
  for (let i = 0; i < times.length; i++) {
    // Setup viewport for this sub-region
    setup.gl.viewport(i * 256, 0, 256, 256);
    setup.gl.scissor(i * 256, 0, 256, 256);
    setup.gl.enable(setup.gl.SCISSOR_TEST);

    renderer.renderFrame({
      camera,
      world: { map: bspMap, surfaces: [geometry], textures: renderer.getTextures() },
      timeSeconds: times[i],
      clearColor: [0.5, 0.7, 1.0, 1.0]
    });
  }

  setup.gl.disable(setup.gl.SCISSOR_TEST);

  const pixels = captureWebGLFramebuffer(setup.gl, 768, 256);

  await expectSnapshot(pixels, {
    name: 'warp-water-animation',
    description: 'Water surface at t=0, t=1, t=2 (left to right)',
    width: 768,
    height: 256,
    snapshotDir
  });

  setup.cleanup();
});
```

**Subtasks:**
1. Create warp surface test geometry
2. Implement time-frozen test
3. Implement animation sequence test
4. Test multiple warp surfaces
5. Verify lightmaps don't apply

**Assets Needed:**
- Water texture (blue with slight pattern)
- Slime texture (green, viscous looking)
- Lava texture (red/orange, glowing)
- Can use procedural textures or load from pak.pak

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

**Implementation Notes:**
- Warp formula typically: `uv += sin(uv * frequency + time) * amplitude`
- Check `bspPipeline.ts` for actual implementation
- Values may come from `TURBSCALE` constants in original Quake 2

**Subtasks:**
1. Analyze warp shader/algorithm in bspPipeline.ts
2. Create validation tests
3. Document warp parameters

---

## Deliverables

### Test Files Created
- `tests/webgl/visual/world/water-surfaces.test.ts` (~200 lines, 7 tests)

### Baseline Images (~7 images)
- `__snapshots__/baselines/warp-*.png`

---

## Success Criteria

- [ ] SURF_WARP surfaces identified correctly
- [ ] Warp distortion applied to texture coordinates
- [ ] Animation progresses smoothly over time
- [ ] Different textures warp correctly
- [ ] Lightmaps don't apply to warp surfaces
- [ ] No visual artifacts at surface edges
- [ ] ~7 visual tests passing

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
