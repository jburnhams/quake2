# Section 20-17: Performance Profiling Infrastructure

**Phase:** 5 (Integration)
**Priority:** LOW
**Dependencies:** 20-15 (Complete renderer)
**Estimated Effort:** 2-3 days

---

## Overview

Add performance profiling tools for measuring and optimizing WebGPU renderer.

---

## Tasks

### Task 1: GPU Timestamp Queries

**File:** `webgpu/profiling.ts`

```typescript
class GPUProfiler {
  beginQuery(label: string): void
  endQuery(label: string): void
  getResults(): Promise<Map<string, number>>  // label -> time in ms
}
```

**Subtasks:**
1. Use timestamp queries (if available)
2. Measure individual render passes
3. Measure pipeline dispatch times
4. Aggregate statistics

### Task 2: Resource Tracking

Extend GPUResourceTracker:
- Real-time memory usage
- Buffer/texture counts
- Bind group cache stats
- Pipeline count

### Task 3: Frame Statistics

**Subtasks:**
1. Draw call count
2. Triangle count
3. State changes
4. Texture bindings

### Task 4: Profiling UI Integration

Export profiling data for rendering in debug UI.

### Task 5: Benchmarking Suite

**File:** `tests/benchmarks/webgpu-performance.test.ts`

Automated performance tests for regression detection.

**Test Cases:**
- Timestamp queries work
- Memory tracking accurate
- Stats exported correctly
- Benchmarks detect regressions

---

**Next Section:** [20-18: Compute Shaders - Particle Systems](section-20-18.md)
