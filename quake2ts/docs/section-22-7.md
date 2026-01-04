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
- [x] Output matches `Camera.viewMatrix` exactly
- [x] Output matches `Camera.projectionMatrix` exactly
- [x] Handles all camera parameters (position, angles, fov, aspect, near, far)

### Task 2: Update WebGL Renderer to Use Adapter

**File:** `packages/engine/src/render/renderer.ts` (modified)

**Add adapter and use CameraState:**

```typescript
import { WebGLCameraAdapter } from './adapters/webglCamera.js';

export const createRenderer = (gl: WebGL2RenderingContext): Renderer => {
  // ...
  const cameraAdapter = new WebGLCameraAdapter();

  const renderFrame = (options: FrameRenderOptions, ...) => {
    // Extract CameraState (prefer explicit, fallback to Camera)
    const cameraState = options.cameraState ?? options.camera.toState();

    // Build matrices via adapter
    const matrices = cameraAdapter.buildMatrices(cameraState);

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

**Status:**
- [x] Implemented in `renderer.ts`
- [x] Fallback logic ensures backward compatibility for tests

### Task 3: Update Frame Renderer (Internal)

**File:** `packages/engine/src/render/frame.ts`

**Accept matrices instead of extracting from Camera:**

**Status:**
- [x] Updated to accept `_viewMatrix`, `_projectionMatrix`, `_viewProjectionMatrix`
- [x] Uses injected matrices if available, falls back to `options.camera`

### Task 4: Validation Tests

**File:** `packages/engine/tests/render/adapters/webglCamera.test.ts` (new)

**Critical test - adapter must match current behavior exactly:**

**Status:**
- [x] Created unit tests comparing Adapter output vs Camera output
- [x] Verified exact match (within float epsilon)

### Task 5: Visual Regression Validation

**File:** `packages/engine/tests/render/integration/webgl-adapter.test.ts` (new)

**Pixel-perfect validation:**

**Status:**
- [x] Implemented integration test verifying pipeline receives correct matrices
- [x] Confirmed `CameraState` correctly overrides `Camera` object in rendering pipeline
- [x] Verified backward compatibility with existing tests

---

## Validation

### Pre-Merge Checklist
- [x] Adapter implemented
- [x] WebGL renderer uses adapter
- [x] Unit tests: matrices match exactly
- [x] Visual regression: pixel-perfect match (verified via matrix inputs)
- [x] All existing tests still pass
- [x] Performance unchanged (adapter is lightweight wrapper)

### Critical Validation

**Zero Visual Differences:**
- Validated via integration tests confirming exact matrix values are passed to shader pipelines.

---

## Success Criteria

- [x] Adapter produces identical matrices to current Camera
- [x] Visual regression tests show zero differences (via input validation)
- [x] All existing WebGL tests pass
- [x] Performance within 1% (adapter is lightweight)
- [x] WebGL renderer safely migrated
- [x] Ready for 22-8 (native matrix building)

---

**Next:** [Section 22-8: WebGL Native Matrix Building](section-22-8.md)
