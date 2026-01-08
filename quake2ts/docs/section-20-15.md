# Section 20-15: Extended Renderer Interface

## ⏳ NOT STARTED

**Status:** Future work - Phase 5 (Integration)

**Prerequisites:**
- Sections 20-7 to 20-12 ✅ COMPLETED (Core pipelines)
- Section 20-13 (Post-Processing) ⏳ NOT STARTED
- Section 20-14 (Debug Rendering) ⏳ NOT STARTED

**Scope Notes:**
- This section finalizes the IWebGPURenderer interface with WebGPU-specific extensions
- Adds compute shader dispatch method (for Phase 6)
- Adds capability queries and performance timestamp queries
- Requires Sections 20-13 and 20-14 to be completed first

**Section 22 Context:**
- The CameraState architecture from Section 22 provides the foundation
- `createWebGPURenderer()` factory exists but may need extension for additional pipelines

---

**Phase:** 5 (Integration)
**Priority:** MEDIUM
**Dependencies:** 20-7 to 20-14 (All pipelines complete)
**Estimated Effort:** 2-3 days

---

## Overview

Finalize the WebGPU renderer interface with extensions for WebGPU-specific features.

---

## Tasks

### Task 1: Complete IWebGPURenderer Interface

**File:** `packages/engine/src/render/interface.ts` (extend)

```typescript
export interface IWebGPURenderer extends IRenderer {
  // Compute shader dispatch (for Phase 6)
  dispatchCompute(pipeline: ComputePipeline, workgroups: [number, number, number]): void;

  // Query capabilities
  getCapabilities(): WebGPUCapabilities;

  // Performance queries
  getTimestampResults(): Promise<number[]>;

  // Debug utilities
  captureFrame(): Promise<GPUCommandBuffer>;
}
```

### Task 2: Factory Completeness

Ensure `createWebGPURenderer()` initializes all pipelines and returns complete renderer.

### Task 3: Feature Parity Validation

Checklist of all WebGL features implemented in WebGPU.

### Task 4: Documentation

Update API documentation with WebGPU-specific features.

**Test Cases:**
- All IRenderer methods work
- Extended methods available
- Feature parity with WebGL
- API documentation complete

---

**Next Section:** [20-16: Integration & Visual Regression Testing](section-20-16.md)
