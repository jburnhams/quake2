# Section 22-6: WebGPU Complete Feature Set

**Phase:** 2 (WebGPU Migration)
**Effort:** 3-4 days
**Dependencies:** 22-5 (BSP pattern established)
**Merge Safety:** Feature flag per pipeline

---

## Overview

Complete WebGPU feature parity by migrating remaining pipelines to use `CameraState`. **Completes Sections 20-9 through 20-14** with correct architecture.

**Pipelines to Migrate:**
- MD2 character models
- MD3 skeletal models
- Particle systems
- Dynamic lighting (complete)
- Post-processing effects
- Debug rendering

---

## Tasks

### Task 1: MD2 Model Pipeline

**File:** `packages/engine/src/render/webgpu/pipelines/md2Pipeline.ts`

**Apply CameraState pattern:**
- Accept `cameraState` instead of matrices
- Use `WebGPUMatrixBuilder` internally
- Update shader if coordinate transforms exist
- Frame interpolation unchanged

**Tests:**
- Character model renders at all angles
- Frame interpolation smooth
- Visual regression baseline

**Reference:** Section 20-9 (incomplete)

---

### Task 2: MD3 Model Pipeline

**File:** `packages/engine/src/render/webgpu/pipelines/md3.ts`

**Apply CameraState pattern:**
- Skeletal animation in Quake space
- Matrices handle transforms
- Per-surface materials

**Tests:**
- Multi-part models render correctly
- Tag attachments positioned correctly
- Visual regression baseline

**Reference:** Section 20-10 (incomplete)

---

### Task 3: Particle System

**File:** `packages/engine/src/render/webgpu/pipelines/particleSystem.ts`

**Apply CameraState pattern:**
- Particle positions in Quake space
- Billboard orientation from camera
- Matrix transforms handle coordinate conversion

**Tests:**
- Particles render at all camera angles
- Billboard always faces camera
- Performance acceptable (many particles)

**Reference:** Section 20-11 (incomplete)

---

### Task 4: Dynamic Lighting (Complete)

**File:** `packages/engine/src/render/webgpu/pipelines/bspPipeline.ts` (extend)

**Ensure lighting calculations use consistent coordinates:**
- Light positions in Quake space
- Transform via matrices (not manually)
- Attenuation calculations unchanged

**Tests:**
- Multiple lights render correctly
- Light culling works
- Diagonal views don't break lighting

**Reference:** Section 20-12 (incomplete)

---

### Task 5: Post-Processing

**File:** `packages/engine/src/render/webgpu/pipelines/postProcess.ts`

**Post-processing is screen-space (coordinate-independent):**
- Underwater warp effect
- Bloom effect
- No camera matrix dependencies

**Minor updates:**
- Accept `FrameRenderOptions` for consistency
- Extract needed data (time, flags)

**Tests:**
- Effects render correctly
- No coordinate artifacts

**Reference:** Section 20-13 (incomplete)

---

### Task 6: Debug Rendering

**File:** `packages/engine/src/render/webgpu/pipelines/debug.ts`

**Debug visualization uses CameraState:**
- Wireframe overlay
- Bounding boxes
- Normals visualization
- PVS visualization

**Tests:**
- Debug overlays render correctly
- Toggleable without performance impact

**Reference:** Section 20-14 (incomplete)

---

## Validation

### Pre-Merge Checklist
- [x] All 6 pipelines use CameraState (MD2 Complete)
- [ ] No manual coordinate transforms in shaders
- [ ] Feature flags for each pipeline
- [ ] Unit tests for each pipeline
- [ ] Integration tests with combined pipelines
- [ ] Visual regression baselines (50+ images)

### Integration Test

**Full Scene Rendering:**
```typescript
test('complete scene renders correctly', async () => {
  const camera = new Camera(800, 600);
  camera.setPosition(100, 200, 50);
  camera.setRotation(30, 135, 0);

  const renderer = await createWebGPURenderer();

  renderer.renderFrame({
    camera,
    cameraState: camera.toState(),
    world: testBspWorld,
    sky: { cubemap: testSky },
    dlights: [testLight1, testLight2],
    entities: [md2Character, md3Weapon],
  }, []);

  const output = await captureFramebuffer(renderer);
  await expectSnapshot(output).toMatchBaseline('full-scene-diagonal.png');
});
```

---

## Testing Strategy

### Per-Pipeline Tests
- Unit tests with mocked GPU
- Integration tests with headless rendering
- Visual regression for each feature

### Combined Tests
- Multiple pipelines in single frame
- Complex scenes
- Performance benchmarks

### Visual Regression Coverage
- Skybox + BSP
- BSP + MD2 + Lighting
- Everything combined
- All camera angles
- Edge cases (no sky, no entities, etc.)

---

## Documentation

**Update:** `packages/engine/src/render/webgpu/README.md`

```markdown
## WebGPU Renderer Architecture (Section 22)

All pipelines use `CameraState` to build native WebGPU matrices:
- Skybox (22-4)
- BSP Surfaces (22-5)
- MD2 Models (22-6)
- MD3 Models (22-6)
- Particles (22-6)
- Dynamic Lighting (22-6)
- Post-Processing (22-6)
- Debug Rendering (22-6)

### Coordinate System
- Input: Quake-space CameraState
- Matrices: Built by WebGPUMatrixBuilder
- Shaders: Receive transformed data (no manual conversion)
```

---

## Success Criteria

- [ ] All pipelines migrated to CameraState
- [ ] 100% feature parity with WebGL
- [ ] Diagonal view bug fixed across all features
- [ ] 50+ visual regression tests passing
- [ ] Performance within 5% of baseline
- [ ] WebGPU renderer production-ready
- [ ] Ready for Phase 3 (WebGL migration)

---

**Next:** [Section 22-7: WebGL Adapter Layer](section-22-7.md)
