/**
 * Section 20-17: WebGPU Performance Profiling Infrastructure Tests
 *
 * Unit tests for the WebGPUProfiler class and related profiling infrastructure.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { setupHeadlessWebGPUEnv, initHeadlessWebGPU } from '@quake2ts/test-utils';
import {
  WebGPUProfiler,
  ProfilingResourceTracker,
  exportProfilingData,
} from '../../../src/render/webgpu/profiling.js';
import { GPUResourceTracker, setResourceTracker } from '../../../src/render/webgpu/resources.js';

// Check if WebGPU is available
let webgpuAvailable = true;
let webgpuError: string | null = null;

describe('WebGPU Profiling Infrastructure (Section 20-17)', () => {
  let testContext: Awaited<ReturnType<typeof initHeadlessWebGPU>> | null = null;

  beforeAll(async () => {
    try {
      await setupHeadlessWebGPUEnv();
      testContext = await initHeadlessWebGPU();
    } catch (e) {
      webgpuAvailable = false;
      webgpuError = e instanceof Error ? e.message : String(e);
      console.warn(`WebGPU not available, skipping GPU tests: ${webgpuError}`);
    }
  });

  afterAll(async () => {
    if (testContext) {
      await testContext.cleanup();
    }
  });

  // Helper to skip tests when WebGPU is not available
  const skipIfNoWebGPU = () => {
    if (!webgpuAvailable || !testContext) {
      console.log('Skipping test: WebGPU not available');
      return true;
    }
    return false;
  };

  describe('WebGPUProfiler', () => {
    describe('initialization', () => {
      it('should create profiler with device', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        expect(profiler).toBeDefined();
        expect(typeof profiler.isTimestampSupported).toBe('boolean');

        profiler.dispose();
      });

      it('should accept custom configuration', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device, {
          maxQueries: 64,
          frameBufferDepth: 4,
        });

        expect(profiler).toBeDefined();
        profiler.dispose();
      });

      it('should report timestamp support correctly', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const hasTimestampFeature = device.features.has('timestamp-query');
        const profiler = new WebGPUProfiler(device);

        expect(profiler.isTimestampSupported).toBe(hasTimestampFeature);

        profiler.dispose();
      });
    });

    describe('CPU timing', () => {
      it('should measure CPU frame time', async () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        profiler.startFrame();

        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 10));

        const encoder = device.createCommandEncoder();
        profiler.endFrame(encoder);
        device.queue.submit([encoder.finish()]);

        const results = profiler.results;
        expect(results.cpuFrameTimeMs).toBeGreaterThan(0);
        expect(results.cpuFrameTimeMs).toBeLessThan(1000);

        profiler.dispose();
      });

      it('should track smoothed frame time', async () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        for (let i = 0; i < 5; i++) {
          profiler.startFrame();
          await new Promise((resolve) => setTimeout(resolve, 5));
          const encoder = device.createCommandEncoder();
          profiler.endFrame(encoder);
          device.queue.submit([encoder.finish()]);
        }

        const smoothed = profiler.smoothedFrameTimeMs;
        expect(smoothed).toBeGreaterThan(0);

        profiler.dispose();
      });
    });

    describe('frame statistics', () => {
      it('should record draw calls', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        profiler.startFrame();
        profiler.recordDrawCall(100);
        profiler.recordDrawCall(200);
        profiler.recordDrawCall(300);

        const stats = profiler.getCurrentFrameStats();
        expect(stats.drawCalls).toBe(3);
        expect(stats.vertexCount).toBe(600);

        profiler.dispose();
      });

      it('should record batches', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        profiler.startFrame();
        profiler.recordBatch();
        profiler.recordBatch();

        const stats = profiler.getCurrentFrameStats();
        expect(stats.batches).toBe(2);

        profiler.dispose();
      });

      it('should record shader switches', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        profiler.startFrame();
        profiler.recordShaderSwitch();
        profiler.recordShaderSwitch();
        profiler.recordShaderSwitch();

        const stats = profiler.getCurrentFrameStats();
        expect(stats.shaderSwitches).toBe(3);

        profiler.dispose();
      });

      it('should record culling statistics', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        profiler.startFrame();
        profiler.recordCulling(100, 50, 'surface');
        profiler.recordCulling(10, 5, 'entity');

        const stats = profiler.getCurrentFrameStats();
        expect(stats.visibleSurfaces).toBe(100);
        expect(stats.culledSurfaces).toBe(50);
        expect(stats.visibleEntities).toBe(10);
        expect(stats.culledEntities).toBe(5);

        profiler.dispose();
      });

      it('should reset stats on new frame', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        profiler.startFrame();
        profiler.recordDrawCall(100);
        profiler.recordBatch();

        profiler.startFrame();
        const stats = profiler.getCurrentFrameStats();
        expect(stats.drawCalls).toBe(0);
        expect(stats.batches).toBe(0);

        profiler.dispose();
      });
    });

    describe('performance report', () => {
      it('should generate performance report', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        profiler.startFrame();
        profiler.recordDrawCall(300);
        profiler.recordBatch();
        profiler.recordCulling(50, 25, 'surface');

        const encoder = device.createCommandEncoder();
        profiler.endFrame(encoder);
        device.queue.submit([encoder.finish()]);

        const report = profiler.getPerformanceReport();

        expect(report).toHaveProperty('frameTimeMs');
        expect(report).toHaveProperty('gpuTimeMs');
        expect(report).toHaveProperty('drawCalls');
        expect(report).toHaveProperty('triangles');
        expect(report).toHaveProperty('vertices');
        expect(report).toHaveProperty('memoryUsageMB');

        expect(report.drawCalls).toBe(1);
        expect(report.vertices).toBe(300);
        expect(report.triangles).toBe(100);
        expect(report.visibleSurfaces).toBe(50);
        expect(report.culledSurfaces).toBe(25);

        profiler.dispose();
      });

      it('should accept external frame stats', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        profiler.startFrame();
        const encoder = device.createCommandEncoder();
        profiler.endFrame(encoder);
        device.queue.submit([encoder.finish()]);

        const externalStats = {
          drawCalls: 10,
          vertexCount: 3000,
          batches: 5,
          shaderSwitches: 2,
          visibleSurfaces: 200,
          culledSurfaces: 100,
          visibleEntities: 20,
          culledEntities: 10,
        };

        const report = profiler.getPerformanceReport(externalStats);

        expect(report.drawCalls).toBe(10);
        expect(report.vertices).toBe(3000);
        expect(report.triangles).toBe(1000);

        profiler.dispose();
      });
    });

    describe('memory tracking', () => {
      it('should report memory usage when tracker is set', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const tracker = new GPUResourceTracker();
        setResourceTracker(tracker);

        const profiler = new WebGPUProfiler(device);

        const memoryUsage = profiler.getMemoryUsage();
        expect(memoryUsage).toHaveProperty('texturesBytes');
        expect(memoryUsage).toHaveProperty('geometryBytes');
        expect(memoryUsage).toHaveProperty('buffersBytes');
        expect(memoryUsage).toHaveProperty('totalBytes');

        profiler.dispose();
        setResourceTracker(null as any);
      });
    });

    describe('timestamp results interface', () => {
      it('should return empty array when timestamps not supported', async () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        if (!profiler.isTimestampSupported) {
          const results = profiler.getTimestampResults();
          expect(results).toEqual([]);
        }

        profiler.dispose();
      });
    });

    describe('reset and dispose', () => {
      it('should reset all statistics', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        profiler.startFrame();
        profiler.recordDrawCall(100);
        const encoder = device.createCommandEncoder();
        profiler.endFrame(encoder);
        device.queue.submit([encoder.finish()]);

        profiler.reset();

        expect(profiler.smoothedFrameTimeMs).toBe(0);
        expect(profiler.smoothedGpuTimeMs).toBe(0);

        profiler.dispose();
      });

      it('should dispose resources cleanly', () => {
        if (skipIfNoWebGPU()) return;
        const { device } = testContext!;
        const profiler = new WebGPUProfiler(device);

        profiler.startFrame();
        const encoder = device.createCommandEncoder();
        profiler.endFrame(encoder);
        device.queue.submit([encoder.finish()]);

        expect(() => profiler.dispose()).not.toThrow();
      });
    });
  });

  describe('ProfilingResourceTracker', () => {
    it('should extend GPUResourceTracker', () => {
      const tracker = new ProfilingResourceTracker();
      expect(tracker).toBeInstanceOf(GPUResourceTracker);
    });

    it('should track pipelines', () => {
      const tracker = new ProfilingResourceTracker();

      tracker.trackPipeline();
      tracker.trackPipeline();

      expect(tracker.pipelineCount).toBe(2);

      tracker.untrackPipeline();
      expect(tracker.pipelineCount).toBe(1);
    });

    it('should track bind groups', () => {
      const tracker = new ProfilingResourceTracker();

      tracker.trackBindGroup();
      tracker.trackBindGroup();
      tracker.trackBindGroup();

      expect(tracker.bindGroupCount).toBe(3);

      tracker.untrackBindGroup();
      expect(tracker.bindGroupCount).toBe(2);
    });

    it('should track samplers', () => {
      const tracker = new ProfilingResourceTracker();

      tracker.trackSampler();

      expect(tracker.samplerCount).toBe(1);

      tracker.untrackSampler();
      expect(tracker.samplerCount).toBe(0);
    });

    it('should reset all counts', () => {
      const tracker = new ProfilingResourceTracker();

      tracker.trackPipeline();
      tracker.trackBindGroup();
      tracker.trackSampler();

      tracker.reset();

      expect(tracker.pipelineCount).toBe(0);
      expect(tracker.bindGroupCount).toBe(0);
      expect(tracker.samplerCount).toBe(0);
    });

    it('should generate summary', () => {
      const tracker = new ProfilingResourceTracker();

      tracker.trackPipeline();
      tracker.trackPipeline();
      tracker.trackBindGroup();
      tracker.trackSampler();

      const summary = tracker.getSummary();

      expect(summary).toHaveProperty('pipelineCount', 2);
      expect(summary).toHaveProperty('bindGroupCount', 1);
      expect(summary).toHaveProperty('samplerCount', 1);
      expect(summary).toHaveProperty('bufferMemory');
      expect(summary).toHaveProperty('textureMemory');
    });
  });

  describe('exportProfilingData', () => {
    it('should export profiling data', () => {
      if (skipIfNoWebGPU()) return;
      const { device } = testContext!;
      const profiler = new WebGPUProfiler(device);

      profiler.startFrame();
      profiler.recordDrawCall(300);
      const encoder = device.createCommandEncoder();
      profiler.endFrame(encoder);
      device.queue.submit([encoder.finish()]);

      const exported = exportProfilingData(profiler);

      expect(exported).toHaveProperty('timestamp');
      expect(exported).toHaveProperty('frameTimeMs');
      expect(exported).toHaveProperty('gpuTimeMs');
      expect(exported).toHaveProperty('drawCalls');
      expect(exported).toHaveProperty('triangles');
      expect(exported).toHaveProperty('memoryMB');
      expect(exported).toHaveProperty('passTimings');

      expect(exported.timestamp).toBeGreaterThan(0);
      expect(exported.drawCalls).toBe(1);
      expect(exported.triangles).toBe(100);

      profiler.dispose();
    });
  });
});
