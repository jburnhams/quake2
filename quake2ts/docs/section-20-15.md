# Section 20-15: Extended Renderer Interface

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
