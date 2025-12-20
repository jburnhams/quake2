import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebGPUContext, WebGPUContextOptions, WebGPUContextState, queryCapabilities, setupDeviceLossHandling } from '../../../src/render/webgpu/context.js';

// Mock WebGPU globals
const mockRequestAdapter = vi.fn();
const mockRequestDevice = vi.fn();
const mockGetContext = vi.fn();
const mockConfigure = vi.fn();
const mockGetPreferredCanvasFormat = vi.fn();

const mockAdapter = {
  features: new Set(['timestamp-query', 'depth-clip-control']),
  requestDevice: mockRequestDevice,
};

const mockDevice = {
  limits: {
    maxTextureDimension2D: 8192,
    maxBindGroups: 4,
    maxUniformBufferBindingSize: 65536,
    maxStorageBufferBindingSize: 134217728,
  },
  lost: Promise.resolve({ reason: 'destroyed' }),
};

const mockContext = {
  configure: mockConfigure,
};

beforeEach(() => {
  vi.resetAllMocks();

  // Setup default mocks
  Object.defineProperty(global, 'navigator', {
    value: {
      gpu: {
        requestAdapter: mockRequestAdapter,
        getPreferredCanvasFormat: mockGetPreferredCanvasFormat,
      },
    },
    writable: true,
  });

  mockRequestAdapter.mockResolvedValue(mockAdapter);
  mockRequestDevice.mockResolvedValue(mockDevice);
  mockGetContext.mockReturnValue(mockContext);
  mockGetPreferredCanvasFormat.mockReturnValue('bgra8unorm');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createWebGPUContext', () => {
  it('should throw if navigator.gpu is undefined', async () => {
    Object.defineProperty(global, 'navigator', { value: {} });
    await expect(createWebGPUContext()).rejects.toThrow('WebGPU is not supported');
  });

  it('should throw if requestAdapter fails', async () => {
    mockRequestAdapter.mockResolvedValue(null);
    await expect(createWebGPUContext()).rejects.toThrow('Failed to request WebGPU adapter');
  });

  it('should request adapter with power preference', async () => {
    const options: WebGPUContextOptions = { powerPreference: 'low-power' };
    await createWebGPUContext(undefined, options);
    expect(mockRequestAdapter).toHaveBeenCalledWith({ powerPreference: 'low-power' });
  });

  it('should throw if required feature is missing', async () => {
    const options: WebGPUContextOptions = { requiredFeatures: ['texture-compression-bc'] };
    await expect(createWebGPUContext(undefined, options)).rejects.toThrow("Required feature 'texture-compression-bc' is not supported");
  });

  it('should create context with canvas', async () => {
    const mockCanvas = {
      getContext: mockGetContext,
    } as unknown as HTMLCanvasElement;

    const result = await createWebGPUContext(mockCanvas);

    expect(mockGetContext).toHaveBeenCalledWith('webgpu');
    expect(mockConfigure).toHaveBeenCalledWith(expect.objectContaining({
      device: mockDevice,
      format: 'bgra8unorm',
      alphaMode: 'premultiplied'
    }));
    expect(result.context).toBe(mockContext);
    expect(result.isHeadless).toBe(false);
  });

  it('should create headless context', async () => {
    const result = await createWebGPUContext();
    expect(result.context).toBeUndefined();
    expect(result.isHeadless).toBe(true);
    // Since getPreferredCanvasFormat is mocked to return 'bgra8unorm', and our headless logic now uses it if available
    expect(result.format).toBe('bgra8unorm');
  });
});

describe('queryCapabilities', () => {
  it('should correctly map capabilities', () => {
    const state = {
      adapter: mockAdapter,
      device: mockDevice,
    } as unknown as WebGPUContextState;

    const capabilities = queryCapabilities(state);

    expect(capabilities.hasTimestampQuery).toBe(true);
    expect(capabilities.hasDepthClipControl).toBe(true);
    expect(capabilities.hasTextureCompressionBC).toBe(false);
    expect(capabilities.maxTextureDimension2D).toBe(8192);
  });
});

describe('setupDeviceLossHandling', () => {
  it('should register loss handler', async () => {
    const onLost = vi.fn();
    const mockLostPromise = Promise.resolve({ reason: 'destroyed' as GPUDeviceLostReason });
    const device = { lost: mockLostPromise } as unknown as GPUDevice;

    setupDeviceLossHandling(device, onLost);

    await mockLostPromise;
    expect(onLost).toHaveBeenCalledWith('destroyed');
  });
});
