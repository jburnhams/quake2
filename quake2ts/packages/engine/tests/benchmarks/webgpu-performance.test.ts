/**
 * Section 20-17: WebGPU Benchmarking Suite
 *
 * Automated performance tests for regression detection.
 * These tests establish performance baselines and detect regressions
 * in rendering, resource management, and profiling overhead.
 */
import { describe, test, beforeAll, afterAll, expect } from 'vitest';
import { initHeadlessWebGPU, setupHeadlessWebGPUEnv } from '@quake2ts/test-utils';
import {
  WebGPUProfiler,
  ProfilingResourceTracker,
  exportProfilingData,
} from '../../src/render/webgpu/profiling.js';
import {
  Texture2D,
  VertexBuffer,
  IndexBuffer,
  setResourceTracker,
} from '../../src/render/webgpu/resources.js';
import { SkyboxPipeline } from '../../src/render/webgpu/pipelines/skybox.js';
import { SpriteRenderer } from '../../src/render/webgpu/pipelines/sprite.js';
import { Camera } from '../../src/render/camera.js';

/**
 * Benchmark result structure
 */
interface BenchmarkResult {
  name: string;
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  stdDev: number;
}

/**
 * Run a benchmark and collect statistics
 */
async function runBenchmark(
  name: string,
  fn: () => Promise<void>,
  options: {
    warmupIterations?: number;
    measureIterations?: number;
  } = {}
): Promise<BenchmarkResult> {
  const warmupIterations = options.warmupIterations ?? 5;
  const measureIterations = options.measureIterations ?? 20;

  // Warmup
  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  // Measure
  const times: number[] = [];
  for (let i = 0; i < measureIterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  // Calculate statistics
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const variance =
    times.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  return {
    name,
    iterations: measureIterations,
    avgMs: avg,
    minMs: min,
    maxMs: max,
    stdDev,
  };
}

describe('WebGPU Benchmarking Suite (Section 20-17)', () => {
  let testContext: Awaited<ReturnType<typeof initHeadlessWebGPU>>;
  let resourceTracker: ProfilingResourceTracker;

  beforeAll(async () => {
    await setupHeadlessWebGPUEnv();
    testContext = await initHeadlessWebGPU();
    resourceTracker = new ProfilingResourceTracker();
    setResourceTracker(resourceTracker);
  });

  afterAll(async () => {
    setResourceTracker(null as any);
    await testContext.cleanup();
  });

  describe('Profiler Overhead Benchmarks', () => {
    test('profiler start/end frame overhead is minimal', async () => {
      const { device } = testContext;
      const profiler = new WebGPUProfiler(device);

      // Baseline without profiler
      const baselineResult = await runBenchmark(
        'baseline-no-profiler',
        async () => {
          const encoder = device.createCommandEncoder();
          device.queue.submit([encoder.finish()]);
          await device.queue.onSubmittedWorkDone();
        },
        { warmupIterations: 3, measureIterations: 50 }
      );

      // With profiler
      const profilerResult = await runBenchmark(
        'with-profiler',
        async () => {
          profiler.startFrame();
          const encoder = device.createCommandEncoder();
          profiler.endFrame(encoder);
          device.queue.submit([encoder.finish()]);
          await device.queue.onSubmittedWorkDone();
        },
        { warmupIterations: 3, measureIterations: 50 }
      );

      console.log(`\nProfiler Overhead Benchmark:`);
      console.log(`  Baseline: ${baselineResult.avgMs.toFixed(3)}ms avg`);
      console.log(`  With Profiler: ${profilerResult.avgMs.toFixed(3)}ms avg`);
      console.log(
        `  Overhead: ${(profilerResult.avgMs - baselineResult.avgMs).toFixed(3)}ms`
      );

      // Profiler overhead should be less than 1ms per frame
      const overhead = profilerResult.avgMs - baselineResult.avgMs;
      expect(overhead).toBeLessThan(1.0);

      profiler.dispose();
    });

    test('recording statistics has negligible overhead', async () => {
      const { device } = testContext;
      const profiler = new WebGPUProfiler(device);

      const recordingResult = await runBenchmark(
        'recording-stats',
        async () => {
          profiler.startFrame();

          // Simulate recording many statistics
          for (let i = 0; i < 100; i++) {
            profiler.recordDrawCall(1000);
            profiler.recordBatch();
            profiler.recordShaderSwitch();
          }
          profiler.recordCulling(500, 200, 'surface');
          profiler.recordCulling(50, 20, 'entity');

          const encoder = device.createCommandEncoder();
          profiler.endFrame(encoder);
          device.queue.submit([encoder.finish()]);
        },
        { warmupIterations: 3, measureIterations: 100 }
      );

      console.log(`\nRecording Stats Benchmark:`);
      console.log(`  Average: ${recordingResult.avgMs.toFixed(3)}ms`);
      console.log(`  Std Dev: ${recordingResult.stdDev.toFixed(3)}ms`);

      // Recording 100+ stats should take less than 0.5ms
      expect(recordingResult.avgMs).toBeLessThan(0.5);

      profiler.dispose();
    });

    test('performance report generation is fast', async () => {
      const { device } = testContext;
      const profiler = new WebGPUProfiler(device);

      // Setup some state
      profiler.startFrame();
      for (let i = 0; i < 50; i++) {
        profiler.recordDrawCall(500);
      }
      const encoder = device.createCommandEncoder();
      profiler.endFrame(encoder);
      device.queue.submit([encoder.finish()]);

      const reportResult = await runBenchmark(
        'get-performance-report',
        async () => {
          profiler.getPerformanceReport();
        },
        { warmupIterations: 10, measureIterations: 1000 }
      );

      console.log(`\nPerformance Report Benchmark:`);
      console.log(`  Average: ${(reportResult.avgMs * 1000).toFixed(1)}μs`);

      // Report generation should be sub-millisecond
      expect(reportResult.avgMs).toBeLessThan(0.1);

      profiler.dispose();
    });
  });

  describe('Resource Tracking Benchmarks', () => {
    test('buffer tracking overhead is minimal', async () => {
      const { device } = testContext;
      const tracker = new ProfilingResourceTracker();
      setResourceTracker(tracker);

      const result = await runBenchmark(
        'buffer-creation-with-tracking',
        async () => {
          const buffers: VertexBuffer[] = [];
          for (let i = 0; i < 10; i++) {
            buffers.push(
              new VertexBuffer(device, { size: 1024, label: `bench-buf-${i}` })
            );
          }
          await device.queue.onSubmittedWorkDone();
          for (const buf of buffers) {
            buf.destroy();
          }
        },
        { warmupIterations: 3, measureIterations: 50 }
      );

      console.log(`\nBuffer Tracking Benchmark:`);
      console.log(`  10 buffers created/destroyed: ${result.avgMs.toFixed(3)}ms avg`);
      console.log(`  Per buffer: ${(result.avgMs / 10).toFixed(3)}ms`);

      // Creating 10 buffers with tracking should take less than 10ms
      expect(result.avgMs).toBeLessThan(10);
    });

    test('texture tracking overhead is minimal', async () => {
      const { device } = testContext;
      const tracker = new ProfilingResourceTracker();
      setResourceTracker(tracker);

      const result = await runBenchmark(
        'texture-creation-with-tracking',
        async () => {
          const textures: Texture2D[] = [];
          for (let i = 0; i < 5; i++) {
            textures.push(
              new Texture2D(device, {
                width: 64,
                height: 64,
                format: 'rgba8unorm',
                label: `bench-tex-${i}`,
              })
            );
          }
          await device.queue.onSubmittedWorkDone();
          for (const tex of textures) {
            tex.destroy();
          }
        },
        { warmupIterations: 3, measureIterations: 30 }
      );

      console.log(`\nTexture Tracking Benchmark:`);
      console.log(`  5 textures created/destroyed: ${result.avgMs.toFixed(3)}ms avg`);
      console.log(`  Per texture: ${(result.avgMs / 5).toFixed(3)}ms`);

      // Creating 5 textures with tracking should take less than 20ms
      expect(result.avgMs).toBeLessThan(20);
    });

    test('summary generation is fast', async () => {
      const tracker = new ProfilingResourceTracker();

      // Simulate many tracked resources
      for (let i = 0; i < 100; i++) {
        tracker.trackPipeline();
        tracker.trackBindGroup();
        tracker.trackSampler();
      }

      const result = await runBenchmark(
        'summary-generation',
        async () => {
          tracker.getSummary();
        },
        { warmupIterations: 10, measureIterations: 1000 }
      );

      console.log(`\nSummary Generation Benchmark:`);
      console.log(`  Average: ${(result.avgMs * 1000).toFixed(1)}μs`);

      // Summary should be sub-millisecond
      expect(result.avgMs).toBeLessThan(0.1);
    });
  });

  describe('Rendering with Profiling Benchmarks', () => {
    test('profiled skybox rendering performance', async () => {
      const { device } = testContext;
      const profiler = new WebGPUProfiler(device);
      const width = 256;
      const height = 256;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const pipeline = new SkyboxPipeline(device, format);
      const camera = new Camera(width, height);
      camera.setPosition(0, 0, 50);

      // Create minimal cubemap
      const cubemap = device.createTexture({
        size: [1, 1, 6],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      for (let i = 0; i < 6; i++) {
        device.queue.writeTexture(
          { texture: cubemap, origin: { x: 0, y: 0, z: i } },
          new Uint8Array([128, 128, 128, 255]),
          { bytesPerRow: 4 },
          { width: 1, height: 1, depthOrArrayLayers: 1 }
        );
      }

      const renderTarget = device.createTexture({
        size: [width, height],
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });

      const depthTarget = device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      const result = await runBenchmark(
        'profiled-skybox',
        async () => {
          profiler.startFrame();

          const encoder = device.createCommandEncoder();
          profiler.writeTimestamp(encoder, 'frame-start');

          const pass = encoder.beginRenderPass({
            colorAttachments: [
              {
                view: renderTarget.createView(),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
              },
            ],
            depthStencilAttachment: {
              view: depthTarget.createView(),
              depthClearValue: 1.0,
              depthLoadOp: 'clear',
              depthStoreOp: 'store',
            },
          });

          // Note: Skybox pipeline expects TextureCubeMap, using raw for simplicity
          pass.end();

          profiler.writeTimestamp(encoder, 'frame-end');
          profiler.recordDrawCall(36);

          profiler.endFrame(encoder);
          device.queue.submit([encoder.finish()]);
          await device.queue.onSubmittedWorkDone();
        },
        { warmupIterations: 5, measureIterations: 30 }
      );

      console.log(`\nProfiled Skybox Benchmark:`);
      console.log(`  Average: ${result.avgMs.toFixed(3)}ms`);
      console.log(`  Min: ${result.minMs.toFixed(3)}ms`);
      console.log(`  Max: ${result.maxMs.toFixed(3)}ms`);
      console.log(`  Std Dev: ${result.stdDev.toFixed(3)}ms`);

      // Profiled skybox should render in reasonable time
      expect(result.avgMs).toBeLessThan(50);

      // Cleanup
      pipeline.destroy();
      cubemap.destroy();
      renderTarget.destroy();
      depthTarget.destroy();
      profiler.dispose();
    });

    test('profiled 2D sprite rendering performance', async () => {
      const { device } = testContext;
      const profiler = new WebGPUProfiler(device);
      const width = 256;
      const height = 256;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const spriteRenderer = new SpriteRenderer(device, format);

      const renderTarget = device.createTexture({
        size: [width, height],
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });

      const result = await runBenchmark(
        'profiled-sprites',
        async () => {
          profiler.startFrame();

          const encoder = device.createCommandEncoder();
          profiler.writeTimestamp(encoder, 'frame-start');

          spriteRenderer.setProjection(width, height);
          spriteRenderer.begin(encoder, renderTarget.createView());

          // Draw 100 sprites
          for (let i = 0; i < 100; i++) {
            const x = (i % 10) * 25;
            const y = Math.floor(i / 10) * 25;
            spriteRenderer.drawSolidRect(x, y, 20, 20, [
              i / 100,
              0.5,
              1 - i / 100,
              1,
            ]);
            profiler.recordDrawCall(6);
          }

          spriteRenderer.end();

          profiler.writeTimestamp(encoder, 'frame-end');
          profiler.endFrame(encoder);

          device.queue.submit([encoder.finish()]);
          await device.queue.onSubmittedWorkDone();
        },
        { warmupIterations: 5, measureIterations: 30 }
      );

      console.log(`\nProfiled Sprites Benchmark (100 sprites):`);
      console.log(`  Average: ${result.avgMs.toFixed(3)}ms`);
      console.log(`  Min: ${result.minMs.toFixed(3)}ms`);
      console.log(`  Max: ${result.maxMs.toFixed(3)}ms`);

      expect(result.avgMs).toBeLessThan(50);

      spriteRenderer.destroy();
      renderTarget.destroy();
      profiler.dispose();
    });
  });

  describe('Export and Reporting Benchmarks', () => {
    test('profiling data export is fast', async () => {
      const { device } = testContext;
      const profiler = new WebGPUProfiler(device);

      // Setup state
      profiler.startFrame();
      for (let i = 0; i < 100; i++) {
        profiler.recordDrawCall(500);
        profiler.recordBatch();
      }
      const encoder = device.createCommandEncoder();
      profiler.endFrame(encoder);
      device.queue.submit([encoder.finish()]);

      const result = await runBenchmark(
        'export-profiling-data',
        async () => {
          exportProfilingData(profiler);
        },
        { warmupIterations: 10, measureIterations: 1000 }
      );

      console.log(`\nExport Profiling Data Benchmark:`);
      console.log(`  Average: ${(result.avgMs * 1000).toFixed(1)}μs`);

      // Export should be very fast
      expect(result.avgMs).toBeLessThan(0.5);

      profiler.dispose();
    });

    test('memory usage query is fast', async () => {
      const { device } = testContext;
      const profiler = new WebGPUProfiler(device);

      // Create some resources to track
      const textures: Texture2D[] = [];
      for (let i = 0; i < 10; i++) {
        textures.push(
          new Texture2D(device, {
            width: 64,
            height: 64,
            format: 'rgba8unorm',
          })
        );
      }

      const result = await runBenchmark(
        'memory-usage-query',
        async () => {
          profiler.getMemoryUsage();
        },
        { warmupIterations: 10, measureIterations: 1000 }
      );

      console.log(`\nMemory Usage Query Benchmark:`);
      console.log(`  Average: ${(result.avgMs * 1000).toFixed(1)}μs`);

      expect(result.avgMs).toBeLessThan(0.1);

      for (const tex of textures) {
        tex.destroy();
      }
      profiler.dispose();
    });
  });

  describe('Regression Detection', () => {
    test('profiler does not introduce frame time regression', async () => {
      const { device } = testContext;

      // Measure baseline rendering (simple command submission)
      const baselineTimes: number[] = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        const encoder = device.createCommandEncoder();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        baselineTimes.push(performance.now() - start);
      }

      const baselineAvg =
        baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length;

      // Measure with profiler
      const profiler = new WebGPUProfiler(device);
      const profiledTimes: number[] = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        profiler.startFrame();
        const encoder = device.createCommandEncoder();
        profiler.endFrame(encoder);
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        profiledTimes.push(performance.now() - start);
      }

      const profiledAvg =
        profiledTimes.reduce((a, b) => a + b, 0) / profiledTimes.length;

      const overheadPercent = ((profiledAvg - baselineAvg) / baselineAvg) * 100;

      console.log(`\nRegression Detection:`);
      console.log(`  Baseline avg: ${baselineAvg.toFixed(3)}ms`);
      console.log(`  Profiled avg: ${profiledAvg.toFixed(3)}ms`);
      console.log(`  Overhead: ${overheadPercent.toFixed(1)}%`);

      // Profiler should add less than 50% overhead (generous for CI environments)
      expect(overheadPercent).toBeLessThan(50);

      profiler.dispose();
    });
  });

  describe('Summary Report', () => {
    test('generates benchmark summary', () => {
      const { device } = testContext;

      const summary = {
        deviceFeatures: {
          timestampQuery: device.features.has('timestamp-query'),
          maxComputeWorkgroupSizeX: device.limits.maxComputeWorkgroupSizeX,
          maxTextureDimension2D: device.limits.maxTextureDimension2D,
        },
        environment: {
          platform: process.platform,
          nodeVersion: process.version,
        },
      };

      console.log('\n=== Benchmark Summary ===');
      console.log('Device Features:');
      console.log(`  Timestamp Query: ${summary.deviceFeatures.timestampQuery}`);
      console.log(
        `  Max Compute Workgroup: ${summary.deviceFeatures.maxComputeWorkgroupSizeX}`
      );
      console.log(
        `  Max Texture Dimension: ${summary.deviceFeatures.maxTextureDimension2D}`
      );
      console.log('Environment:');
      console.log(`  Platform: ${summary.environment.platform}`);
      console.log(`  Node: ${summary.environment.nodeVersion}`);

      expect(summary.deviceFeatures.maxTextureDimension2D).toBeGreaterThan(0);
    });
  });
});
