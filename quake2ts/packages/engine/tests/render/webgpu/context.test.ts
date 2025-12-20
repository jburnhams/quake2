import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebGPUContext, queryCapabilities, setupDeviceLossHandling } from '../../../src/render/webgpu/context';
import { setupWebGPUMocks } from '@quake2ts/test-utils';

describe('WebGPU Context', () => {
  let mocks: ReturnType<typeof setupWebGPUMocks>;

  beforeEach(() => {
    mocks = setupWebGPUMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-ignore
    delete global.navigator.gpu;
  });

  it('should create a WebGPU context with canvas', async () => {
    const canvas = {
      getContext: vi.fn().mockReturnValue({
        configure: vi.fn(),
      }),
    } as unknown as HTMLCanvasElement;

    const context = await createWebGPUContext(canvas);

    expect(context.device).toBeDefined();
    expect(context.adapter).toBeDefined();
    expect(context.context).toBeDefined();
    expect(context.isHeadless).toBe(false);
    expect(context.format).toBe('bgra8unorm');

    expect(canvas.getContext).toHaveBeenCalledWith('webgpu');
    // @ts-ignore
    const mockContext = canvas.getContext.mock.results[0].value;
    expect(mockContext.configure).toHaveBeenCalledWith(expect.objectContaining({
      device: context.device,
      format: 'bgra8unorm',
      alphaMode: 'premultiplied'
    }));
  });

  it('should create a headless WebGPU context', async () => {
    const context = await createWebGPUContext();

    expect(context.device).toBeDefined();
    expect(context.context).toBeUndefined();
    expect(context.isHeadless).toBe(true);
    expect(context.format).toBe('rgba8unorm');
  });

  it('should throw error if WebGPU is not supported', async () => {
    // @ts-ignore
    global.navigator.gpu = undefined;

    await expect(createWebGPUContext()).rejects.toThrow('WebGPU is not supported');
  });

  it('should throw error if adapter request fails', async () => {
    mocks.gpu.requestAdapter.mockResolvedValue(null);

    await expect(createWebGPUContext()).rejects.toThrow('Failed to request WebGPU adapter');
  });

  it('should validate required features', async () => {
    // The default mock adapter has no features enabled by default in our mock implementation unless specified
    // But let's check the logic by ensuring the adapter "doesn't have" a requested feature
    // Our mock adapter creation currently creates empty features set if none provided

    await expect(createWebGPUContext(undefined, {
      requiredFeatures: ['timestamp-query'] as any
    })).rejects.toThrow("Required WebGPU feature 'timestamp-query' is not supported");
  });

  it('should query capabilities correctly', async () => {
    const context = await createWebGPUContext();
    const caps = queryCapabilities(context);

    expect(caps.maxTextureDimension2D).toBe(8192);
    expect(caps.hasTimestampQuery).toBe(false);
  });

  it('should handle device loss', async () => {
    const context = await createWebGPUContext();
    const onLost = vi.fn();

    setupDeviceLossHandling(context.device, onLost);

    // Simulate device loss (this depends on how we mocked the promise)
    // In our simple mock, we just created a promise that never resolves.
    // To test this, we'd need to be able to resolve/reject that promise from the outside
    // or mock the 'lost' property getter.

    // Let's replace the 'lost' property on the device mock for this test
    const lossPromise = Promise.resolve({ reason: 'destroyed', message: 'test loss' });
    // @ts-ignore
    context.device.lost = lossPromise;

    // We need to re-setup or trigger the handler.
    // Since we replaced the promise *after* creation, we need to call setup again or modify creation.
    // Let's just call setup again with the new promise.
    setupDeviceLossHandling(context.device, onLost);

    // Wait for promise resolution
    await lossPromise;
    // Tick the microtask queue
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onLost).toHaveBeenCalledWith('destroyed', 'test loss');
  });
});
