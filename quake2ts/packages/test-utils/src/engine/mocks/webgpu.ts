import { vi } from 'vitest';

export interface MockGPUAdapterOptions {
  features?: Set<string>;
  limits?: Record<string, number>;
}

export function createMockGPUAdapter(options: MockGPUAdapterOptions = {}) {
  const features = new Set(options.features || []);

  return {
    features: {
      has: (feature: string) => features.has(feature),
      [Symbol.iterator]: features[Symbol.iterator].bind(features),
    },
    limits: options.limits || {
      maxTextureDimension2D: 8192,
      maxBindGroups: 4,
      maxUniformBufferBindingSize: 16384,
      maxStorageBufferBindingSize: 134217728,
    },
    requestDevice: vi.fn().mockImplementation(async (descriptor) => createMockGPUDevice(descriptor)),
  };
}

export function createMockGPUDevice(descriptor: any = {}) {
  const features = new Set(descriptor?.requiredFeatures || []);

  return {
    features: {
      has: (feature: string) => features.has(feature),
      [Symbol.iterator]: features[Symbol.iterator].bind(features),
    },
    limits: {
      maxTextureDimension2D: 8192,
      maxBindGroups: 4,
      maxUniformBufferBindingSize: 16384,
      maxStorageBufferBindingSize: 134217728,
      ...descriptor?.requiredLimits
    },
    queue: {
      submit: vi.fn(),
      writeBuffer: vi.fn(),
      writeTexture: vi.fn(),
    },
    createCommandEncoder: vi.fn().mockReturnValue({
      beginRenderPass: vi.fn().mockReturnValue({
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        setVertexBuffer: vi.fn(),
        setIndexBuffer: vi.fn(),
        draw: vi.fn(),
        drawIndexed: vi.fn(),
        end: vi.fn(),
      }),
      copyTextureToBuffer: vi.fn(),
      finish: vi.fn(),
    }),
    createBindGroup: vi.fn(),
    createBindGroupLayout: vi.fn(),
    createPipelineLayout: vi.fn(),
    createRenderPipeline: vi.fn(),
    createShaderModule: vi.fn(),
    createBuffer: vi.fn(),
    createTexture: vi.fn().mockReturnValue({
        createView: vi.fn(),
        width: descriptor?.size?.width || 0,
        height: descriptor?.size?.height || 0,
    }),
    createSampler: vi.fn(),
    lost: new Promise((resolve) => {}), // Never resolves by default
    destroy: vi.fn(),
  };
}

export function setupWebGPUMocks() {
  const adapter = createMockGPUAdapter();
  const gpu = {
    requestAdapter: vi.fn().mockResolvedValue(adapter),
    getPreferredCanvasFormat: vi.fn().mockReturnValue('bgra8unorm'),
  };

  // @ts-ignore
  global.navigator = global.navigator || {};
  // @ts-ignore
  global.navigator.gpu = gpu;

  // Polyfill WebGPU constants for Node environment tests
  if (!global.GPUTextureUsage) {
    // @ts-ignore
    global.GPUTextureUsage = {
      COPY_SRC: 0x01,
      COPY_DST: 0x02,
      TEXTURE_BINDING: 0x04,
      STORAGE_BINDING: 0x08,
      RENDER_ATTACHMENT: 0x10,
    };
  }

  if (!global.GPUBufferUsage) {
    // @ts-ignore
    global.GPUBufferUsage = {
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

  if (!global.GPUMapMode) {
    // @ts-ignore
    global.GPUMapMode = {
      READ: 0x0001,
      WRITE: 0x0002,
    };
  }

  return { gpu, adapter };
}
