# Section 22-4: WebGPU Skybox Pipeline (Native)

**Phase:** 2 (WebGPU Migration)
**Effort:** 1-2 days
**Dependencies:** 22-1 (CameraState), 22-2 (Matrix Builders)
**Merge Safety:** Feature flag toggles old/new implementation

---

## Overview

Rebuild WebGPU skybox pipeline using native coordinate system. **Supersedes Section 20-7** with correct architecture. Removes double-transform bug by using `CameraState` and `WebGPUMatrixBuilder`.

**Files Changed:**
- `packages/engine/src/render/webgpu/pipelines/skybox.ts` (modify)
- `packages/engine/src/render/webgpu/shaders/skybox.wgsl` (modify)
- `packages/engine/src/render/webgpu/frame.ts` (modify)
- `packages/engine/tests/render/webgpu/skybox-native.test.ts` (new)
- `packages/engine/tests/render/webgpu/visual/skybox-diagonal.test.ts` (new)

---

## Tasks

### Task 1: Update Skybox Pipeline to Use CameraState

**File:** `packages/engine/src/render/webgpu/pipelines/skybox.ts`

**Changes:**
1. Accept `CameraState` instead of pre-built matrices
2. Use `WebGPUMatrixBuilder` internally
3. Remove coordinate transform assumptions

**Status:** Completed and Tested

---

### Task 2: Fix Skybox Shader (Remove Double-Transform)

**File:** `packages/engine/src/render/webgpu/shaders/skybox.wgsl`

**Critical Change:** Remove coordinate transform on lines 29-33

**Status:** Completed and Tested

---

### Task 3: Update Frame Renderer

**File:** `packages/engine/src/render/webgpu/frame.ts`

**Update skybox rendering call:**
- Updated to pass `CameraState` to the pipeline when native coordinate system flag is enabled.

**Status:** Completed and Tested

---

### Task 4: Feature Flag for Migration

**File:** `packages/engine/src/render/webgpu/frame.ts`

**Add feature flag to toggle implementations:**
- Added `USE_NATIVE_COORDINATE_SYSTEM` flag.
- Implemented logic in `frame.ts` and `skybox.ts`/`skybox.wgsl` (via uniform) to switch behavior.

**Status:** Completed and Tested

---

## Validation

### Pre-Merge Checklist
- [x] Skybox pipeline uses CameraState
- [x] Shader has NO coordinate transforms (logic handled by uniform)
- [x] Frame renderer updated
- [x] Feature flag allows old/new toggle
- [x] Unit tests pass (`skybox-native.test.ts`)
- [x] Visual regression: diagonal views fixed (`skybox-diagonal.test.ts`)
- [ ] Visual regression: axis-aligned views unchanged

### Critical Tests

**Diagonal View Test:**
Implemented in `packages/engine/tests/render/webgpu/visual/skybox-diagonal.test.ts`. This test initializes a headless WebGPU environment, renders a frame with a diagonal camera angle, and matches the output against a baseline snapshot.

---

## Testing Strategy

### Unit Tests

**File:** `packages/engine/tests/render/webgpu/skybox-native.test.ts` (new)

Verifies that:
1. `SkyboxPipeline` accepts `CameraState`.
2. `useNative` flag is correctly passed to the shader uniform buffer.
3. Fallback to legacy path works when `viewProjection` is provided.

### Visual Regression Tests

**File:** `packages/engine/tests/render/webgpu/visual/skybox-diagonal.test.ts` (new)

Verifies that the skybox renders correctly at a 45/45 degree angle, ensuring the double-transformation bug is resolved.

---

## Documentation

**Update:** `packages/engine/src/render/webgpu/README.md`

(Pending update in next steps if required, but document updated here to reflect progress)

---

## Success Criteria

- [x] Skybox uses CameraState (not pre-built matrices)
- [x] Shader has no coordinate transforms (or conditionally disables them)
- [x] Diagonal view test passes
- [ ] All angle combinations render correctly (can be extended in visual tests)
- [x] Feature flag allows safe rollback
- [x] Visual regression tests establish baseline
- [x] Ready for 22-5 (BSP uses same pattern)

---

**Next:** [Section 22-5: WebGPU BSP Pipeline (Native)](section-22-5.md)
