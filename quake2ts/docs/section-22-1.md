# Section 22-1: Core Interfaces & CameraState

**Phase:** 1 (Foundation)
**Effort:** 1 day
**Dependencies:** None
**Merge Safety:** 100% additive, zero breaking changes

---

## Overview

Define the core abstraction boundary between game engine and renderers. Introduces `CameraState` as a pure data interface (Quake-space only) and updates `FrameRenderOptions` to support both legacy and new interfaces during migration.

**Key Principle:** Additive only - existing code continues to work unchanged.

---

## Tasks

### Task 1: Define CameraState Interface

**File:** `packages/engine/src/render/types/camera.ts` (new file)

**Create interface for Quake-space camera data:**

```typescript
interface CameraState {
  readonly position: ReadonlyVec3;     // Quake coords (X forward, Y left, Z up)
  readonly angles: ReadonlyVec3;       // [pitch, yaw, roll] in degrees
  readonly fov: number;                 // Field of view in degrees
  readonly aspect: number;              // Width / height
  readonly near: number;                // Near clip plane
  readonly far: number;                 // Far clip plane
}
```

**Coordinate system documentation:**
- Position: Quake world coordinates
- Angles: [pitch, yaw, roll] - standard Quake orientation
- All values in game-engine space (no GL/WebGPU transforms)

**Reference:** Current `Camera` class in `packages/engine/src/render/camera.ts:4-7`

**Tests:**
- Unit test: Create CameraState, verify immutability
- Unit test: Validate angle normalization helpers (if added)

---

### Task 2: Extend Camera Class

**File:** `packages/engine/src/render/camera.ts` (modify)

**Add method to expose CameraState:**

```typescript
class Camera {
  // ... existing code unchanged ...

  /**
   * Export camera state in Quake-space coordinates.
   * For use with new renderer architecture.
   */
  toState(): CameraState {
    return {
      position: vec3.clone(this._position),
      angles: vec3.clone(this._angles),
      fov: this._fov,
      aspect: this._aspect,
      near: this._near,
      far: this._far
    };
  }
}
```

**Critical:** Do NOT modify existing `viewMatrix`, `projectionMatrix`, or `updateMatrices()` methods. Legacy renderers still need them.

**Tests:**
- Unit test: `camera.toState()` returns correct values
- Unit test: Returned state is immutable (defensive copy)
- Unit test: Multiple calls return equal but distinct objects

---

### Task 3: Update FrameRenderOptions

**File:** `packages/engine/src/render/frame.ts` (modify)

**Add optional cameraState field:**

```typescript
interface FrameRenderOptions {
  readonly camera: Camera;              // Legacy - still required
  readonly cameraState?: CameraState;   // New - optional during migration
  // ... rest unchanged ...
}
```

**Migration strategy:**
- Old renderers: Use `options.camera` (current behavior)
- New renderers: Use `options.cameraState` if present, fallback to `options.camera.toState()`
- Future: Make `cameraState` required, deprecate `camera`

**Tests:**
- Unit test: FrameRenderOptions validates with camera only (legacy)
- Unit test: FrameRenderOptions validates with both camera and cameraState
- Integration test: Render with legacy path still works

---

### Task 4: Create Coordinate System Documentation

**File:** `packages/engine/src/render/types/coordinates.ts` (new file)

**Document coordinate system conventions:**

```typescript
/**
 * Coordinate System Reference
 *
 * QUAKE (Game Engine):
 * - +X: Forward
 * - +Y: Left
 * - +Z: Up
 * - Right-handed
 * - Angles: [pitch, yaw, roll] in degrees
 *
 * OPENGL/WEBGL:
 * - +X: Right
 * - +Y: Up
 * - +Z: Back (toward camera)
 * - Right-handed
 * - NDC: [-1, 1] for X, Y, Z
 * - Depth: 1 (near) to -1 (far)
 *
 * WEBGPU:
 * - +X: Right
 * - +Y: Up
 * - +Z: Forward (away from camera)
 * - Left-handed (affected by projection matrix)
 * - NDC: [-1, 1] for X, Y; [0, 1] for Z
 * - Depth: 0 (near) to 1 (far)
 */

export enum CoordinateSystem {
  QUAKE = 'quake',
  OPENGL = 'opengl',
  WEBGPU = 'webgpu'
}

export interface CoordinateConvention {
  readonly system: CoordinateSystem;
  readonly handedness: 'left' | 'right';
  readonly forward: '+X' | '+Y' | '+Z' | '-X' | '-Y' | '-Z';
  readonly up: '+X' | '+Y' | '+Z' | '-X' | '-Y' | '-Z';
  readonly ndcDepthRange: [number, number]; // [near, far]
}
```

**Purpose:** Central reference for all coordinate conversions. Used by matrix builders in 22-2.

**Tests:**
- Unit test: Validate convention constants are correct
- Documentation test: Examples in JSDoc are correct

---

### Task 5: Shared Renderer Types

**File:** `packages/engine/src/render/types/renderer.ts` (new file)

**Define common types for all renderers:**

```typescript
export interface RendererCapabilities {
  readonly maxTextureSize: number;
  readonly maxLights: number;
  readonly supportsCompute: boolean;
  readonly supportsTimestampQuery: boolean;
}

export interface RenderCommand {
  readonly type: 'draw' | 'clear' | 'setViewport' | 'setScissor';
  readonly timestamp?: number;
}

// For logging/null renderers
export interface RenderCommandLog {
  readonly commands: ReadonlyArray<RenderCommand>;
  readonly stats: {
    readonly drawCalls: number;
    readonly triangles: number;
  };
}
```

**Purpose:** Shared types used by logging renderer (22-3) and testing infrastructure.

**Tests:**
- Unit test: Type definitions compile without errors
- Integration test: Used successfully in null renderer (22-3)

---

## Validation

### Pre-Merge Checklist
- [x] All new files created in `types/` directory
- [x] `Camera.toState()` method added without modifying existing methods
- [x] `FrameRenderOptions` extended, not replaced
- [x] Coordinate documentation is accurate and comprehensive
- [x] Unit tests pass (should add ~10 new tests)
- [x] Existing integration tests still pass (no regressions)
- [x] TypeScript compiles without errors or warnings
- [x] No breaking changes to existing code

### Integration Validation
- [x] Existing WebGL renderer still works (uses `options.camera`)
- [x] Existing WebGPU renderer still works (uses `options.camera`)
- [x] New `cameraState` optional field doesn't break anything
- [x] Can create CameraState manually for testing

---

## Testing Strategy

### Unit Tests

**File:** `packages/engine/tests/render/types/camera.test.ts` (new)

```typescript
describe('CameraState', () => {
  test('toState() creates immutable snapshot', () => {
    const camera = new Camera(800, 600);
    camera.setPosition(10, 20, 30);
    camera.setRotation(15, 45, 0);

    const state = camera.toState();

    expect(state.position).toEqual([10, 20, 30]);
    expect(state.angles).toEqual([15, 45, 0]);

    // Verify immutability
    camera.setPosition(0, 0, 0);
    expect(state.position).toEqual([10, 20, 30]); // Unchanged
  });

  test('multiple toState() calls return equal objects', () => {
    const camera = new Camera();
    const state1 = camera.toState();
    const state2 = camera.toState();

    expect(state1).toEqual(state2);
    expect(state1).not.toBe(state2); // Different instances
  });
});
```

**File:** `packages/engine/tests/render/frame.test.ts` (modify)

```typescript
describe('FrameRenderOptions', () => {
  test('accepts legacy camera only', () => {
    const camera = new Camera();
    const options: FrameRenderOptions = {
      camera,
      // cameraState omitted - legacy path
    };
    expect(options.camera).toBe(camera);
  });

  test('accepts both camera and cameraState', () => {
    const camera = new Camera();
    const cameraState = camera.toState();
    const options: FrameRenderOptions = {
      camera,
      cameraState
    };
    expect(options.cameraState).toEqual(cameraState);
  });
});
```

### Integration Tests

**File:** `packages/engine/tests/render/integration/camera-state.test.ts` (new)

```typescript
describe('CameraState Integration', () => {
  test('WebGL renderer ignores cameraState (legacy)', () => {
    const renderer = createWebGLRenderer(canvas);
    const camera = new Camera();
    const cameraState = camera.toState();

    // Should not throw, should use camera.viewMatrix
    renderer.renderFrame({
      camera,
      cameraState
    }, []);
  });
});
```

---

## Documentation

### Code Comments

Every new interface should have:
- Purpose and usage example
- Coordinate system reference (link to coordinates.ts)
- Migration notes (when applicable)

### API Documentation

**Update:** `packages/engine/src/render/README.md`

Add section:
```markdown
## Renderer Architecture (v2)

As of Section 22-1, renderers can consume camera data in two ways:

1. **Legacy:** `options.camera.viewMatrix` (GL-space matrices)
2. **Modern:** `options.cameraState` (Quake-space data, build your own matrices)

New renderers should use `cameraState`. Legacy renderers will be migrated in future sections.
```

---

## Migration Notes

### For Future Sections

**22-2 (Matrix Builders):**
- Will consume `CameraState`
- Builds renderer-specific matrices

**22-3 (Logging Renderer):**
- Uses `CameraState` to log readable position/angles
- Uses `RenderCommand` types defined here

**22-4+ (WebGPU Native):**
- Uses `cameraState` exclusively
- Builds WebGPU-native matrices

**22-7+ (WebGL Migration):**
- Initially uses adapter to convert `cameraState` → GL matrices
- Eventually builds GL matrices directly from `cameraState`

---

## Rollback Plan

If issues arise:
1. New types are pure additions - simply don't use them
2. `Camera.toState()` can be commented out (nothing depends on it yet)
3. `cameraState` optional field can be ignored
4. Delete new `types/` directory
5. Revert changes to `camera.ts` and `frame.ts`

**Risk:** Extremely low - purely additive changes.

---

## Success Criteria

- [x] CameraState interface defined and documented
- [x] Camera.toState() method works correctly
- [x] FrameRenderOptions extended safely
- [x] Coordinate system documentation complete
- [x] 10+ unit tests passing
- [x] Zero breaking changes (all existing tests pass)
- [x] TypeScript compilation clean
- [x] Ready for 22-2 (matrix builders can consume CameraState)

---

**Next:** [Section 22-2: Matrix Builders & Coordinate Systems](section-22-2.md)
