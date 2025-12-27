# Section 22-2: Matrix Builders & Coordinate Systems

**Phase:** 1 (Foundation)
**Effort:** 1 day
**Dependencies:** 22-1 (CameraState interface)
**Merge Safety:** 100% additive, utility functions only

---

## Overview

Implement matrix builder utilities that convert `CameraState` (Quake-space) into renderer-specific view and projection matrices. Provides correct transformations for WebGL, WebGPU, and identity (for testing).

**Key Output:** `buildViewMatrix()` and `buildProjectionMatrix()` functions for each coordinate system.

---

## Tasks

### Task 1: Core Matrix Builder Interface (Completed)

**File:** `packages/engine/src/render/matrix/builders.ts` (Created)

Defined builder interface and helper function.

**Tests:**
- [x] Unit test: `buildMatrices()` multiplies in correct order (proj * view)
- [x] Unit test: Matrices are distinct objects (no aliasing)

---

### Task 2: WebGL Matrix Builder (Completed)

**File:** `packages/engine/src/render/matrix/webgl.ts` (Created)

Implemented GL-specific builder extracting logic from `Camera.updateMatrices`.

**Tests:**
- [x] Unit test: View matrix for [0,0,0] position, [0,0,0] angles is identity (after coord transform)
- [x] Unit test: Projection matrix with fov=90, aspect=1 has correct values
- [x] Unit test: Output matches current Camera.viewMatrix for known inputs

---

### Task 3: WebGPU Matrix Builder (Completed)

**File:** `packages/engine/src/render/matrix/webgpu.ts` (Created)

Implemented WebGPU-specific builder with native coordinates.

**Tests:**
- [x] Unit test: Projection matrix has [0, 1] depth range (not [-1, 1])
- [x] Unit test: View matrix for diagonal views produces correct transform
- [x] Unit test: No double-transformation

---

### Task 4: Identity Matrix Builder (Testing) (Completed)

**File:** `packages/engine/src/render/matrix/identity.ts` (Created)

Builder that returns Quake-space matrices (for testing/debugging).

**Tests:**
- [x] Unit test: Returns simple matrices without coordinate transforms
- [x] Unit test: Useful for test assertions (readable values)

---

### Task 5: Coordinate Transform Utilities (Completed)

**File:** `packages/engine/src/render/matrix/transforms.ts` (Created)

Helper functions for coordinate conversions.

**Tests:**
- [x] Unit test: Round-trip transforms preserve values
- [x] Unit test: Known coordinate conversions correct
- [x] Unit test: Debug output is readable

---

## Validation

### Pre-Merge Checklist
- [x] All builder classes implement `MatrixBuilder` interface
- [x] WebGL builder produces identical output to current `Camera.updateMatrices()`
- [x] WebGPU builder uses native coordinates (no double-transform)
- [x] Identity builder useful for testing
- [x] Transform utilities have unit tests
- [x] Visual regression tests pass (WebGL unchanged)
- [x] TypeScript compiles without errors

### Critical Validation

**WebGL Compatibility:**
- Confirmed pixel-identical output to current implementation via integration tests.

**WebGPU Correctness:**
- Confirmed projection range [0, 1].
- Confirmed coordinate transform logic matches expected WebGPU conventions.

---

## Testing Strategy

All new files have associated unit tests in `packages/engine/tests/render/matrix/`.
Integration validation performed in `packages/engine/tests/render/integration/matrix-builders.test.ts`.

---

**Next:** [Section 22-3: Null & Logging Renderers](section-22-3.md)
