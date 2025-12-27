# Section 22-7: WebGL Adapter Layer

**Phase:** 3 (WebGL Migration)
**Effort:** 1-2 days
**Dependencies:** 22-1, 22-2 (interfaces and matrix builders)
**Merge Safety:** 100% - adapter guarantees identical behavior

---

## Overview

Create adapter layer that allows WebGL renderer to consume `CameraState` while maintaining exact current behavior. Enables migration without visual changes.

**Strategy:** Adapter converts `CameraState` → GL matrices using `WebGLMatrixBuilder` (extracted from current `Camera.updateMatrices()`).

---

## Tasks

### Task 1: Create WebGL Camera Adapter

**File:** `packages/engine/src/render/adapters/webglCamera.ts` (new)

```typescript
import { mat4 } from 'gl-matrix';
import type { CameraState } from '../types/camera.js';
import { WebGLMatrixBuilder } from '../matrix/webgl.js';
import { buildMatrices } from '../matrix/builders.js';

/**
 * Adapter that converts CameraState to GL matrices.
 * Ensures WebGL renderer behavior remains identical during migration.
 */
export class WebGLCameraAdapter {
  private builder = new WebGLMatrixBuilder();

  /**
   * Build view and projection matrices from CameraState.
   * Output is IDENTICAL to current Camera.viewMatrix and Camera.projectionMatrix.
   */
  buildMatrices(cameraState: CameraState): {
    readonly view: mat4;
    readonly projection: mat4;
    readonly viewProjection: mat4;
  } {
    return buildMatrices(this.builder, cameraState);
  }

  /**
   * Build view matrix only.
   */
  buildViewMatrix(cameraState: CameraState): mat4 {
    return this.builder.buildViewMatrix(cameraState);
  }

  /**
   * Build projection matrix only.
   */
  buildProjectionMatrix(cameraState: CameraState): mat4 {
    return this.builder.buildProjectionMatrix(cameraState);
  }
}
```

**Tests:**
- Output matches `Camera.viewMatrix` exactly
- Output matches `Camera.projectionMatrix` exactly
- Handles all camera parameters (position, angles, fov, aspect, near, far)

---

### Task 2: Update WebGL Renderer to Use Adapter

**File:** `packages/engine/src/render/webgl/renderer.ts` (modify)

**Add adapter and use CameraState:**

```typescript
import { WebGLCameraAdapter } from '../adapters/webglCamera.js';

export class WebGLRenderer implements IRenderer {
  private cameraAdapter = new WebGLCameraAdapter();

  // ... existing code ...

  renderFrame(
    options: FrameRenderOptions,
    entities: readonly RenderableEntity[] = [],
    renderOptions?: RenderOptions
  ): void {
    // Extract CameraState (prefer explicit, fallback to Camera)
    const cameraState = options.cameraState ?? options.camera.toState();

    // Build matrices via adapter
    const matrices = this.cameraAdapter.buildMatrices(cameraState);

    // Pass to existing frame renderer (unchanged interface)
    this.frameRenderer.renderFrame({
      ...options,
      // Inject matrices for existing code that expects them
      _viewMatrix: matrices.view,  // Internal use
      _projectionMatrix: matrices.projection,
      _viewProjectionMatrix: matrices.viewProjection
    });
  }
}
```

**Alternative approach:** Update frame renderer to accept matrices directly instead of Camera object.

---

### Task 3: Update Frame Renderer (Internal)

**File:** `packages/engine/src/render/frame.ts` (WebGL-specific)

**Accept matrices instead of extracting from Camera:**

**Before:**
```typescript
const viewProjection = new Float32Array(camera.viewProjectionMatrix);
```

**After:**
```typescript
// Use injected matrices or build from camera (backward compat)
const viewProjection = options._viewProjectionMatrix
  ? new Float32Array(options._viewProjectionMatrix)
  : new Float32Array(camera.viewProjectionMatrix);
```

**Temporary:** Internal `_viewProjectionMatrix` field during migration. Remove in 22-8.

---

### Task 4: Validation Tests

**File:** `packages/engine/tests/render/adapters/webglCamera.test.ts` (new)

**Critical test - adapter must match current behavior exactly:**

```typescript
describe('WebGLCameraAdapter', () => {
  test('produces identical matrices to Camera.viewMatrix', () => {
    const camera = new Camera(800, 600);
    camera.setPosition(100, 200, 50);
    camera.setRotation(-30, 135, 5);
    camera.setFov(90);

    const adapter = new WebGLCameraAdapter();
    const cameraState = camera.toState();
    const adapterMatrices = adapter.buildMatrices(cameraState);

    const cameraView = camera.viewMatrix;
    const cameraProj = camera.projectionMatrix;
    const cameraViewProj = camera.viewProjectionMatrix;

    // Must be EXACTLY equal (within float epsilon)
    expect(adapterMatrices.view).toBeCloseToMat4(cameraView, 1e-7);
    expect(adapterMatrices.projection).toBeCloseToMat4(cameraProj, 1e-7);
    expect(adapterMatrices.viewProjection).toBeCloseToMat4(cameraViewProj, 1e-7);
  });

  test.each([
    [0, 0, 0, 0, 0, 0],
    [100, 200, 50, 0, 0, 0],
    [0, 0, 0, 45, 45, 0],
    [100, 200, 50, -30, 135, 5],
    [-50, -100, 25, 60, -90, 10]
  ])('matches at position [%d,%d,%d] angles [%d,%d,%d]',
    (x, y, z, pitch, yaw, roll) => {
      const camera = new Camera(800, 600);
      camera.setPosition(x, y, z);
      camera.setRotation(pitch, yaw, roll);

      const adapter = new WebGLCameraAdapter();
      const matrices = adapter.buildMatrices(camera.toState());

      expect(matrices.view).toBeCloseToMat4(camera.viewMatrix, 1e-7);
    }
  );
});
```

---

### Task 5: Visual Regression Validation

**File:** `packages/engine/tests/render/integration/webgl-adapter.test.ts` (new)

**Pixel-perfect validation:**

```typescript
describe('WebGL Adapter Visual Regression', () => {
  test('adapter produces identical rendering', async () => {
    const camera = new Camera(800, 600);
    camera.setPosition(100, 200, 50);
    camera.setRotation(30, 135, 0);

    const scene = loadTestScene();

    // Render with OLD path (direct Camera usage)
    const oldRenderer = createWebGLRenderer(canvasOld);
    oldRenderer.renderFrame({
      camera,  // Direct Camera object
      world: scene.world,
      sky: scene.sky
    }, scene.entities);
    const oldOutput = captureCanvas(canvasOld);

    // Render with NEW path (via adapter)
    const newRenderer = createWebGLRenderer(canvasNew);
    newRenderer.renderFrame({
      camera,  // Has toState() method
      cameraState: camera.toState(),  // Adapter uses this
      world: scene.world,
      sky: scene.sky
    }, scene.entities);
    const newOutput = captureCanvas(canvasNew);

    // MUST be pixel-identical
    expect(newOutput).toMatchImageSnapshot(oldOutput, {
      threshold: 0.0  // Zero tolerance
    });
  });

  test.each(generateCameraTestCases())(
    'identical at camera config %#',
    async (cameraConfig) => {
      // Test many camera configurations
      // All must be pixel-perfect matches
    }
  );
});
```

**Critical:** These tests MUST pass with zero differences before merge.

---

## Validation

### Pre-Merge Checklist
- [ ] Adapter implemented
- [ ] WebGL renderer uses adapter
- [ ] Unit tests: matrices match exactly
- [ ] Visual regression: pixel-perfect match
- [ ] All existing tests still pass
- [ ] Performance unchanged
- [ ] Feature flag for safety

### Critical Validation

**Zero Visual Differences:**
- Run full WebGL test suite
- Compare against baseline images
- Any difference is a failure (adapter must be perfect)

---

## Success Criteria

- [ ] Adapter produces identical matrices to current Camera
- [ ] Visual regression tests show zero differences
- [ ] All existing WebGL tests pass
- [ ] Performance within 1% (adapter is lightweight)
- [ ] WebGL renderer safely migrated
- [ ] Ready for 22-8 (native matrix building)

---

**Next:** [Section 22-8: WebGL Native Matrix Building](section-22-8.md)
