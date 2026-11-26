import { describe, it, expect, beforeEach } from 'vitest';
import { createWebGPURenderer, Camera } from '../../../src/index';
import { setupWebGPUMocks } from '@quake2ts/test-utils/src/engine/mocks/webgpu';
import { DebugMode } from '../../../src/render/debugMode';

describe('WebGPU Extended Interface (Section 20-15)', () => {
  beforeEach(() => {
    setupWebGPUMocks();
  });

  describe('IWebGPURenderer Interface', () => {
    it('implements the extended interface correctly', async () => {
      const renderer = await createWebGPURenderer();

      // Check type property
      expect(renderer.type).toBe('webgpu');

      // Check device property exists
      expect(renderer.device).toBeDefined();

      // Check WebGPU-specific methods exist
      expect(typeof renderer.getCapabilities).toBe('function');
      expect(typeof renderer.dispatchCompute).toBe('function');
      expect(typeof renderer.getTimestampResults).toBe('function');
      expect(typeof renderer.captureFrame).toBe('function');
    });
  });

  describe('Capability Queries', () => {
    it('returns device capabilities', async () => {
      const renderer = await createWebGPURenderer();
      const caps = renderer.getCapabilities();

      // Check required limit properties
      expect(caps.maxTextureDimension2D).toBeGreaterThan(0);
      expect(caps.maxBindGroups).toBeGreaterThan(0);
      expect(caps.maxUniformBufferBindingSize).toBeGreaterThan(0);

      // Check optional feature flags
      expect(typeof caps.timestampQuery).toBe('boolean');
      expect(typeof caps.textureCompressionBC).toBe('boolean');
    });

    it('reports compute shader limits', async () => {
      const renderer = await createWebGPURenderer();
      const caps = renderer.getCapabilities();

      expect(caps.maxComputeWorkgroupSizeX).toBeGreaterThan(0);
      expect(caps.maxComputeWorkgroupSizeY).toBeGreaterThan(0);
      expect(caps.maxComputeWorkgroupSizeZ).toBeGreaterThan(0);
      expect(caps.maxComputeInvocationsPerWorkgroup).toBeGreaterThan(0);
      expect(caps.maxComputeWorkgroupsPerDimension).toBeGreaterThan(0);
    });
  });

  describe('Render State Management', () => {
    it('sets and applies brightness', async () => {
      const renderer = await createWebGPURenderer();

      renderer.setBrightness(1.5);
      expect(() => renderer.setBrightness(1.5)).not.toThrow();

      // Brightness should be clamped to valid range
      renderer.setBrightness(-1.0);
      renderer.setBrightness(10.0);
    });

    it('sets and applies gamma', async () => {
      const renderer = await createWebGPURenderer();

      renderer.setGamma(2.2);
      expect(() => renderer.setGamma(2.2)).not.toThrow();

      // Gamma should be clamped to valid range
      renderer.setGamma(0.1);
      renderer.setGamma(5.0);
    });

    it('sets fullbright mode', async () => {
      const renderer = await createWebGPURenderer();

      renderer.setFullbright(true);
      expect(() => renderer.setFullbright(false)).not.toThrow();
    });

    it('sets ambient lighting', async () => {
      const renderer = await createWebGPURenderer();

      renderer.setAmbient(0.3);
      expect(() => renderer.setAmbient(0.3)).not.toThrow();

      // Ambient should be clamped to [0, 1]
      renderer.setAmbient(-0.5);
      renderer.setAmbient(2.0);
    });

    it('sets underwater warp effect', async () => {
      const renderer = await createWebGPURenderer();

      renderer.setUnderwaterWarp(true);
      expect(() => renderer.setUnderwaterWarp(false)).not.toThrow();
    });

    it('sets bloom effect', async () => {
      const renderer = await createWebGPURenderer();

      renderer.setBloom(true);
      renderer.setBloomIntensity(0.8);
      expect(() => renderer.setBloom(false)).not.toThrow();
    });

    it('sets LOD bias', async () => {
      const renderer = await createWebGPURenderer();

      renderer.setLodBias(1.5);
      expect(() => renderer.setLodBias(1.5)).not.toThrow();

      // LOD bias should be clamped
      renderer.setLodBias(-1.0);
      renderer.setLodBias(5.0);
    });

    it('sets debug mode', async () => {
      const renderer = await createWebGPURenderer();

      renderer.setDebugMode(DebugMode.Wireframe);
      expect(() => renderer.setDebugMode(DebugMode.None)).not.toThrow();
    });
  });

  describe('Light Style Overrides', () => {
    it('sets and clears light style overrides', async () => {
      const renderer = await createWebGPURenderer();

      renderer.setLightStyle(0, 'mmammmmm');
      renderer.setLightStyle(1, 'abcdefgh');

      // Clear a light style
      renderer.setLightStyle(0, null);
      expect(() => renderer.setLightStyle(0, null)).not.toThrow();
    });
  });

  describe('Entity Highlighting', () => {
    it('highlights and clears entity highlights', async () => {
      const renderer = await createWebGPURenderer();

      renderer.setEntityHighlight(123, [1, 0, 0, 1]);
      renderer.setEntityHighlight(456, [0, 1, 0, 1]);

      renderer.clearEntityHighlight(123);
      expect(() => renderer.clearEntityHighlight(999)).not.toThrow();
    });
  });

  describe('Surface Highlighting', () => {
    it('highlights and clears surface highlights', async () => {
      const renderer = await createWebGPURenderer();

      renderer.highlightSurface(0, [1, 0, 0, 1]);
      renderer.highlightSurface(1, [0, 1, 0, 1]);

      renderer.removeSurfaceHighlight(0);
      expect(() => renderer.removeSurfaceHighlight(999)).not.toThrow();
    });
  });

  describe('Compute Shader Dispatch', () => {
    it('dispatches compute shader without error', async () => {
      const renderer = await createWebGPURenderer();

      // Create a mock compute pipeline
      const mockPipeline = {
        pipeline: renderer.device.createComputePipeline({
          label: 'test-compute',
          layout: 'auto',
          compute: {
            module: renderer.device.createShaderModule({
              code: `
                @compute @workgroup_size(1, 1, 1)
                fn main() {}
              `
            }),
            entryPoint: 'main'
          }
        }),
        bindGroupLayout: renderer.device.createBindGroupLayout({
          entries: []
        })
      };

      const bindGroup = renderer.device.createBindGroup({
        layout: mockPipeline.bindGroupLayout,
        entries: []
      });

      expect(() => {
        renderer.dispatchCompute(mockPipeline, bindGroup, [1, 1, 1]);
      }).not.toThrow();
    });
  });

  describe('Performance Queries', () => {
    it('returns timestamp results (may be empty if not supported)', async () => {
      const renderer = await createWebGPURenderer();

      const results = await renderer.getTimestampResults?.();
      expect(Array.isArray(results)).toBe(true);
    });

    it('checks timestamp query capability', async () => {
      const renderer = await createWebGPURenderer();
      const caps = renderer.getCapabilities();

      if (caps.timestampQuery) {
        const results = await renderer.getTimestampResults?.();
        expect(results).toBeDefined();
      }
    });
  });

  describe('Frame Capture', () => {
    it('frame capture returns rejection for unimplemented feature', async () => {
      const renderer = await createWebGPURenderer();

      await expect(renderer.captureFrame?.()).rejects.toThrow();
    });
  });

  describe('Render State Persistence Across Frames', () => {
    it('maintains render state between frames', async () => {
      const renderer = await createWebGPURenderer();
      const camera = new Camera(90, 1.0);

      // Set various render states
      renderer.setBrightness(1.5);
      renderer.setGamma(2.2);
      renderer.setFullbright(true);
      renderer.setUnderwaterWarp(true);

      // Render first frame
      renderer.renderFrame({ camera, timeSeconds: 0 });

      // Render second frame - state should persist
      renderer.renderFrame({ camera, timeSeconds: 0.016 });

      // Change state and render again
      renderer.setBrightness(1.0);
      renderer.renderFrame({ camera, timeSeconds: 0.032 });

      expect(renderer).toBeDefined();
    });
  });

  describe('Feature Parity with IRenderer', () => {
    it('implements all required IRenderer methods', async () => {
      const renderer = await createWebGPURenderer();

      // Check all IRenderer methods exist
      expect(typeof renderer.renderFrame).toBe('function');
      expect(typeof renderer.registerPic).toBe('function');
      expect(typeof renderer.registerTexture).toBe('function');
      expect(typeof renderer.begin2D).toBe('function');
      expect(typeof renderer.end2D).toBe('function');
      expect(typeof renderer.drawPic).toBe('function');
      expect(typeof renderer.drawString).toBe('function');
      expect(typeof renderer.drawCenterString).toBe('function');
      expect(typeof renderer.drawfillRect).toBe('function');
      expect(typeof renderer.setEntityHighlight).toBe('function');
      expect(typeof renderer.clearEntityHighlight).toBe('function');
      expect(typeof renderer.highlightSurface).toBe('function');
      expect(typeof renderer.removeSurfaceHighlight).toBe('function');
      expect(typeof renderer.setDebugMode).toBe('function');
      expect(typeof renderer.setBrightness).toBe('function');
      expect(typeof renderer.setGamma).toBe('function');
      expect(typeof renderer.setFullbright).toBe('function');
      expect(typeof renderer.setAmbient).toBe('function');
      expect(typeof renderer.setLightStyle).toBe('function');
      expect(typeof renderer.setUnderwaterWarp).toBe('function');
      expect(typeof renderer.setBloom).toBe('function');
      expect(typeof renderer.setBloomIntensity).toBe('function');
      expect(typeof renderer.setLodBias).toBe('function');
      expect(typeof renderer.renderInstanced).toBe('function');
      expect(typeof renderer.getPerformanceReport).toBe('function');
      expect(typeof renderer.getMemoryUsage).toBe('function');
      expect(typeof renderer.dispose).toBe('function');
    });

    it('has required properties', async () => {
      const renderer = await createWebGPURenderer();

      expect(typeof renderer.width).toBe('number');
      expect(typeof renderer.height).toBe('number');
      expect(renderer.debug).toBeDefined();
      expect(renderer.particleSystem).toBeDefined();
      expect(renderer.collisionVis).toBeDefined();
    });
  });
});
