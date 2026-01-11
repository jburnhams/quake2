# Section 20-17: Performance Profiling Infrastructure

## ✅ COMPLETED

**Summary:** Implemented WebGPU performance profiling infrastructure with GPU timestamp queries (when supported), CPU frame timing, frame statistics collection (draw calls, vertices, batches, shader switches, culling), extended resource tracking (pipelines, bind groups, samplers), profiling data export for debug UI, and a comprehensive benchmarking test suite.

**Work Completed:**
- Created `profiling.ts` with `WebGPUProfiler` class supporting:
  - GPU timestamp queries (when device supports `timestamp-query` feature)
  - CPU frame timing with smoothed moving averages
  - Frame statistics recording (draw calls, vertices, batches, shader switches)
  - Visibility culling statistics (surfaces and entities)
  - Performance report generation with memory usage
- Extended `GPUResourceTracker` with `ProfilingResourceTracker`:
  - Pipeline count tracking
  - Bind group count tracking
  - Sampler count tracking
  - Summary generation
- Integrated profiler with `WebGPURendererImpl`:
  - `getPerformanceReport()` returns detailed statistics
  - `getMemoryUsage()` returns GPU memory usage
  - `getTimestampResults()` returns GPU timing results
- Created `exportProfilingData()` utility for debug UI integration
- Created unit tests (`tests/webgpu/profiling.test.ts`)
- Created benchmarking suite (`tests/benchmarks/webgpu-performance.test.ts`)

---

**Phase:** 5 (Integration)
**Priority:** LOW
**Dependencies:** 20-15 (Complete renderer) ✅
**Estimated Effort:** 2-3 days
**Actual Effort:** < 1 day

---

## Overview

Performance profiling tools for measuring and optimizing WebGPU renderer.

---

## Tasks

### Task 1: GPU Timestamp Queries ✅

**File:** `webgpu/profiling.ts`

```typescript
class WebGPUProfiler {
  startFrame(): void
  endFrame(encoder: GPUCommandEncoder): void
  writeTimestamp(encoder: GPUCommandEncoder, label: string): void
  getTimestampResults(): number[]
  pollResults(): Promise<void>
}
```

**Implemented Features:**
1. ✅ Timestamp queries (when `timestamp-query` feature available)
2. ✅ Measure individual render passes via labels
3. ✅ Async GPU->CPU result readback with ring buffer
4. ✅ Graceful degradation when timestamps not supported

### Task 2: Resource Tracking ✅

Extended GPUResourceTracker with `ProfilingResourceTracker`:
- ✅ Real-time memory usage (totalBufferMemory, totalTextureMemory)
- ✅ Buffer/texture counts
- ✅ Pipeline count tracking
- ✅ Bind group count tracking
- ✅ Sampler count tracking
- ✅ Summary generation

### Task 3: Frame Statistics ✅

**Implemented Statistics:**
1. ✅ Draw call count
2. ✅ Vertex/triangle count
3. ✅ Batch count
4. ✅ Shader switches
5. ✅ Visible/culled surfaces
6. ✅ Visible/culled entities
7. ✅ Smoothed frame time (moving average)

### Task 4: Profiling UI Integration ✅

**Export functionality implemented:**
- `exportProfilingData()` creates snapshot for debug UI
- Returns timestamp, frame time, GPU time, draw calls, triangles, memory usage, pass timings

### Task 5: Benchmarking Suite ✅

**File:** `tests/benchmarks/webgpu-performance.test.ts`

Automated performance tests for regression detection:
- ✅ Profiler overhead benchmarks
- ✅ Statistics recording benchmarks
- ✅ Resource tracking benchmarks
- ✅ Rendering with profiling benchmarks
- ✅ Export and reporting benchmarks
- ✅ Regression detection tests

---

## Usage

### Basic Profiling

```typescript
import { WebGPUProfiler } from './render/webgpu/profiling.js';

const profiler = new WebGPUProfiler(device);

// In render loop
profiler.startFrame();

const encoder = device.createCommandEncoder();
profiler.writeTimestamp(encoder, 'opaque-start');

// ... render opaque pass
profiler.recordDrawCall(vertexCount);

profiler.writeTimestamp(encoder, 'opaque-end');
profiler.endFrame(encoder);

device.queue.submit([encoder.finish()]);

// Get results (async)
await profiler.pollResults();
const report = profiler.getPerformanceReport();
console.log(`Frame time: ${report.frameTimeMs}ms`);
```

### Resource Tracking

```typescript
import { ProfilingResourceTracker, setResourceTracker } from './render/webgpu/resources.js';

const tracker = new ProfilingResourceTracker();
setResourceTracker(tracker);

// Resources are automatically tracked
const texture = new Texture2D(device, { width: 256, height: 256 });
const buffer = new VertexBuffer(device, { size: 1024 });

// Get summary
const summary = tracker.getSummary();
console.log(`Textures: ${summary.textureCount}, Memory: ${summary.textureMemory} bytes`);
```

---

## Running Tests

```bash
cd quake2ts/packages/engine

# Run profiling unit tests
pnpm run test:unit tests/unit-node/webgpu/profiling.test.ts

# Run benchmark suite
pnpm run test:unit tests/benchmarks/webgpu-performance.test.ts
```

**Note:** WebGPU tests require Vulkan drivers (lavapipe on Linux). Tests gracefully skip when WebGPU is unavailable.

---

**Next Section:** [20-18: Compute Shaders - Particle Systems](section-20-18.md)
