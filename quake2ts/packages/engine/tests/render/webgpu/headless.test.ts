import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../../src/render/webgpu/headless';

const mockCreateTexture = vi.fn();
const mockCreateView = vi.fn();
const mockCreateBuffer = vi.fn();
const mockCreateCommandEncoder = vi.fn();
const mockSubmit = vi.fn();
const mockCopyTextureToBuffer = vi.fn();
const mockFinish = vi.fn();
const mockBufferMapAsync = vi.fn();
const mockBufferGetMappedRange = vi.fn();
const mockBufferUnmap = vi.fn();
const mockBufferDestroy = vi.fn();

const mockDevice = {
  createTexture: mockCreateTexture,
  createBuffer: mockCreateBuffer,
  createCommandEncoder: mockCreateCommandEncoder,
  queue: {
    submit: mockSubmit,
  },
} as unknown as GPUDevice;

const mockTexture = {
  createView: mockCreateView,
} as unknown as GPUTexture;

const mockView = {} as unknown as GPUTextureView;

const mockBuffer = {
  mapAsync: mockBufferMapAsync,
  getMappedRange: mockBufferGetMappedRange,
  unmap: mockBufferUnmap,
  destroy: mockBufferDestroy,
} as unknown as GPUBuffer;

const mockCommandEncoder = {
  copyTextureToBuffer: mockCopyTextureToBuffer,
  finish: mockFinish,
} as unknown as GPUCommandEncoder;

describe('WebGPU Headless', () => {
  beforeAll(() => {
    // Mock WebGPU constants if not present in test environment
    if (!global.GPUTextureUsage) {
      (global as any).GPUTextureUsage = {
        RENDER_ATTACHMENT: 16,
        COPY_SRC: 1,
      };
    }
    if (!global.GPUBufferUsage) {
      (global as any).GPUBufferUsage = {
        COPY_DST: 8,
        MAP_READ: 1,
      };
    }
    if (!global.GPUMapMode) {
        (global as any).GPUMapMode = {
            READ: 1
        };
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTexture.mockReturnValue(mockTexture);
    mockCreateView.mockReturnValue(mockView);
    mockCreateBuffer.mockReturnValue(mockBuffer);
    mockCreateCommandEncoder.mockReturnValue(mockCommandEncoder);
    mockFinish.mockReturnValue({});
  });

  it('creates headless render target', () => {
    const target = createHeadlessRenderTarget(mockDevice, 800, 600);

    expect(target.width).toBe(800);
    expect(target.height).toBe(600);
    expect(target.texture).toBe(mockTexture);
    expect(target.view).toBe(mockView);
    expect(target.format).toBe('rgba8unorm');

    expect(mockCreateTexture).toHaveBeenCalledWith(expect.objectContaining({
      size: { width: 800, height: 600, depthOrArrayLayers: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    }));
  });

  it('captures render target', async () => {
    const width = 2;
    const height = 2;
    const target = {
      texture: mockTexture,
      view: mockView,
      width,
      height,
      format: 'rgba8unorm' as GPUTextureFormat,
    };

    // Prepare mock data (2x2 red pixels)
    // 256 bytes per row alignment required
    const paddedRowSize = 256;
    const bufferSize = paddedRowSize * height;
    const mockData = new Uint8Array(bufferSize);

    // Fill first row (2 pixels)
    mockData[0] = 255; mockData[1] = 0; mockData[2] = 0; mockData[3] = 255;
    mockData[4] = 255; mockData[5] = 0; mockData[6] = 0; mockData[7] = 255;

    // Fill second row (start at 256)
    mockData[256] = 255; mockData[257] = 0; mockData[258] = 0; mockData[259] = 255;
    mockData[260] = 255; mockData[261] = 0; mockData[262] = 0; mockData[263] = 255;

    mockBufferGetMappedRange.mockReturnValue(mockData.buffer);

    const result = await captureRenderTarget(mockDevice, target);

    expect(result.length).toBe(width * height * 4); // 16 bytes

    // Verify pixels are packed correctly (no padding in result)
    // Pixel 0
    expect(result[0]).toBe(255);
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(255);

    // Pixel 3 (last pixel)
    expect(result[12]).toBe(255);
    expect(result[13]).toBe(0);
    expect(result[14]).toBe(0);
    expect(result[15]).toBe(255);

    expect(mockCreateBuffer).toHaveBeenCalledWith(expect.objectContaining({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    }));

    expect(mockCopyTextureToBuffer).toHaveBeenCalledWith(
      { texture: mockTexture },
      { buffer: mockBuffer, bytesPerRow: paddedRowSize, rowsPerImage: height },
      { width, height, depthOrArrayLayers: 1 }
    );
  });
});
