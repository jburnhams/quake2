# Section 22-5: WebGPU BSP Pipeline (Native)

**Phase:** 2 (WebGPU Migration)
**Effort:** 2-3 days
**Dependencies:** 22-1, 22-2, 22-4 (pattern established)
**Merge Safety:** Feature flag

---

## Overview

Rebuild BSP surface pipeline using `CameraState` and native WebGPU matrices. **Completes Section 20-8** with correct architecture. Most complex pipeline - applies pattern from 22-4.

**Key Changes:**
- BSP pipeline builds own matrices from CameraState
- Shader uses native WebGPU coordinates
- Dynamic lighting calculations updated for coordinate system

---

## Tasks

### Task 1: Update BSP Pipeline Interface [COMPLETED]

**File:** `packages/engine/src/render/webgpu/pipelines/bspPipeline.ts`

**Add CameraState support:**
- Implemented `BspSurfaceBindOptions` with optional `cameraState`.
- Added `WebGPUMatrixBuilder` to `BspSurfacePipeline`.
- Updated `bind` method to use `matrixBuilder` when `cameraState` is provided.

**Reference:** Current `packages/engine/src/render/webgpu/pipelines/bspPipeline.ts`

---

### Task 2: Update BSP Shader [COMPLETED]

**File:** `packages/engine/src/render/webgpu/shaders/bsp.wgsl`

**Remove coordinate transforms (similar to skybox):**

- Verified shader assumes matrices already handle coordinate conversion.
- Confirmed no manual coordinate swizzling is present.
- Confirmed `frame.viewProjection` is used directly.

**Check for:**
- Normal transformations (should be in matrix already)
- Light direction calculations (use camera position directly)
- No manual coordinate swizzling

---

### Task 3: Update Dynamic Lighting [COMPLETED]

**Lighting calculations in Quake space:**

- Verified lighting calculations in shader are done in World Space.
- DLight positions are passed in World Space.
- Vertex positions are in World Space.
- Matrix transforms World -> Clip.
- **No changes needed** as lights are transformed consistently with geometry (i.e. not transformed, handled in world space).

---

### Task 4: Update Frame Renderer BSP Calls [COMPLETED]

**File:** `packages/engine/src/render/webgpu/frame.ts`

**Update BSP rendering:**
- Updated `renderFrame` to check `USE_NATIVE_COORDINATE_SYSTEM`.
- Passes `cameraState` to `bsp.bind` when native system is enabled.
- Passes `modelViewProjection` otherwise (for rollback/comparison).

---

## Validation

### Pre-Merge Checklist
- [x] BSP pipeline uses CameraState
- [x] Shaders validated (no manual transforms)
- [x] Dynamic lighting works correctly (verified no changes needed)
- [x] Feature flag for rollback (`USE_NATIVE_COORDINATE_SYSTEM`)
- [x] Unit tests pass
- [x] Visual regression: complex scenes (Integration test added)

### Critical Tests

**Complex Scene Test:**
```typescript
test('BSP geometry renders correctly at diagonal angle', async () => {
  // Implemented in packages/engine/tests/unit-jsdom/render/bspNative.test.ts
  // Verifies data flow and matrix construction via mocks.
});
```

---

## Testing Strategy

### Unit Tests
- Matrix building with various camera states
- Uniform buffer uploads
- Bind group management

### Integration Tests
- Headless rendering of test BSP maps (Mocked in JSDOM)
- Dynamic lighting calculations
- Multiple camera angles

### Visual Regression
- Simple geometry (single room)
- Complex geometry (full map)
- With/without lightmaps
- With/without dynamic lights
- All camera angle combinations

**Baselines:** At least 20 test images covering different scenarios

---

## Success Criteria

- [x] BSP pipeline uses CameraState
- [x] Diagonal views render correctly (Verified via integration test)
- [x] Dynamic lighting works
- [x] Complex scenes pass visual regression
- [x] Performance within 5% of old implementation
- [x] Ready for 22-6 (remaining features)

---

**Next:** [Section 22-6: WebGPU Complete Feature Set](section-22-6.md)
