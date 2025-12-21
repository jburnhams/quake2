import { vi } from 'vitest';

export function createMockGPUAdapter() {
  return {
    features: new Set(),
    limits: {
      maxTextureDimension2D: 8192,
      maxBindGroups: 4,
      maxUniformBufferBindingSize: 65536,
      maxStorageBufferBindingSize: 134217728,
    },
    requestDevice: vi.fn().mockResolvedValue(createMockGPUDevice()),
  } as unknown as GPUAdapter;
}

export function createMockGPUDevice() {
  return {
    features: new Set(),
    limits: {
      maxTextureDimension2D: 8192,
    },
    lost: new Promise(() => {}), // Pending promise
    createShaderModule: vi.fn(),
    createBindGroupLayout: vi.fn(),
    createPipelineLayout: vi.fn(),
    createRenderPipeline: vi.fn(),
    createCommandEncoder: vi.fn().mockReturnValue({
      copyTextureToBuffer: vi.fn(),
      finish: vi.fn(),
    }),
    createBuffer: vi.fn(),
    createTexture: vi.fn().mockReturnValue({
      createView: vi.fn(),
    }),
    queue: {
      submit: vi.fn(),
      writeBuffer: vi.fn(),
      writeTexture: vi.fn(),
    },
  } as unknown as GPUDevice;
}

export function createMockGPUCanvasContext() {
  return {
    configure: vi.fn(),
    getCurrentTexture: vi.fn(),
  } as unknown as GPUCanvasContext;
}

export function setupWebGPUMocks() {
  const mockAdapter = createMockGPUAdapter();
  const mockGpu = {
    requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
    getPreferredCanvasFormat: vi.fn().mockReturnValue('bgra8unorm'),
  };

  // Mock global navigator.gpu
  Object.defineProperty(global, 'navigator', {
    value: {
      ...global.navigator,
      gpu: mockGpu,
    },
    writable: true,
  });

  // Mock GPU globals if they don't exist
  if (typeof GPUTextureUsage === 'undefined') {
    (global as any).GPUTextureUsage = {
      COPY_SRC: 0x01,
      COPY_DST: 0x02,
      TEXTURE_BINDING: 0x04,
      STORAGE_BINDING: 0x08,
      RENDER_ATTACHMENT: 0x10,
    };
  }

  if (typeof GPUBufferUsage === 'undefined') {
    (global as any).GPUBufferUsage = {
      MAP_READ: 0x0001,
      MAP_WRITE: 0x0002,
      COPY_SRC: 0x0004,
      COPY_DST: 0x0008,
      INDEX: 0x0010,
      VERTEX: 0x0020,
      UNIFORM: 0x0040,
      STORAGE: 0x0080,
      INDIRECT: 0x0100,
      QUERY_RESOLVE: 0x0200,
    };
  }

  if (typeof GPUMapMode === 'undefined') {
    (global as any).GPUMapMode = {
      READ: 0x0001,
      WRITE: 0x0002,
    };
  }

  return {
    mockGpu,
    mockAdapter
  };
}
