# Section 21-9: MD2 Character Models

**Phase:** 3 (Core 3D)
**Priority:** HIGH
**Dependencies:** 21-1, 21-4
**Estimated Effort:** 3-4 days

---

## Overview

Validate MD2 character model rendering including vertex animation via frame interpolation, LOD (Level of Detail) system, model tinting, and lighting application.

**Renderer Components:**
- `packages/engine/src/render/md2Pipeline.ts` (`Md2Pipeline` class)
- `packages/engine/src/render/renderer.ts` (MD2 entity rendering in `renderFrame`)
- `packages/assets/md2.ts` (`Md2Model` structure)
- `packages/engine/src/render/scene.ts` (`RenderableMd2` entity type)

**MD2 Features:**
- Vertex animation (frame interpolation)
- LOD system (multiple detail levels)
- Per-model tinting
- Lighting (ambient + dynamic lights)
- Backface culling
- Depth testing

---

## Objectives

1. Validate basic MD2 model rendering
2. Test frame interpolation (blend between keyframes)
3. Verify LOD system (distance-based detail switching)
4. Test model tinting and color modulation
5. Validate lighting application
6. Test multiple models in scene

---

## Test Files Structure

```
tests/webgl/visual/models/
├── md2-basic.test.ts        # Basic rendering, frame interpolation
└── md2-lod.test.ts          # LOD system validation
```

---

## Tasks

### Task 1: Basic MD2 Rendering Tests

**File:** `tests/webgl/visual/models/md2-basic.test.ts`

**Visual Tests:**

1. **MD2: Single model - static pose (frame 0)**
   - Load simple MD2 model (e.g., player model)
   - Render at frame 0, no interpolation
   - Validate geometry, texture mapping

2. **MD2: Single model - different pose (frame 10)**
   - Same model, different animation frame
   - Validate vertex positions differ
   - Check texture coordinates maintained

3. **MD2: Frame interpolation - mid-blend**
   - Render with `blend: { frame0: 0, frame1: 10, lerp: 0.5 }`
   - Validate interpolated vertex positions
   - Smooth transition between keyframes

4. **MD2: Multiple models - same model different poses**
   - Render 3 instances of same model
   - Different frames (0, 5, 10)
   - Validate independent rendering

**Implementation Pattern:**

```typescript
import { test } from 'vitest';
import { createRenderer } from '../../../src/render/renderer';
import { createWebGLRenderTestSetup, expectSnapshot } from '@quake2ts/test-utils';
import { loadMd2Model } from '@quake2ts/test-utils';  // Helper to load test MD2
import { Camera } from '../../../src/render/camera';
import { mat4 } from 'gl-matrix';
import path from 'path';

const snapshotDir = path.join(__dirname, '..', '__snapshots__');

test('md2: single model static pose', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  // Load test MD2 model (simple character)
  const model = await loadMd2Model('test-player.md2');
  const texture = renderer.uploadTexture('player-skin', model.skin);

  // Create renderable entity
  const entity: RenderableMd2 = {
    id: 1,
    type: 'md2',
    model,
    transform: mat4.fromTranslation(mat4.create(), [0, 0, 0]),
    blend: { frame0: 0, frame1: 0, lerp: 0.0 },
    tint: [1, 1, 1, 1],
    lighting: {
      ambient: [0.7, 0.7, 0.7],
      dynamicLights: [],
      modelMatrix: mat4.create()
    }
  };

  const camera = new Camera(mat4.create());
  camera.setPosition([0, 1, 3]);  // View character from front
  camera.lookAt([0, 0.5, 0]);
  camera.setPerspective(60, 1.0, 0.1, 100);

  renderer.renderFrame({
    camera,
    clearColor: [0.2, 0.2, 0.3, 1.0]
  }, [entity]);

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: 'md2-static-frame0',
    description: 'MD2 character model in static pose (frame 0)',
    width: 256,
    height: 256,
    snapshotDir
  });

  setup.cleanup();
});

test('md2: frame interpolation', async () => {
  const setup = await createWebGLRenderTestSetup(768, 256);  // 3 frames
  const renderer = createRenderer(setup.gl);

  const model = await loadMd2Model('test-player.md2');
  const camera = new Camera(mat4.create());

  // Render at lerp = 0.0, 0.5, 1.0
  const lerps = [0.0, 0.5, 1.0];
  for (let i = 0; i < lerps.length; i++) {
    setup.gl.viewport(i * 256, 0, 256, 256);
    setup.gl.scissor(i * 256, 0, 256, 256);
    setup.gl.enable(setup.gl.SCISSOR_TEST);

    const entity: RenderableMd2 = {
      id: 1,
      type: 'md2',
      model,
      transform: mat4.fromTranslation(mat4.create(), [0, 0, 0]),
      blend: { frame0: 0, frame1: 10, lerp: lerps[i] },
      tint: [1, 1, 1, 1],
      lighting: { ambient: [0.7, 0.7, 0.7], dynamicLights: [], modelMatrix: mat4.create() }
    };

    renderer.renderFrame({ camera, clearColor: [0.2, 0.2, 0.3, 1.0] }, [entity]);
  }

  setup.gl.disable(setup.gl.SCISSOR_TEST);

  const pixels = captureWebGLFramebuffer(setup.gl, 768, 256);

  await expectSnapshot(pixels, {
    name: 'md2-interpolation',
    description: 'MD2 frame interpolation at lerp 0.0, 0.5, 1.0',
    width: 768,
    height: 256,
    snapshotDir
  });

  setup.cleanup();
});
```

**Subtasks:**
1. Create `loadMd2Model` helper in test-utils
2. Obtain or create simple test MD2 model
3. Implement static pose tests
4. Implement interpolation tests
5. Test multiple instances

**Assets Needed:**
- Simple MD2 model (player character, weapon, etc.)
- Model skin texture
- Can use from pak.pak or create minimal test model

---

### Task 2: Model Tinting Tests

**Visual Tests:**

1. **MD2: Color tinting - red, green, blue**
   - Render same model with different `tint` values
   - Validate color modulation
   - Ensure texture colors multiply correctly

2. **MD2: Alpha transparency**
   - Render with `tint: [1, 1, 1, 0.5]`
   - Validate alpha blending
   - Test against solid background

**Implementation Notes:**
- Tint should multiply with texture colors
- Alpha should enable blending if < 1.0
- Check shader implementation in `md2Pipeline.ts`

---

### Task 3: LOD System Tests

**File:** `tests/webgl/visual/models/md2-lod.test.ts`

**Visual Tests:**

1. **LOD: Close distance - high detail**
   - Position camera close to model
   - Verify LOD level 0 (highest detail)
   - Render full polygon count

2. **LOD: Medium distance - medium detail**
   - Position camera at medium distance
   - Verify LOD level 1
   - Reduced polygon count

3. **LOD: Far distance - low detail**
   - Position camera far from model
   - Verify LOD level 2 (lowest detail)
   - Minimal polygon count

4. **LOD: Side-by-side comparison**
   - Render all 3 LOD levels simultaneously
   - Same model, different detail levels
   - Validate visual difference

**Implementation Notes:**
- LOD system in `renderer.ts` `selectLod` function
- Distance threshold typically 500 units per LOD level
- Check `Md2Model.lods` array
- May need to create test model with multiple LOD levels

**Subtasks:**
1. Create test MD2 with LOD levels
2. Implement distance-based tests
3. Implement comparison test
4. Validate LOD selection logic

**Assets Needed:**
- MD2 model with 2-3 LOD levels
- Or procedurally generate LOD meshes

---

### Task 4: Lighting Tests

**Visual Tests:**

1. **MD2: Ambient lighting only**
   - Render with different ambient values
   - Validate brightness modulation

2. **MD2: Ambient + single dynamic light**
   - Add point light near model
   - Validate light accumulation
   - Test different light colors

3. **MD2: Multiple dynamic lights**
   - Add 3 colored point lights
   - Validate multi-light accumulation
   - Check for oversaturation

**Implementation Notes:**
- Lighting calculated per-vertex or per-pixel
- Check `calculateEntityLight` from `light.ts`
- Dynamic lights added to ambient base

---

## Deliverables

### Test Files Created
- `tests/webgl/visual/models/md2-basic.test.ts` (~250 lines, 6 tests)
- `tests/webgl/visual/models/md2-lod.test.ts` (~200 lines, 4 tests)

### Test Utilities
- `packages/test-utils/src/shared/md2.ts` (new)
  - `loadMd2Model()` - Load test MD2 from pak or generate minimal
  - `createSimpleMd2Model()` - Procedural cube with MD2 format

### Baseline Images (~10 images)
- `__snapshots__/baselines/md2-*.png`

---

## Success Criteria

- [ ] MD2 models render correctly
- [ ] Frame interpolation produces smooth animation
- [ ] LOD system switches detail levels appropriately
- [ ] Tinting modulates model colors correctly
- [ ] Lighting applies to models properly
- [ ] Multiple models render independently
- [ ] ~10 visual tests passing

---

## Notes for Implementer

- **MD2 Format:** Understand frame structure (vertex positions, normals, texture coordinates)
- **Animation:** MD2 uses keyframe animation, not skeletal
- **LOD Bias:** Check `renderer.ts` for `lodBias` parameter (affects LOD selection)
- **Camera Distance:** Calculate distance from camera to model origin for LOD
- **Texture Mapping:** MD2 uses single texture (skin), UVs baked into model
- **Backface Culling:** Ensure enabled for performance
- **Test Models:** Start with simple models (cube, sphere) before complex characters

---

**Next Section:** [21-10: MD3 Skeletal Models](section-21-10.md)
