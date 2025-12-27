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

---

### Task 2: Update BSP Shader

**File:** `packages/engine/src/render/webgpu/shaders/bsp.wgsl`

**Remove coordinate transforms (similar to skybox):**

Verify shader assumes matrices already handle coordinate conversion. No inline transforms needed.

**Check for:**
- Normal transformations (should be in matrix already)
- Light direction calculations (use camera position directly)
- No manual coordinate swizzling

---

### Task 3: Update Dynamic Lighting

**Lighting calculations in Quake space:**

Ensure light positions are in consistent coordinate system. The shader receives WebGPU-space data after matrix transform, so light calculations remain unchanged.

**No changes needed** if lights are transformed consistently with geometry.

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

---

## Validation

### Pre-Merge Checklist
- [ ] BSP pipeline uses CameraState
- [ ] Shaders validated (no manual transforms)
- [ ] Dynamic lighting works correctly
- [ ] Feature flag for rollback
- [ ] Unit tests pass
- [ ] Visual regression: complex scenes

### Critical Tests

**Complex Scene Test:**
```typescript
test('BSP geometry renders correctly at diagonal angle', async () => {
  const camera = new Camera(800, 600);
  camera.setPosition(100, 200, 50);
  camera.setRotation(30, 135, 0);

  const world = loadTestBspMap();  // Complex geometry

  const renderer = await createWebGPURenderer();
  renderer.renderFrame({
    camera,
    cameraState: camera.toState(),
    world: {
      map: world.map,
      surfaces: world.surfaces,
      // ... lightmaps, textures, etc.
    }
  }, []);

  const output = await captureFramebuffer(renderer);
  await expectSnapshot(output).toMatchBaseline('bsp-diagonal-complex.png');
});
```

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

- [ ] BSP pipeline uses CameraState
- [ ] Diagonal views render correctly
- [ ] Dynamic lighting works
- [ ] Complex scenes pass visual regression
- [ ] Performance within 5% of old implementation
- [ ] Ready for 22-6 (remaining features)

---

**Next:** [Section 22-6: WebGPU Complete Feature Set](section-22-6.md)
