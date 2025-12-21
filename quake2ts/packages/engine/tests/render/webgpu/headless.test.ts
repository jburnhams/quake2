import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../../src/render/webgpu/headless';
import { setupWebGPUMocks, createMockGPUDevice } from '@quake2ts/test-utils';

describe('WebGPU Headless', () => {
  let device: ReturnType<typeof createMockGPUDevice>;

  beforeEach(() => {
    // We need to setup mocks first to ensure globals like GPUTextureUsage are defined
    setupWebGPUMocks();
    device = createMockGPUDevice();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-ignore
    delete global.navigator.gpu;
    // We keep globals defined as they are harmless and useful for subsequent tests in same file
  });

  it('should create a headless render target', () => {
    const target = createHeadlessRenderTarget(device as unknown as GPUDevice, 800, 600);

    expect(target.width).toBe(800);
    expect(target.height).toBe(600);
    expect(device.createTexture).toHaveBeenCalledWith(expect.objectContaining({
      size: { width: 800, height: 600, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    }));
  });

  it('should capture render target', async () => {
    const width = 2;
    const height = 2;

    // Create a mock texture with dimensions
    const texture = {
      width,
      height,
    } as unknown as GPUTexture;

    // Mock buffer mapping
    const mockBuffer = {
      mapAsync: vi.fn().mockResolvedValue(undefined),
      getMappedRange: vi.fn().mockReturnValue(new Uint8Array(width * height * 4).buffer), // All zeros
      unmap: vi.fn(),
    };
    device.createBuffer.mockReturnValue(mockBuffer);

    const data = await captureRenderTarget(device as unknown as GPUDevice, texture);

    expect(data).toBeInstanceOf(Uint8ClampedArray);
    expect(data.length).toBe(width * height * 4);
    expect(device.createCommandEncoder).toHaveBeenCalled();
    expect(device.queue.submit).toHaveBeenCalled();
    expect(mockBuffer.mapAsync).toHaveBeenCalled();
  });
});
