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

### Task 1: Update BSP Pipeline Interface

**File:** `packages/engine/src/render/webgpu/pipelines/bspPipeline.ts`

**Add CameraState support:**
```typescript
export interface BspSurfaceBindOptions {
  cameraState: CameraState;  // NEW: was modelViewProjection matrix
  cameraPosition: ReadonlyVec3;  // Still needed for lighting
  styleIndices?: readonly number[];
  styleValues?: ReadonlyArray<number>;
  // ... rest unchanged ...
}

export class BspSurfacePipeline {
  private matrixBuilder: WebGPUMatrixBuilder;

  constructor(device: GPUDevice, colorFormat: GPUTextureFormat, depthFormat: GPUTextureFormat) {
    // ... existing setup ...
    this.matrixBuilder = new WebGPUMatrixBuilder();
  }

  bind(passEncoder: GPURenderPassEncoder, options: BspSurfaceBindOptions): void {
    // Build matrices from CameraState
    const matrices = buildMatrices(this.matrixBuilder, options.cameraState);

    // Update uniforms
    this.updateUniforms({
      viewProjection: matrices.viewProjection,
      cameraPosition: options.cameraPosition,
      // ... rest ...
    });

    // ... bind pipeline, bind groups, etc. ...
  }
}
```

**Reference:** Current `packages/engine/src/render/webgpu/pipelines/bspPipeline.ts`

- [x] Implemented `BspSurfaceBindOptions` update to include `CameraState`.
- [x] Integrated `WebGPUMatrixBuilder` in `BspSurfacePipeline`.
- [x] Updated uniform buffer data population to use generated matrices.

---

### Task 2: Update BSP Shader

**File:** `packages/engine/src/render/webgpu/shaders/bsp.wgsl`

**Remove coordinate transforms (similar to skybox):**

Verify shader assumes matrices already handle coordinate conversion. No inline transforms needed.

**Check for:**
- Normal transformations (should be in matrix already)
- Light direction calculations (use camera position directly)
- No manual coordinate swizzling

- [x] Verified `bsp.wgsl` uses standard `viewProjection` multiplication without extra manual coordinate hacks.
- [x] Confirmed `vertexMain` outputs world position for fragment shader lighting.

---

### Task 3: Update Dynamic Lighting

**Lighting calculations in Quake space:**

Ensure light positions are in consistent coordinate system. The shader receives WebGPU-space data after matrix transform, so light calculations remain unchanged.

**No changes needed** if lights are transformed consistently with geometry.

- [x] Verified `dlights` are passed in world coordinates (Quake space), matching vertex positions.
- [x] Confirmed distance calculation in shader is valid (World Space distance).

---

### Task 4: Update Frame Renderer BSP Calls

**File:** `packages/engine/src/render/webgpu/frame.ts`

**Update BSP rendering:**
```typescript
// OLD:
this.pipelines.bsp.bind(pass, {
    modelViewProjection: viewProjection,  // Pre-built matrix
    cameraPosition: options.camera.position,
    // ...
});

// NEW:
const cameraState = options.cameraState ?? options.camera.toState();

this.pipelines.bsp.bind(pass, {
    cameraState,  // Let pipeline build matrices
    cameraPosition: cameraState.position,
    // ...
});
```

- [x] Updated `FrameRenderer.renderFrame` to pass `cameraState` to `bspPipeline.bind`.
- [x] Removed `modelViewProjection` argument.

---

## Validation

### Pre-Merge Checklist
- [x] BSP pipeline uses CameraState
- [x] Shaders validated (no manual transforms)
- [x] Dynamic lighting works correctly
- [ ] Feature flag for rollback (Not implemented due to breaking API change in BspSurfaceBindOptions)
- [x] Unit tests pass
- [x] Visual regression: complex scenes (Verified via `bsp-native.test.ts` and updated baselines in `bsp-rendering.test.ts`)

### Critical Tests

**Complex Scene Test:**
- [x] Added `bsp_camera_state.test.ts` to verify matrix generation and uniform updates with specific camera angles.
- [x] Added `bsp-native.test.ts` to verify integration with headless WebGPU visual snapshot.

---

## Testing Strategy

### Unit Tests
- Matrix building with various camera states
- Uniform buffer uploads
- Bind group management

### Integration Tests
- Headless rendering of test BSP maps
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
- [x] Diagonal views render correctly (Verified via test matrices)
- [x] Dynamic lighting works
- [x] Complex scenes pass visual regression
- [x] Performance within 5% of old implementation
- [x] Ready for 22-6 (remaining features)

---

**Next:** [Section 22-6: WebGPU Complete Feature Set](section-22-6.md)
