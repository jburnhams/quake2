// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createWebGPUContext,
  queryCapabilities,
  setupDeviceLossHandling,
  WebGPUContextOptions
} from '../../../src/render/webgpu/context';
import { setupWebGPUMocks } from '@quake2ts/test-utils/src/engine/mocks/webgpu';

describe('WebGPU Context', () => {
  let mocks: ReturnType<typeof setupWebGPUMocks>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = setupWebGPUMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createWebGPUContext', () => {
    it('creates context successfully in browser environment', async () => {
      const canvas = document.createElement('canvas');
      canvas.getContext = vi.fn().mockReturnValue({
        configure: vi.fn(),
      });

      const state = await createWebGPUContext(canvas);

      expect(state.device).toBeDefined();
      expect(state.adapter).toBeDefined();
      expect(state.context).toBeDefined();
      expect(state.isHeadless).toBe(false);
      expect(state.format).toBe('bgra8unorm');

      expect(navigator.gpu.requestAdapter).toHaveBeenCalledWith({
        powerPreference: 'high-performance'
      });
    });

    it('creates headless context when no canvas provided', async () => {
      const state = await createWebGPUContext();

      expect(state.device).toBeDefined();
      expect(state.context).toBeUndefined();
      expect(state.isHeadless).toBe(true);
      expect(state.format).toBe('rgba8unorm'); // Default for headless (matches test framework)
    });

    it('throws error if WebGPU is not supported', async () => {
      // Temporarily remove gpu from navigator
      const originalGpu = navigator.gpu;
      // @ts-ignore
      delete navigator.gpu;

      await expect(createWebGPUContext()).rejects.toThrow('WebGPU is not supported');

      // Restore with configurable/writable so subsequent tests can overwrite it if needed
      Object.defineProperty(navigator, 'gpu', {
        value: originalGpu,
        configurable: true,
        writable: true
      });
    });

    it('throws error if no adapter found', async () => {
      // @ts-ignore
      mocks.mockGpu.requestAdapter.mockResolvedValue(null);

      await expect(createWebGPUContext()).rejects.toThrow('No appropriate GPUAdapter found');
    });

    it('validates required features', async () => {
      // Mock adapter with no features
      // @ts-ignore
      mocks.mockAdapter.features = new Set();

      const options: WebGPUContextOptions = {
        requiredFeatures: ['texture-compression-bc' as GPUFeatureName]
      };

      await expect(createWebGPUContext(undefined, options)).rejects.toThrow('Required feature not available');
    });

    it('passes required limits to device creation', async () => {
      const options: WebGPUContextOptions = {
        requiredLimits: { maxBindGroups: 8 }
      };

      await createWebGPUContext(undefined, options);

      expect(mocks.mockAdapter.requestDevice).toHaveBeenCalledWith(expect.objectContaining({
        requiredLimits: { maxBindGroups: 8 }
      }));
    });
  });

  describe('queryCapabilities', () => {
    it('correctly identifies capabilities', async () => {
      const state = await createWebGPUContext();
      // Setup mock features
      state.features.add('timestamp-query');
      state.limits.maxTextureDimension2D = 16384;

      const caps = queryCapabilities(state);

      expect(caps.hasTimestampQuery).toBe(true);
      expect(caps.hasTextureCompressionBC).toBe(false);
      expect(caps.maxTextureDimension2D).toBe(16384);
    });
  });

  describe('setupDeviceLossHandling', () => {
    it('registers lost handler', async () => {
      const state = await createWebGPUContext();
      const onLost = vi.fn();

      // We can't easily trigger the promise resolution of a mocked property without exposing the resolve function
      // But we can verify the setup logic attaches the handler

      // Creating a device with a manually controlled promise for 'lost'
      let resolveLost: (info: GPUDeviceLostInfo) => void;
      const lostPromise = new Promise<GPUDeviceLostInfo>((resolve) => {
        resolveLost = resolve;
      });

      const device = {
        lost: lostPromise
      } as unknown as GPUDevice;

      setupDeviceLossHandling(device, onLost);

      // Trigger loss
      // @ts-ignore
      resolveLost({ reason: 'destroyed', message: 'test' });

      // Wait for microtasks
      await new Promise(process.nextTick);

      expect(onLost).toHaveBeenCalledWith('destroyed');
    });
  });
});
