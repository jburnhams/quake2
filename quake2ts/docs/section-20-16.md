# Section 20-16: Integration & Visual Regression Testing

## ⏳ NOT STARTED

**Status:** Future work - Phase 5 (Integration)

**Prerequisites:**
- Section 20-15 (Extended Renderer Interface) ⏳ NOT STARTED
- All rendering pipelines complete

**Scope Notes:**
- Comprehensive integration test suite for WebGPU renderer
- Establishes 30+ visual regression baseline snapshots
- Side-by-side WebGL vs WebGPU comparison tests
- Performance baseline establishment

**Existing Infrastructure:**
- Section 20-3 and 20-4 provide headless testing and PNG snapshot foundations
- Can build upon existing test patterns from unit tests

---

**Phase:** 5 (Integration)
**Priority:** MEDIUM
**Dependencies:** 20-15 (Complete renderer)
**Estimated Effort:** 4-5 days

---

## Overview

Comprehensive integration tests and visual regression baseline for production readiness.

---

## Tasks

### Task 1: Integration Test Suite

**File:** `tests/integration/webgpu-rendering.test.ts`

**Tests:**
1. Complete frame rendering (all pipelines)
2. Complex scenes (BSP + models + particles + HUD)
3. Multi-pass rendering
4. Resource lifecycle
5. Error handling and recovery

### Task 2: Visual Regression Baseline

**Establish 30+ baseline snapshots:**

**BSP Rendering (8 tests):**
- Simple geometry
- Complex geometry with lightmaps
- Dynamic lights
- Texture scrolling
- Alpha tested surfaces
- Fullbright surfaces
- Water surfaces
- Sky + BSP combo

**Model Rendering (6 tests):**
- MD2 static
- MD2 animated
- MD2 with dynamic light
- MD3 single surface
- MD3 multi-surface
- MD3 with attachments

**Effects (8 tests):**
- Particles (smoke, explosion, blood)
- Post-processing (underwater, gamma)
- Transparent surfaces
- Additive blending

**Combined Scenes (8 tests):**
- Full game scene
- Multiple entities
- Complex lighting
- All effects together

### Task 3: Side-by-Side Comparison

Create test that renders same scene with WebGL and WebGPU, compares output.

### Task 4: Performance Baseline

Establish performance metrics:
- Frame time
- Draw call count
- GPU memory usage

**Test Cases:**
- All integration tests pass
- All visual regression tests pass
- WebGPU matches WebGL output
- Performance acceptable

---

**Next Section:** [20-17: Performance Profiling Infrastructure](section-20-17.md)
