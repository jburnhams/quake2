
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebGPUContext } from '../../../src/render/webgpu/context';
import { setupWebGPUMocks } from '@quake2ts/test-utils';

describe('WebGPU Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupWebGPUMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up global mocks if needed, though setupWebGPUMocks handles setup
    delete (global.navigator as any).gpu;
    delete (global as any).GPUTextureUsage;
  });

  it('should create context with canvas', async () => {
    const canvas = {
      getContext: vi.fn().mockReturnValue({
        configure: vi.fn(),
      }),
    } as unknown as HTMLCanvasElement;

    const result = await createWebGPUContext(canvas);

    expect(result.device).toBeDefined();
    expect(result.context).toBeDefined();
    expect(result.isHeadless).toBe(false);
    expect(result.format).toBe('bgra8unorm'); // Default mock format

    // Verify adapter request options
    expect(navigator.gpu.requestAdapter).toHaveBeenCalledWith({
      powerPreference: 'high-performance'
    });

    // Verify context configuration
    const context = canvas.getContext('webgpu');
    expect(context?.configure).toHaveBeenCalledWith(expect.objectContaining({
      device: result.device,
      format: 'bgra8unorm',
      usage: expect.any(Number) // GPUTextureUsage.RENDER_ATTACHMENT | COPY_SRC
    }));
  });

  it('should create headless context when no canvas provided', async () => {
    const result = await createWebGPUContext();

    expect(result.device).toBeDefined();
    expect(result.context).toBeUndefined();
    expect(result.isHeadless).toBe(true);
    expect(result.format).toBe('rgba8unorm'); // Default headless format
  });

  it('should pass options to adapter and device creation', async () => {
    const options = {
      powerPreference: 'low-power' as GPUPowerPreference,
    };

    await createWebGPUContext(undefined, options);

    expect(navigator.gpu.requestAdapter).toHaveBeenCalledWith({
      powerPreference: 'low-power'
    });
  });

  it('should throw error if WebGPU is not supported', async () => {
    (global.navigator as any).gpu = undefined;

    await expect(createWebGPUContext()).rejects.toThrow('WebGPU is not supported');
  });

  it('should throw error if adapter creation fails', async () => {
    (navigator.gpu.requestAdapter as any).mockResolvedValue(null);

    await expect(createWebGPUContext()).rejects.toThrow('Failed to request WebGPU adapter');
  });

  it('should throw error if context creation from canvas fails', async () => {
    const canvas = {
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as HTMLCanvasElement;

    await expect(createWebGPUContext(canvas)).rejects.toThrow('Failed to get WebGPU context');
  });
});
