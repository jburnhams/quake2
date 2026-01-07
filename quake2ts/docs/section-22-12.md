**NOT STARTED**

Verified 2026-01-07:
- Task 1: WebGL adapter NOT removed (still at `adapters/webglCamera.ts`)
- Task 2: Camera matrix getters NOT marked @deprecated
- Task 3: Feature flags not cleaned up (N/A - none exist)
- Task 4: FrameRenderOptions not updated
- Task 5: No temporary code cleanup done
- Task 6: Documentation not updated
- Task 7: CHANGELOG not updated for Section 22

**Blocked by:** Section 22-8 (WebGL native complete) and 22-11 (validation complete)

---

# Section 22-12: Cleanup & Deprecation

**Phase:** 5 (Cleanup)
**Effort:** 1 day
**Dependencies:** 22-8 (WebGL native), 22-11 (validation complete)
**Merge Safety:** Final cleanup, remove deprecated code

---

## Overview

Remove deprecated code paths, clean up adapters, and finalize the new architecture. Only execute after all validation passes.

**Removes:**
- WebGL adapter layer
- Old Camera matrix-building code
- Feature flags
- Temporary compatibility shims

---

## Tasks

### Task 1: Remove WebGL Adapter

**File:** `packages/engine/src/render/adapters/webglCamera.ts`

**Delete entire file** - no longer needed after 22-8

**Update:** `packages/engine/src/render/webgl/renderer.ts`

```typescript
// REMOVE:
// import { WebGLCameraAdapter } from '../adapters/webglCamera.js';
// private cameraAdapter = new WebGLCameraAdapter();

// Renderer now builds matrices directly in pipelines
```

---

### Task 2: Update Camera Class

**File:** `packages/engine/src/render/camera.ts`

**Mark old methods as deprecated:**

```typescript
export class Camera {
  // ... existing code ...

  /**
   * @deprecated Use toState() and renderer-specific matrix builders instead.
   * This method will be removed in a future version.
   */
  get viewMatrix(): mat4 {
    this.updateMatrices();
    return this._viewMatrix;
  }

  /**
   * @deprecated Use toState() and renderer-specific matrix builders instead.
   * This method will be removed in a future version.
   */
  get projectionMatrix(): mat4 {
    this.updateMatrices();
    return this._projectionMatrix;
  }

  /**
   * @deprecated Use toState() and renderer-specific matrix builders instead.
   * This method will be removed in a future version.
   */
  get viewProjectionMatrix(): mat4 {
    this.updateMatrices();
    return this._viewProjectionMatrix;
  }

  /**
   * @deprecated Internal method. Use toState() instead.
   */
  private updateMatrices(): void {
    // Keep implementation for now (backward compatibility)
    // Will be removed in future after all consumers migrated
  }
}
```

**Future:** Can remove `updateMatrices()` entirely once all consumers gone.

---

### Task 3: Remove Feature Flags

**Files:** `packages/engine/src/render/webgpu/frame.ts` and similar

**Remove feature flag code:**

```typescript
// DELETE:
// const USE_NATIVE_COORDINATE_SYSTEM = true;

// DELETE old code paths:
// if (USE_NATIVE_COORDINATE_SYSTEM) {
//   // new path
// } else {
//   // old path
// }

// Keep only new path
```

**Clean up all feature flag remnants** from WebGPU pipelines.

---

### Task 4: Update FrameRenderOptions

**File:** `packages/engine/src/render/frame.ts`

**Make cameraState required (or strongly preferred):**

```typescript
export interface FrameRenderOptions {
  readonly camera: Camera;              // Still accepted for compatibility
  readonly cameraState: CameraState;    // Now expected by all renderers
  // ... rest ...
}

// Helper function for migration
export function prepareCameraState(options: FrameRenderOptions): CameraState {
  if (!options.cameraState) {
    console.warn('FrameRenderOptions.cameraState not provided, falling back to camera.toState()');
  }
  return options.cameraState ?? options.camera.toState();
}
```

**Future:** Make `cameraState` required, `camera` optional.

---

### Task 5: Clean Up Temporary Code

**Search for:**
- `// TODO: Remove after 22-X`
- `// TEMPORARY`
- `// MIGRATION`
- Internal `_` prefixed fields added during migration

**Remove:**
- Temporary compatibility fields
- Migration comments
- Old code paths marked for deletion

---

### Task 6: Update Documentation

**Update:** `packages/engine/src/render/README.md`

```markdown
# Renderer Architecture

## Overview
Renderers consume `CameraState` (Quake-space data) and build their own view/projection matrices.

## CameraState Interface
```typescript
interface CameraState {
  readonly position: ReadonlyVec3;  // Quake coordinates
  readonly angles: ReadonlyVec3;    // [pitch, yaw, roll] in degrees
  readonly fov: number;
  readonly aspect: number;
  readonly near: number;
  readonly far: number;
}
```

## Matrix Builders
- `WebGLMatrixBuilder` - OpenGL conventions
- `WebGPUMatrixBuilder` - WebGPU conventions
- `IdentityMatrixBuilder` - Quake-space (testing)

## Renderers
- WebGL: Uses `WebGLMatrixBuilder`
- WebGPU: Uses `WebGPUMatrixBuilder`
- Null: No-op testing renderer
- Logging: Human-readable command log

## Migration Complete
Section 22 refactoring completed 2025-12-27.
- All renderers use CameraState
- No more GL-specific assumptions in shared code
- Clean boundary for future renderers
```

**Delete:** Old architecture documentation referencing GL matrices

---

### Task 7: Update Changelog

**File:** `packages/engine/CHANGELOG.md`

```markdown
## [Unreleased]

### Changed
- **BREAKING**: Renderer architecture refactored to use `CameraState` interface
  - All renderers now build their own view/projection matrices
  - Fixes WebGPU diagonal view coordinate bug
  - See Section 22 documentation for details

### Added
- `CameraState` interface for renderer input
- `WebGLMatrixBuilder` and `WebGPUMatrixBuilder` utilities
- Null and Logging renderers for testing
- Comprehensive visual regression test suite (50+ baselines)

### Deprecated
- `Camera.viewMatrix` - use `toState()` with matrix builders
- `Camera.projectionMatrix` - use `toState()` with matrix builders
- `Camera.viewProjectionMatrix` - use `toState()` with matrix builders

### Removed
- WebGL camera adapter (migration complete)
- Feature flags for old coordinate system
- Temporary compatibility shims

### Fixed
- WebGPU diagonal view rendering bug (double-transform issue)
- Coordinate system consistency across all renderers
```

---

## Validation

### Pre-Merge Checklist
- [ ] Adapter deleted
- [ ] Feature flags removed
- [ ] Deprecated methods marked
- [ ] Temporary code cleaned up
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] All tests still pass
- [ ] No compiler warnings

### Final Validation

**Run full test suite:**
```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# Visual regression
pnpm test:visual

# Performance (informational)
pnpm test:performance

# All tests should pass
```

---

## Success Criteria

- [ ] All deprecated code removed or marked
- [ ] Documentation updated
- [ ] Changelog complete
- [ ] Zero compiler warnings
- [ ] All tests passing
- [ ] Clean codebase ready for future work
- [ ] Section 22 complete!

---

**Next:** [Section 22-13: Future Renderers (Stretch)](section-22-13.md)
