import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../../src/render/webgpu/headless.js';

// Mock WebGPU globals
const mockCreateTexture = vi.fn();
const mockCreateView = vi.fn();
const mockCreateBuffer = vi.fn();
const mockCreateCommandEncoder = vi.fn();
const mockQueueSubmit = vi.fn();
const mockCopyTextureToBuffer = vi.fn();
const mockFinish = vi.fn();
const mockMapAsync = vi.fn();
const mockGetMappedRange = vi.fn();
const mockUnmap = vi.fn();
const mockDestroy = vi.fn();

const mockDevice = {
  createTexture: mockCreateTexture,
  createBuffer: mockCreateBuffer,
  createCommandEncoder: mockCreateCommandEncoder,
  queue: {
    submit: mockQueueSubmit,
  },
};

const mockTexture = {
  createView: mockCreateView,
  width: 16,
  height: 16,
  format: 'rgba8unorm', // Default for mock
};

const mockBuffer = {
  mapAsync: mockMapAsync,
  getMappedRange: mockGetMappedRange,
  unmap: mockUnmap,
  destroy: mockDestroy,
};

const mockEncoder = {
  copyTextureToBuffer: mockCopyTextureToBuffer,
  finish: mockFinish,
};

beforeEach(() => {
  vi.resetAllMocks();

  // Setup default mocks
  Object.defineProperty(global, 'GPUTextureUsage', {
    value: {
      RENDER_ATTACHMENT: 16,
      COPY_SRC: 1,
      TEXTURE_BINDING: 4,
    },
    writable: true,
  });

  Object.defineProperty(global, 'GPUBufferUsage', {
    value: {
      COPY_DST: 8,
      MAP_READ: 1,
    },
    writable: true,
  });

  Object.defineProperty(global, 'GPUMapMode', {
    value: {
      READ: 1,
    },
    writable: true,
  });

  mockCreateTexture.mockReturnValue(mockTexture);
  mockCreateView.mockReturnValue({});
  mockCreateBuffer.mockReturnValue(mockBuffer);
  mockCreateCommandEncoder.mockReturnValue(mockEncoder);
  mockFinish.mockReturnValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createHeadlessRenderTarget', () => {
  it('should create texture and view with correct descriptor', () => {
    const width = 100;
    const height = 100;

    const result = createHeadlessRenderTarget(mockDevice as unknown as GPUDevice, width, height);

    expect(mockCreateTexture).toHaveBeenCalledWith(expect.objectContaining({
      size: { width, height, depthOrArrayLayers: 1 },
      format: 'rgba8unorm',
      usage: 21, // 16 + 1 + 4
    }));

    expect(mockCreateView).toHaveBeenCalled();
    expect(result.width).toBe(width);
    expect(result.height).toBe(height);
    expect(result.texture).toBe(mockTexture);
    expect(result.view).toBeDefined();
  });

  it('should accept custom format', () => {
    createHeadlessRenderTarget(mockDevice as unknown as GPUDevice, 64, 64, 'bgra8unorm');
    expect(mockCreateTexture).toHaveBeenCalledWith(expect.objectContaining({
      format: 'bgra8unorm'
    }));
  });
});

describe('captureRenderTarget', () => {
  it('should read back texture data with correct stride', async () => {
    // Setup buffer data mock
    const width = 16;
    const height = 16;
    const bytesPerPixel = 4;
    const align = 256;
    const unpaddedBytesPerRow = width * bytesPerPixel; // 64
    const paddedBytesPerRow = Math.ceil(unpaddedBytesPerRow / align) * align; // 256
    const bufferSize = paddedBytesPerRow * height;

    const mockArrayBuffer = new ArrayBuffer(bufferSize);
    mockGetMappedRange.mockReturnValue(mockArrayBuffer);

    const texture = { width, height, format: 'rgba8unorm' } as unknown as GPUTexture;

    const result = await captureRenderTarget(mockDevice as unknown as GPUDevice, texture);

    expect(mockCreateBuffer).toHaveBeenCalledWith(expect.objectContaining({
      size: bufferSize,
      usage: 9 // 8 + 1
    }));

    expect(mockCopyTextureToBuffer).toHaveBeenCalledWith(
      { texture },
      { buffer: mockBuffer, bytesPerRow: paddedBytesPerRow },
      { width, height, depthOrArrayLayers: 1 }
    );

    expect(mockQueueSubmit).toHaveBeenCalled();
    expect(mockMapAsync).toHaveBeenCalled();
    expect(mockGetMappedRange).toHaveBeenCalled();
    expect(mockUnmap).toHaveBeenCalled();
    expect(mockDestroy).toHaveBeenCalled();

    expect(result).toBeInstanceOf(Uint8ClampedArray);
    expect(result.length).toBe(width * height * 4);
  });

  it('should handle different formats', async () => {
    // r8unorm = 1 byte per pixel
    const width = 16;
    const height = 16;
    const bytesPerPixel = 1;
    const align = 256;
    const unpaddedBytesPerRow = width * bytesPerPixel; // 16
    const paddedBytesPerRow = Math.ceil(unpaddedBytesPerRow / align) * align; // 256
    const bufferSize = paddedBytesPerRow * height;

    const mockArrayBuffer = new ArrayBuffer(bufferSize);
    mockGetMappedRange.mockReturnValue(mockArrayBuffer);

    const texture = { width, height, format: 'r8unorm' } as unknown as GPUTexture;

    const result = await captureRenderTarget(mockDevice as unknown as GPUDevice, texture);

    expect(result.length).toBe(width * height * bytesPerPixel);
  });

  it('should throw on unsupported format', async () => {
    const texture = { width: 16, height: 16, format: 'depth24plus' } as unknown as GPUTexture;
    await expect(captureRenderTarget(mockDevice as unknown as GPUDevice, texture)).rejects.toThrow('Unsupported texture format');
  });
});
