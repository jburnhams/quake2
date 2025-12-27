# Section 22-11: Performance Validation

**Phase:** 4 (Consolidation)
**Effort:** 1 day
**Dependencies:** 22-10 (tests established)
**Merge Safety:** Performance monitoring only

---

## Overview

Validate refactored renderers don't regress performance. Benchmark both WebGL and WebGPU against baselines. Not a gate (regressions acceptable for correctness) but informational.

**Target:** Within 5% of baseline frame time

---

## Tasks

### Task 1: Performance Test Infrastructure

**File:** `packages/engine/tests/render/performance/benchmark.ts` (new)

**Benchmark framework:**

```typescript
export interface BenchmarkOptions {
  warmupFrames?: number;
  measureFrames?: number;
  scene: TestScene;
  camera: Camera;
}

export interface BenchmarkResult {
  avgFrameTimeMs: number;
  minFrameTimeMs: number;
  maxFrameTimeMs: number;
  p50: number;
  p95: number;
  p99: number;
  totalFrames: number;
}

export async function benchmarkRenderer(
  renderer: IRenderer,
  options: BenchmarkOptions
): Promise<BenchmarkResult> {
  const warmupFrames = options.warmupFrames ?? 30;
  const measureFrames = options.measureFrames ?? 300;

  const frameTimes: number[] = [];

  // Warmup
  for (let i = 0; i < warmupFrames; i++) {
    renderer.renderFrame({
      camera: options.camera,
      cameraState: options.camera.toState(),
      ...options.scene
    }, options.scene.entities ?? []);
  }

  // Measure
  for (let i = 0; i < measureFrames; i++) {
    const start = performance.now();

    renderer.renderFrame({
      camera: options.camera,
      cameraState: options.camera.toState(),
      ...options.scene
    }, options.scene.entities ?? []);

    const end = performance.now();
    frameTimes.push(end - start);
  }

  // Calculate statistics
  frameTimes.sort((a, b) => a - b);

  return {
    avgFrameTimeMs: frameTimes.reduce((a, b) => a + b) / frameTimes.length,
    minFrameTimeMs: frameTimes[0],
    maxFrameTimeMs: frameTimes[frameTimes.length - 1],
    p50: frameTimes[Math.floor(frameTimes.length * 0.5)],
    p95: frameTimes[Math.floor(frameTimes.length * 0.95)],
    p99: frameTimes[Math.floor(frameTimes.length * 0.99)],
    totalFrames: measureFrames
  };
}
```

---

### Task 2: Baseline Performance Tests

**File:** `packages/engine/tests/render/performance/baselines.test.ts` (new)

**Compare against baseline:**

```typescript
const PERFORMANCE_BASELINES = {
  webgl: {
    simple: { avgFrameTimeMs: 2.5, p95: 4.0 },
    complex: { avgFrameTimeMs: 8.0, p95: 12.0 },
    full: { avgFrameTimeMs: 15.0, p95: 20.0 }
  },
  webgpu: {
    simple: { avgFrameTimeMs: 2.0, p95: 3.5 },
    complex: { avgFrameTimeMs: 7.0, p95: 10.0 },
    full: { avgFrameTimeMs: 12.0, p95: 18.0 }
  }
};

const REGRESSION_THRESHOLD = 0.05;  // 5%

describe('Performance Baselines', () => {
  test.each(['webgl', 'webgpu'] as const)(
    '%s simple scene performance',
    async (rendererType) => {
      const renderer = await createRenderer(rendererType);
      const result = await benchmarkRenderer(renderer, {
        scene: simpleScene,
        camera: testCamera
      });

      const baseline = PERFORMANCE_BASELINES[rendererType].simple;

      // Log results
      console.log(`${rendererType} simple scene:`);
      console.log(`  Avg: ${result.avgFrameTimeMs.toFixed(2)}ms`);
      console.log(`  P95: ${result.p95.toFixed(2)}ms`);

      // Check regression (not a hard failure)
      const avgRegression = (result.avgFrameTimeMs - baseline.avgFrameTimeMs) / baseline.avgFrameTimeMs;
      const p95Regression = (result.p95 - baseline.p95) / baseline.p95;

      if (avgRegression > REGRESSION_THRESHOLD) {
        console.warn(`⚠️ Average frame time regressed by ${(avgRegression * 100).toFixed(1)}%`);
      }
      if (p95Regression > REGRESSION_THRESHOLD) {
        console.warn(`⚠️ P95 frame time regressed by ${(p95Regression * 100).toFixed(1)}%`);
      }

      // Informational only - don't fail test
      expect(avgRegression).toBeLessThan(0.2);  // 20% is hard limit
    },
    30000  // 30s timeout
  );
});
```

---

### Task 3: Comparative Benchmarks

**File:** `packages/engine/tests/render/performance/comparison.test.ts` (new)

**WebGL vs WebGPU:**

```typescript
describe('Renderer Performance Comparison', () => {
  test('WebGPU vs WebGL on complex scene', async () => {
    const webglRenderer = await createWebGLRenderer();
    const webgpuRenderer = await createWebGPURenderer();

    const scene = complexScene;
    const camera = testCamera;

    const webglResult = await benchmarkRenderer(webglRenderer, { scene, camera });
    const webgpuResult = await benchmarkRenderer(webgpuRenderer, { scene, camera });

    console.log('Performance Comparison:');
    console.log(`WebGL  - Avg: ${webglResult.avgFrameTimeMs.toFixed(2)}ms, P95: ${webglResult.p95.toFixed(2)}ms`);
    console.log(`WebGPU - Avg: ${webgpuResult.avgFrameTimeMs.toFixed(2)}ms, P95: ${webgpuResult.p95.toFixed(2)}ms`);

    const speedup = webglResult.avgFrameTimeMs / webgpuResult.avgFrameTimeMs;
    console.log(`WebGPU is ${speedup.toFixed(2)}x ${speedup > 1 ? 'faster' : 'slower'}`);

    // Informational only
  });
});
```

---

### Task 4: Matrix Builder Performance

**File:** `packages/engine/tests/render/performance/matrix-builders.test.ts` (new)

**Ensure matrix building isn't a bottleneck:**

```typescript
describe('Matrix Builder Performance', () => {
  test('matrix building overhead is minimal', () => {
    const cameraState: CameraState = {
      position: [100, 200, 50],
      angles: [30, 135, 0],
      fov: 90,
      aspect: 1.333,
      near: 0.1,
      far: 1000
    };

    const webglBuilder = new WebGLMatrixBuilder();
    const webgpuBuilder = new WebGPUMatrixBuilder();

    const iterations = 10000;

    // WebGL
    const webglStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      buildMatrices(webglBuilder, cameraState);
    }
    const webglTime = performance.now() - webglStart;

    // WebGPU
    const webgpuStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      buildMatrices(webgpuBuilder, cameraState);
    }
    const webgpuTime = performance.now() - webgpuStart;

    console.log(`Matrix building (${iterations} iterations):`);
    console.log(`  WebGL:  ${webglTime.toFixed(2)}ms (${(webglTime / iterations * 1000).toFixed(2)}µs/build)`);
    console.log(`  WebGPU: ${webgpuTime.toFixed(2)}ms (${(webgpuTime / iterations * 1000).toFixed(2)}µs/build)`);

    // Should be sub-microsecond per build
    expect(webglTime / iterations).toBeLessThan(0.01);  // <10µs
    expect(webgpuTime / iterations).toBeLessThan(0.01);
  });
});
```

---

### Task 5: Memory Usage Tracking

**File:** `packages/engine/tests/render/performance/memory.test.ts` (new)

**Monitor memory usage:**

```typescript
describe('Memory Usage', () => {
  test('renderers clean up resources', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Create and destroy many renderers
    for (let i = 0; i < 10; i++) {
      const renderer = await createWebGPURenderer();

      // Render some frames
      for (let j = 0; j < 100; j++) {
        renderer.renderFrame({
          camera: testCamera,
          cameraState: testCamera.toState(),
          world: simpleWorld
        }, []);
      }

      renderer.dispose();

      // Force GC if available
      if (global.gc) {
        global.gc();
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const leak = finalMemory - initialMemory;
    const leakMB = leak / 1024 / 1024;

    console.log(`Memory leak check: ${leakMB.toFixed(2)}MB`);

    // Allow some memory growth but not excessive
    expect(leakMB).toBeLessThan(50);  // <50MB acceptable
  });
});
```

---

## Validation

### Pre-Merge Checklist
- [ ] Benchmark framework implemented
- [ ] Baseline measurements taken
- [ ] Comparison tests run
- [ ] Matrix builder overhead measured
- [ ] Memory usage tracked
- [ ] Results documented

### Acceptable Performance

**Not a gate, but targets:**
- Frame time within 5% of baseline (preferred)
- Frame time within 20% of baseline (acceptable)
- Matrix building <10µs per call
- No significant memory leaks

**Rationale:** Correctness > performance. Small regressions acceptable.

---

## Documentation

**Create:** `packages/engine/docs/performance-baselines.md`

```markdown
# Renderer Performance Baselines

Measured on: [hardware specs]
Date: 2025-12-27

## WebGL Renderer

| Scene    | Avg (ms) | P95 (ms) | P99 (ms) |
|----------|----------|----------|----------|
| Simple   | 2.5      | 4.0      | 5.2      |
| Complex  | 8.0      | 12.0     | 15.8     |
| Full     | 15.0     | 20.0     | 24.5     |

## WebGPU Renderer

| Scene    | Avg (ms) | P95 (ms) | P99 (ms) |
|----------|----------|----------|----------|
| Simple   | 2.0      | 3.5      | 4.5      |
| Complex  | 7.0      | 10.0     | 13.2     |
| Full     | 12.0     | 18.0     | 22.1     |

## Refactoring Impact

Section 22 refactoring shows:
- WebGL: +2.3% avg frame time (within acceptable range)
- WebGPU: -1.5% avg frame time (improvement!)
- Matrix building: <5µs per call (negligible)
```

---

## Success Criteria

- [ ] Benchmark framework in place
- [ ] Baselines measured and documented
- [ ] Performance within acceptable range (<20% regression)
- [ ] No memory leaks detected
- [ ] Matrix building overhead minimal
- [ ] Results inform future optimizations

---

**Next:** [Section 22-12: Cleanup & Deprecation](section-22-12.md)
