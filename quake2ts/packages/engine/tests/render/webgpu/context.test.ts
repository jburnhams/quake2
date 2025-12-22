import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebGPUContext, WebGPUContextOptions } from '../../../src/render/webgpu/context';

// Mocks
const mockDestroy = vi.fn();
const mockConfigure = vi.fn();
const mockGetContext = vi.fn();

const mockDevice = {
  features: {
    keys: () => ['texture-compression-bc'],
    has: (feature: string) => feature === 'texture-compression-bc',
  },
  limits: {
    maxTextureDimension2D: 8192,
  },
  destroy: mockDestroy,
  lost: Promise.resolve({ reason: 'destroyed', message: 'Device destroyed' }),
} as unknown as GPUDevice;

const mockAdapter = {
  features: {
    keys: () => ['texture-compression-bc'],
    has: (feature: string) => feature === 'texture-compression-bc',
  },
  requestDevice: vi.fn().mockResolvedValue(mockDevice),
} as unknown as GPUAdapter;

const mockNavigatorGpu = {
  requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
  getPreferredCanvasFormat: () => 'bgra8unorm',
};

describe('WebGPU Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).navigator = {
      gpu: mockNavigatorGpu,
    };
  });

  afterEach(() => {
    delete (global as any).navigator;
  });

  it('throws if WebGPU is not supported', async () => {
    delete (global as any).navigator.gpu;
    await expect(createWebGPUContext()).rejects.toThrow('WebGPU not supported');
  });

  it('throws if adapter cannot be created', async () => {
    mockNavigatorGpu.requestAdapter.mockResolvedValueOnce(null);
    await expect(createWebGPUContext()).rejects.toThrow('Failed to request WebGPU adapter');
  });

  it('creates context with canvas', async () => {
    const mockCanvas = {
      getContext: mockGetContext.mockReturnValue({
        configure: mockConfigure,
      }),
    } as unknown as HTMLCanvasElement;

    const ctx = await createWebGPUContext(mockCanvas);

    expect(ctx.device).toBe(mockDevice);
    expect(ctx.adapter).toBe(mockAdapter);
    expect(ctx.isHeadless).toBe(false);
    expect(ctx.format).toBe('bgra8unorm');
    expect(mockGetContext).toHaveBeenCalledWith('webgpu');
    expect(mockConfigure).toHaveBeenCalledWith(expect.objectContaining({
      device: mockDevice,
      format: 'bgra8unorm',
    }));
  });

  it('creates headless context', async () => {
    const ctx = await createWebGPUContext();

    expect(ctx.device).toBe(mockDevice);
    expect(ctx.isHeadless).toBe(true);
    expect(ctx.context).toBeUndefined();
    // Default headless format
    expect(ctx.format).toBe('rgba8unorm');
  });

  it('validates required features', async () => {
    await expect(createWebGPUContext(undefined, {
      requiredFeatures: ['timestamp-query' as GPUFeatureName],
    })).rejects.toThrow('Required WebGPU feature not available');
  });

  it('passes options to requestAdapter', async () => {
    await createWebGPUContext(undefined, {
      powerPreference: 'low-power',
    });
    expect(mockNavigatorGpu.requestAdapter).toHaveBeenCalledWith({
      powerPreference: 'low-power',
    });
  });

  it('disposes correctly', async () => {
    const ctx = await createWebGPUContext();
    ctx.dispose();
    expect(mockDestroy).toHaveBeenCalled();
  });
});
