# Section 22-0: Renderer Architecture Refactoring - Overview

**Project:** Quake2TS Renderer Abstraction Layer
**Status:** Planning
**Last Updated:** 2025-12-27

---

## Executive Summary

This refactoring addresses a fundamental architectural issue: the current renderer abstraction boundary is **too low-level and GL-specific**. The game engine passes GL-convention matrices and coordinates to all renderers, forcing WebGPU (and future renderers) to add conversion layers that fail in edge cases.

**The Core Problem:**
- `Camera` class outputs GL-space view/projection matrices
- WebGPU renderer receives GL matrices, applies additional transforms
- Double-transformation causes diagonal view artifacts
- No clean boundary between game logic and rendering backend

**The Solution:**
- Define API-agnostic `CameraState` interface (Quake-space data only)
- Each renderer builds its own view/projection matrices
- Clean separation enables: testing renderers, raytracing, Vulkan backends
- Incremental migration path preserves existing functionality

---

## Document Structure

This refactoring is divided into **13 sections** organized in **5 phases**:

| Section | Component | Effort | Phase | Dependencies |
|---------|-----------|--------|-------|--------------|
| [22-1](section-22-1.md) | Core Interfaces & CameraState | 1 day | 1 | None |
| [22-2](section-22-2.md) | Matrix Builders & Coordinate Systems | 1 day | 1 | 22-1 |
| [22-3](section-22-3.md) | Null & Logging Renderers | 1 day | 1 | 22-1 |
| [22-4](section-22-4.md) | WebGPU Skybox (Native) | 1-2 days | 2 | 22-1, 22-2 |
| [22-5](section-22-5.md) | WebGPU BSP Pipeline (Native) | 2-3 days | 2 | 22-1, 22-2 |
| [22-6](section-22-6.md) | WebGPU Complete Feature Set | 3-4 days | 2 | 22-5 |
| [22-7](section-22-7.md) | WebGL Adapter Layer | 1-2 days | 3 | 22-1, 22-2 |
| [22-8](section-22-8.md) | WebGL Native Matrix Building | 2-3 days | 3 | 22-7 |
| [22-9](section-22-9.md) | Pipeline Utilities & Shared Code | 1-2 days | 4 | 22-5, 22-8 |
| [22-10](section-22-10.md) | Visual Regression & Integration Tests | 2 days | 4 | 22-6, 22-8 |
| [22-11](section-22-11.md) | Performance Validation | 1 day | 4 | 22-10 |
| [22-12](section-22-12.md) | Cleanup & Deprecation | 1 day | 5 | 22-8 |
| [22-13](section-22-13.md) | Future Renderers (Stretch) | N/A | 6 | 22-12 |

**Total Effort:** 17-24 days (2.5-4 weeks with 1-2 developers)

---

## Motivation & Background

### Current Architecture Issues

**Problem 1: Double Coordinate Transformation**
```
Quake Game Data (X forward, Y left, Z up)
    ↓
Camera.updateMatrices() - transforms to GL space
    ↓
GL-space view/projection matrices
    ↓
WebGPU Shader - transforms AGAIN (incorrectly assumes Quake input)
    ↓
Double-transformed coordinates = broken rendering
```

**Evidence:**
- `packages/engine/src/render/camera.ts:296-301` - Quake→GL transform
- `packages/engine/src/render/webgpu/shaders/skybox.wgsl:29-33` - Second transform
- Diagonal camera views produce incorrect results
- Axis-aligned views work by accident

**Problem 2: Leaky Abstraction**
- `FrameRenderOptions` passes entire `Camera` object
- Renderers forced to accept GL-convention matrices
- No way to build renderer-native matrices
- Testing requires mocking entire GL pipeline

**Problem 3: Tight Coupling**
- Cannot easily add logging/null renderers for testing
- Raytracing renderer would need GL→ray conversion
- Vulkan backend would fight coordinate conventions

### Desired Architecture

```
Quake Game Data
    ↓
CameraState (position, angles, FOV - pure data)
    ↓
    ├─→ WebGL Renderer → builds GL matrices → renders
    ├─→ WebGPU Renderer → builds WebGPU matrices → renders
    ├─→ Logging Renderer → logs calls → validation
    └─→ Raytracing Renderer → builds rays → renders
```

**Benefits:**
- Each renderer uses native coordinate systems
- Clean boundary for testing (mock CameraState, not matrices)
- Future-proof for new rendering backends
- Fixes WebGPU diagonal view bug

---

## Migration Strategy

### Phase 1: Foundation (3 days)
**Goal:** Create new interfaces without breaking existing code

- Define `CameraState` interface (pure Quake-space data)
- Implement matrix builder utilities (WebGL, WebGPU conventions)
- Build null & logging renderers for testing
- **Safety:** All additive, zero breaking changes

### Phase 2: WebGPU Migration (5-9 days)
**Goal:** Rebuild WebGPU renderer using new architecture

- Supersedes incomplete Section 20-7+ (skybox, BSP, etc.)
- Implement native WebGPU coordinate conventions
- Remove double-transformation bugs
- Achieve full feature parity with WebGL
- **Safety:** Feature flag toggles old/new WebGPU implementation

### Phase 3: WebGL Adapter (3-5 days)
**Goal:** Add adapter layer to WebGL without breaking behavior

- Create `WebGLCameraAdapter` (converts CameraState → GL matrices)
- WebGL renderer uses adapter (maintains exact current behavior)
- Validate with visual regression tests (pixel-perfect match)
- **Safety:** Adapter ensures zero visual changes

### Phase 4: Consolidation (4-5 days)
**Goal:** Optimize and validate both renderers

- Extract shared pipeline utilities
- Comprehensive integration & visual regression testing
- Performance benchmarking vs baseline
- **Safety:** Extensive test coverage gates each change

### Phase 5: Cleanup (1 day)
**Goal:** Remove deprecated code paths

- Migrate WebGL to native matrix building (remove adapter)
- Delete old Camera.updateMatrices() GL-specific code
- Update all call sites to use CameraState
- **Safety:** Only after Phase 4 validation complete

### Phase 6: Future Work (Stretch)
**Goal:** Enable new renderer types

- Raytracing renderer prototype
- Vulkan/Metal native backends (via wgpu-native)
- Advanced logging/profiling renderers

---

## Parallelization Strategy

### Can Work Simultaneously

**After Phase 1 Complete:**
- 22-4 (WebGPU Skybox) and 22-7 (WebGL Adapter) - independent
- 22-5 (WebGPU BSP) and 22-8 (WebGL Native) - independent

**After Phase 2 Complete:**
- 22-9 (Shared Utilities), 22-10 (Visual Tests), 22-11 (Performance)

### Must Be Sequential

```
22-1 → 22-2 → 22-3 (Phase 1 foundation)
22-2 → 22-4 → 22-5 → 22-6 (WebGPU migration path)
22-2 → 22-7 → 22-8 (WebGL migration path)
22-6 + 22-8 → 22-9 → 22-10 → 22-11 (consolidation)
22-11 → 22-12 (cleanup only after validation)
```

---

## Relationship to Section 20 (WebGPU Implementation)

**Section 20 Status:**
- ✅ 20-1 to 20-6: Complete (context, resources, testing, sprites, frame)
- ✅ 20-7: Skybox complete but **architecturally flawed** (double-transform)
- ⚠️ 20-8+: BSP and beyond partially complete with same issues

**Section 22 Approach:**
- **Preserves:** All infrastructure from 20-1 to 20-6
- **Replaces:** Sections 20-7+ with correct architecture
- **Extends:** Adds WebGL migration (not covered in Section 20)
- **Outcome:** Clean foundation for completing WebGPU feature parity

**Migration Path:**
1. Complete Section 22-1 to 22-3 (new interfaces)
2. Replace 20-7 skybox with 22-4 (native WebGPU)
3. Complete 20-8+ BSP work via 22-5 (native WebGPU)
4. Extend to WebGL via 22-7 to 22-8
5. Deprecate old coordinate transform code

---

## Testing Strategy

### Unit Tests (Per Section)
- Mock `CameraState` for isolated renderer testing
- Mock GPU device APIs (WebGL, WebGPU)
- Test matrix builders with known inputs/outputs
- Located in `packages/engine/tests/render/`

### Integration Tests (Headless Rendering)
- Use existing `@webgpu/dawn` (WebGPU) and headless GL (WebGL)
- Render test scenes, validate framebuffer output
- Located in `packages/engine/tests/render/integration/`

### Visual Regression Tests
- **Existing Framework:** 10% hard fail, 0.1% soft fail thresholds
- Baseline images in `packages/engine/tests/render/baselines/`
- Compare WebGL old vs WebGL new (must match perfectly)
- Compare WebGPU old vs WebGPU new (diagonal views should fix)
- Generate side-by-side diff images on failure

### Performance Tests
- Frame time measurements (must not regress >5%)
- GPU memory usage tracking
- Draw call counts
- Non-blocking (informational, not gates)

### Null/Logging Renderer Tests
- Validate call sequences without GPU
- Fast, deterministic testing
- Useful for CI/CD environments

---

## Acceptance Criteria

### Phase 1 Complete
- [ ] `CameraState` interface defined and documented
- [ ] Matrix builders pass unit tests (GL, WebGPU, identity transforms)
- [ ] Null renderer validates call sequences
- [ ] Logging renderer outputs human-readable render commands
- [ ] Zero breaking changes to existing renderers

### Phase 2 Complete
- [ ] WebGPU skybox renders without double-transform
- [ ] WebGPU diagonal camera views render correctly
- [ ] Visual regression: new WebGPU matches expected output
- [ ] All Section 20-7+ features reimplemented (BSP, MD2, MD3, particles, lighting)
- [ ] Feature flag allows old/new WebGPU toggle

### Phase 3 Complete
- [ ] WebGL adapter layer functional
- [ ] Visual regression: WebGL new matches WebGL old (pixel-perfect)
- [ ] Zero visual differences in test suite
- [ ] Performance within 5% of baseline

### Phase 4 Complete
- [ ] Shared utilities reduce code duplication >20%
- [ ] Integration tests cover all renderer combinations
- [ ] Visual regression baseline established (50+ test images)
- [ ] Performance validated across both renderers

### Phase 5 Complete
- [ ] WebGL uses native matrix building
- [ ] Old `Camera.updateMatrices()` GL code deleted
- [ ] All deprecated code paths removed
- [ ] Documentation updated

### Overall Success
- [ ] Zero visual regressions vs baseline
- [ ] WebGPU diagonal view bug fixed
- [ ] Both renderers use CameraState interface
- [ ] Clean boundary for future renderers
- [ ] Test suite runs <2 minutes locally
- [ ] All sections merged to main

---

## File Structure Changes

### New Files (Additive)

```
packages/engine/src/render/
├── types/
│   ├── camera.ts                    # CameraState interface
│   ├── renderer.ts                  # Shared renderer types
│   └── coordinates.ts               # Coordinate system docs
├── matrix/
│   ├── builders.ts                  # Matrix builder utilities
│   ├── webgl.ts                     # GL-specific builders
│   ├── webgpu.ts                    # WebGPU-specific builders
│   └── transforms.ts                # Coordinate transforms
├── null/
│   ├── renderer.ts                  # Null renderer (no-op)
│   └── validator.ts                 # Call sequence validation
├── logging/
│   ├── renderer.ts                  # Logging renderer
│   └── formatter.ts                 # Pretty-print commands
└── adapters/
    └── webglCamera.ts               # WebGL adapter (Phase 3)

packages/test-utils/src/engine/
├── camera.ts                        # Mock CameraState factory
├── renderers.ts                     # Test renderer utilities
└── assertions.ts                    # Custom test matchers

packages/engine/tests/render/
├── matrix/
│   ├── builders.test.ts
│   ├── webgl.test.ts
│   └── webgpu.test.ts
├── integration/
│   ├── camera-state.test.ts
│   ├── webgl-migration.test.ts
│   └── webgpu-migration.test.ts
└── visual/
    ├── diagonal-views.test.ts       # Regression test for bug
    └── baselines/                   # PNG baseline images
```

### Modified Files (Minimal, Adapters Only)

```
packages/engine/src/render/
├── camera.ts                        # Add .toState() method
├── interface.ts                     # Update FrameRenderOptions
├── webgl/renderer.ts                # Use adapter (Phase 3)
├── webgpu/renderer.ts               # Use CameraState (Phase 2)
├── webgpu/pipelines/skybox.ts       # Remove coordinate transform
└── webgpu/shaders/skybox.wgsl       # Remove transform (line 29-33)
```

### Deleted Files (Phase 5 Only)

```
packages/engine/src/render/
└── adapters/webglCamera.ts          # After WebGL native migration
```

---

## Risk Mitigation

### Risk 1: Breaking WebGL Rendering
**Mitigation:**
- Phase 3 uses adapter to guarantee identical behavior
- Visual regression tests ensure pixel-perfect match
- Can delay Phase 5 indefinitely if needed

### Risk 2: WebGPU Performance Regression
**Mitigation:**
- Native matrix building should be faster (fewer ops)
- Benchmark each phase against baseline
- Accept small regressions (<5%) for correctness

### Risk 3: Test Maintenance Burden
**Mitigation:**
- Null/logging renderers reduce need for GPU mocks
- Baseline images committed to repo (deterministic)
- Threshold-based comparison allows minor FP differences

### Risk 4: Incomplete Migration
**Mitigation:**
- Each section is merge-safe (feature flags)
- Can ship Phase 1-2 without touching WebGL
- Incremental value delivery

### Risk 5: Future Renderer Complexity
**Mitigation:**
- Section 22-13 provides guidance, not rigid spec
- Real-world usage will inform final API
- Raytracing prototype validates design

---

## Success Metrics

### Quantitative
- Zero visual regression test failures
- Frame time within 5% of baseline
- Code coverage >85% for new matrix builders
- Integration test suite runs <2 minutes

### Qualitative
- WebGPU diagonal view bug fixed
- Clean `CameraState` API enables mock-free testing
- Logging renderer aids debugging in production
- Developers can add new renderers without modifying Camera

---

## Getting Started

### Prerequisites
```bash
# All dependencies already installed from Section 20
# No new dependencies required for Phase 1-2
```

### Recommended Workflow

1. **Read sections in order:**
   - Start with 22-1 (interfaces are foundation)
   - Complete Phase 1 before branching out

2. **Branch strategy:**
   ```bash
   git checkout -b feat/renderer-refactor-22-1
   # Complete 22-1, merge to main
   git checkout -b feat/renderer-refactor-22-2
   # Complete 22-2, merge to main
   # etc.
   ```

3. **Testing strategy:**
   - Write tests first (TDD where appropriate)
   - Run visual regression after each section
   - Use logging renderer to debug issues

4. **Review checkpoints:**
   - Architectural review after Phase 1 (critical API decisions)
   - Visual review of regression test baselines
   - Performance review after Phase 4

### First Steps

```bash
# Create new directory structure
cd quake2ts/packages/engine/src/render
mkdir -p types matrix null logging adapters

# Begin Section 22-1
# Follow section-22-1.md for detailed tasks
```

---

## Timeline Estimate

**With 1 Developer (Sequential):**
- Phase 1: 3 days (foundation)
- Phase 2: 9 days (WebGPU migration)
- Phase 3: 5 days (WebGL adapter)
- Phase 4: 5 days (consolidation)
- Phase 5: 1 day (cleanup)
- **Total:** 23 days (~4.5 weeks)

**With 2 Developers (Parallel):**
- Phase 1: 3 days (sequential, must complete first)
- Phase 2 & 3: 9 days (parallel: one does WebGPU, one does WebGL)
- Phase 4: 5 days (sequential, both developers)
- Phase 5: 1 day (sequential)
- **Total:** 18 days (~3.5 weeks)

---

## Appendix: Key Concepts

### Coordinate System Conventions

**Quake (Game Engine):**
- +X: Forward
- +Y: Left
- +Z: Up
- Right-handed

**OpenGL/WebGL:**
- +X: Right
- +Y: Up
- +Z: Back (toward camera)
- Right-handed
- NDC: [-1, 1] for X, Y, Z

**WebGPU:**
- +X: Right
- +Y: Up
- +Z: Forward (away from camera)
- Left-handed
- NDC: [-1, 1] for X, Y; [0, 1] for Z

**Metal/Vulkan:**
- Similar to WebGPU but with variations
- Future renderers will need specific builders

### The Double-Transform Bug

**What happens now:**
```glsl
// 1. Camera.ts transforms Quake → GL
const quakeToGl = mat4(
   0,  0, -1, 0,  // Quake X → GL -Z
  -1,  0,  0, 0,  // Quake Y → GL -X
   0,  1,  0, 0   // Quake Z → GL Y
);

// 2. WebGPU shader transforms again
output.direction = vec3<f32>(-dir.y, dir.z, -dir.x);
// Expects Quake input, gets GL input → DOUBLE TRANSFORM
```

**What should happen:**
```typescript
// WebGPU renderer builds native matrices from CameraState
const view = buildWebGPUViewMatrix(cameraState);
// Shader uses direction directly (no transform)
output.direction = dir;
```

---

**Next Steps:** Begin with [Section 22-1: Core Interfaces & CameraState](section-22-1.md)
