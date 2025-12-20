
import { vi } from 'vitest';

export function createMockGPUAdapter(): Partial<GPUAdapter> {
  return {
    requestDevice: vi.fn().mockResolvedValue(createMockGPUDevice()),
    features: new Set() as any,
    limits: {} as any,
  };
}

export function createMockGPUDevice(): Partial<GPUDevice> {
  return {
    features: new Set() as any,
    limits: {} as any,
    queue: {
      submit: vi.fn(),
      writeBuffer: vi.fn(),
      writeTexture: vi.fn(),
      copyExternalImageToTexture: vi.fn(),
    } as any,
    createCommandEncoder: vi.fn().mockReturnValue({
      beginRenderPass: vi.fn().mockReturnValue({
        setPipeline: vi.fn(),
        draw: vi.fn(),
        end: vi.fn(),
      }),
      finish: vi.fn(),
    }),
    createRenderPipeline: vi.fn(),
    createShaderModule: vi.fn(),
    createBindGroup: vi.fn(),
    createBindGroupLayout: vi.fn(),
    createBuffer: vi.fn(),
    createTexture: vi.fn(),
    createSampler: vi.fn(),
  };
}

export function createMockGPUCanvasContext(): Partial<GPUCanvasContext> {
  return {
    configure: vi.fn(),
    unconfigure: vi.fn(),
    getCurrentTexture: vi.fn(),
  };
}

export function setupWebGPUMocks() {
  const mockAdapter = createMockGPUAdapter();

  // Mock navigator.gpu
  const mockGpu = {
    requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
    getPreferredCanvasFormat: vi.fn().mockReturnValue('bgra8unorm'),
  };

  // Assign to global navigator
  Object.defineProperty(global.navigator, 'gpu', {
    value: mockGpu,
    writable: true,
    configurable: true,
  });

  // Mock global GPUTextureUsage
  (global as any).GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
}
