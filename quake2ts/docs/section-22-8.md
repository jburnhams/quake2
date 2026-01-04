# Section 22-8: WebGL Native Matrix Building

**Phase:** 3 (WebGL Migration)
**Effort:** 2-3 days
**Dependencies:** 22-7 (adapter working)
**Merge Safety:** Feature flag, visual regression gates

---

## Overview

Remove adapter layer and have WebGL pipelines build matrices directly from `CameraState`. Completes WebGL migration to clean architecture.

**Goal:** WebGL renderers use `WebGLMatrixBuilder` directly, matching adapter output but cleaner.

---

## Tasks

### Task 1: Update WebGL Skybox

- [x] **File:** `packages/engine/src/render/skybox.ts` (modify)
- [x] Use CameraState directly.
- [x] Verified with unit tests.

### Task 2: Update WebGL BSP Pipeline

- [x] **File:** `packages/engine/src/render/bspPipeline.ts` (modify)
- [x] Build matrices internally.
- [x] Verified with unit tests.

### Task 3: Update All WebGL Pipelines

**Apply same pattern to:**
- MD2 pipeline (`md2.ts`)
- MD3 pipeline (`md3.ts`)
- Particle system (`particleSystem.ts`)
- Post-processing (`postprocessing/pipeline.ts`)
- Bloom (`bloom.ts`)
- Debug rendering (`debug.ts`)

**Each pipeline:**
1. Add `WebGLMatrixBuilder` instance
2. Accept `CameraState` instead of matrices
3. Build matrices internally
4. Update tests

---

### Task 4: Update WebGL Frame Renderer

**File:** `packages/engine/src/render/frame.ts`

**Pass CameraState to pipelines:**

```typescript
export const createFrameRenderer = (
  gl: WebGL2RenderingContext,
  bspPipeline: BspSurfacePipeline,
  skyboxPipeline: SkyboxPipeline,
  deps: FrameRendererDependencies = DEFAULT_DEPS
): FrameRenderer => {

  const renderFrame = (options: FrameRenderOptions): FrameRenderStats => {
    const cameraState = options.cameraState ?? options.camera.toState();

    // OLD: const viewProjection = new Float32Array(camera.viewProjectionMatrix);
    // NEW: Pipelines build their own matrices

    // Render sky
    if (sky) {
      skyboxPipeline.bind({
        cameraState,  // NEW
        scroll: deps.computeSkyScroll(timeSeconds, sky.scrollSpeeds),
        textureUnit: sky.textureUnit ?? 0
      });
      skyboxPipeline.draw();
    }

    // Render BSP
    if (world) {
      // ... gather visible faces ...

      bspPipeline.bind({
        cameraState,  // NEW
        styleIndices: faceStyles,
        styleValues: effectiveLightStyles,
        // ... rest ...
      });

      // ... draw surfaces ...
    }

    // ... rest of renderer ...
  };

  return { renderFrame };
};
```

---

### Task 5: Remove Adapter

**File:** `packages/engine/src/render/adapters/webglCamera.ts`

**Delete adapter file** once all pipelines migrated and tests passing.

**File:** `packages/engine/src/render/webgl/renderer.ts`

**Remove adapter usage:**

```typescript
// DELETE:
// private cameraAdapter = new WebGLCameraAdapter();

renderFrame(options: FrameRenderOptions, ...): void {
  // Pipelines now handle CameraState directly
  this.frameRenderer.renderFrame(options);
}
```

---

### Task 6: Cleanup Camera Class

**File:** `packages/engine/src/render/camera.ts`

**After WebGL migration complete, can simplify:**

**Option A:** Keep `updateMatrices()` for backward compatibility
**Option B:** Mark as deprecated, eventually remove in 22-12

**For now:** Keep existing methods, add deprecation warnings.

---

## Validation

### Pre-Merge Checklist
- [ ] All WebGL pipelines use CameraState
- [ ] Adapter removed
- [ ] Unit tests pass
- [ ] Visual regression: pixel-perfect match to 22-7
- [ ] Performance unchanged
- [ ] Feature flag tested both paths

### Critical Visual Regression

**Must match adapter output exactly:**

```typescript
describe('WebGL Native vs Adapter', () => {
  test('native produces same output as adapter', async () => {
    const camera = new Camera(800, 600);
    camera.setPosition(100, 200, 50);
    camera.setRotation(30, 135, 0);

    // Render with adapter (22-7)
    const adapterRenderer = createWebGLRendererWithAdapter();
    const adapterOutput = await renderScene(adapterRenderer, testScene, camera);

    // Render with native (22-8)
    const nativeRenderer = createWebGLRendererNative();
    const nativeOutput = await renderScene(nativeRenderer, testScene, camera);

    // Must be identical
    expect(nativeOutput).toMatchImageSnapshot(adapterOutput, {
      threshold: 0.0
    });
  });
});
```

---

## Testing Strategy

### Comprehensive Visual Regression

**Test Coverage:**
- All camera positions used in existing tests
- All WebGL features (sky, BSP, models, particles, etc.)
- Complex scenes with multiple features
- Edge cases (extreme angles, near/far planes)

**Baseline:** Adapter output from 22-7 (already validated as pixel-perfect)

**Comparison:** Native output from 22-8

**Gate:** Zero pixel differences allowed

---

## Success Criteria

- [ ] All WebGL pipelines build own matrices
- [ ] Adapter deleted
- [ ] Visual regression: zero differences vs adapter
- [ ] Performance within 1% of adapter
- [ ] All existing tests pass
- [ ] Ready for 22-9 (consolidation)

---

**Next:** [Section 22-9: Pipeline Utilities & Shared Code](section-22-9.md)
