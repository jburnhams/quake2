import { vi } from 'vitest';

export function createMockGPUAdapter(options?: Partial<GPUAdapter>): GPUAdapter {
  const adapter = {
    features: new Set(),
    limits: {
      maxTextureDimension2D: 8192,
      maxBindGroups: 4,
      maxUniformBufferBindingSize: 65536,
      maxStorageBufferBindingSize: 134217728,
    },
    requestDevice: vi.fn().mockResolvedValue(createMockGPUDevice()),
    requestAdapterInfo: vi.fn().mockResolvedValue({
      vendor: 'Mock Vendor',
      architecture: 'Mock Arch',
      device: 'Mock Device',
      description: 'Mock Adapter'
    }),
    ...options
  } as unknown as GPUAdapter;
  return adapter;
}

export function createMockGPUDevice(features?: Set<GPUFeatureName>): GPUDevice {
  const queue = createMockQueue();

  return {
    features: features || new Set(),
    limits: {
      maxTextureDimension2D: 8192,
    },
    queue,
    lost: new Promise(() => {}),
    createBuffer: vi.fn((descriptor: GPUBufferDescriptor) => createMockGPUBuffer(descriptor.size, descriptor.usage)),
    createTexture: vi.fn((descriptor: GPUTextureDescriptor) => createMockGPUTexture(descriptor.size, descriptor.format)),
    createSampler: vi.fn(),
    createBindGroupLayout: vi.fn().mockReturnValue({}),
    createPipelineLayout: vi.fn().mockReturnValue({}),
    createBindGroup: vi.fn().mockReturnValue({}),
    createShaderModule: vi.fn((descriptor: GPUShaderModuleDescriptor) => createMockShaderModule(descriptor.code)),
    createComputePipeline: vi.fn().mockReturnValue({}),
    createRenderPipeline: vi.fn(() => createMockRenderPipeline()),
    createCommandEncoder: vi.fn(() => createMockCommandEncoder()),
    createRenderBundleEncoder: vi.fn(),
    createQuerySet: vi.fn(),
    destroy: vi.fn(),
    pushErrorScope: vi.fn(),
    popErrorScope: vi.fn(),
    onuncapturederror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as GPUDevice;
}

export function createMockQueue(): GPUQueue {
  return {
    submit: vi.fn(),
    onSubmittedWorkDone: vi.fn().mockResolvedValue(undefined),
    writeBuffer: vi.fn(),
    writeTexture: vi.fn(),
    copyExternalImageToTexture: vi.fn(),
    label: '',
  } as unknown as GPUQueue;
}

export function createMockGPUBuffer(size: number, usage: GPUBufferUsageFlags): GPUBuffer {
  return {
    size,
    usage,
    mapState: 'unmapped',
    mapAsync: vi.fn().mockResolvedValue(undefined),
    getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(size)),
    unmap: vi.fn(),
    destroy: vi.fn(),
    label: '',
  } as unknown as GPUBuffer;
}

export function createMockGPUTexture(
  size: GPUExtent3D,
  format: GPUTextureFormat
): GPUTexture {
  let width: number;
  let height: number;
  let depthOrArrayLayers: number;

  if (typeof size === 'number') {
      width = size;
      height = 1;
      depthOrArrayLayers = 1;
  } else if (Array.isArray(size)) {
      width = size[0] || 1;
      height = size[1] || 1;
      depthOrArrayLayers = size[2] || 1;
  } else {
      // GPUExtent3DDict or similar
      const dict = size as any;
      width = dict.width;
      height = dict.height || 1;
      depthOrArrayLayers = dict.depthOrArrayLayers || 1;
  }

  return {
    width,
    height,
    depthOrArrayLayers,
    mipLevelCount: 1,
    sampleCount: 1,
    dimension: '2d',
    format,
    usage: 0,
    createView: vi.fn().mockReturnValue({}),
    destroy: vi.fn(),
    label: '',
  } as unknown as GPUTexture;
}

export function createMockShaderModule(code: string): GPUShaderModule {
  return {
    label: '',
    getCompilationInfo: vi.fn().mockResolvedValue({ messages: [] }),
  } as unknown as GPUShaderModule;
}

export function createMockRenderPipeline(): GPURenderPipeline {
  return {
    label: '',
    getBindGroupLayout: vi.fn().mockReturnValue({}),
  } as unknown as GPURenderPipeline;
}

export function createMockCommandEncoder(): GPUCommandEncoder {
  return {
    beginRenderPass: vi.fn().mockReturnValue({
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      setVertexBuffer: vi.fn(),
      setIndexBuffer: vi.fn(),
      setViewport: vi.fn(),
      setScissorRect: vi.fn(),
      setBlendConstant: vi.fn(),
      setStencilReference: vi.fn(),
      draw: vi.fn(),
      drawIndexed: vi.fn(),
      drawIndirect: vi.fn(),
      drawIndexedIndirect: vi.fn(),
      end: vi.fn(),
    }),
    beginComputePass: vi.fn().mockReturnValue({
       setPipeline: vi.fn(),
       setBindGroup: vi.fn(),
       dispatchWorkgroups: vi.fn(),
       dispatchWorkgroupsIndirect: vi.fn(),
       end: vi.fn(),
    }),
    copyBufferToBuffer: vi.fn(),
    copyBufferToTexture: vi.fn(),
    copyTextureToBuffer: vi.fn(),
    copyTextureToTexture: vi.fn(),
    clearBuffer: vi.fn(),
    resolveQuerySet: vi.fn(),
    finish: vi.fn().mockReturnValue({}),
    pushDebugGroup: vi.fn(),
    popDebugGroup: vi.fn(),
    insertDebugMarker: vi.fn(),
    label: '',
  } as unknown as GPUCommandEncoder;
}

export function createMockWebGPUContext() {
  const adapter = createMockGPUAdapter();
  const device = createMockGPUDevice();
  return {
    adapter,
    device,
    queue: device.queue,
  };
}

export function setupWebGPUMocks() {
  const mockAdapter = createMockGPUAdapter();
  const mockGpu = {
    requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
    getPreferredCanvasFormat: vi.fn().mockReturnValue('bgra8unorm'),
  };

  if (typeof global.navigator === 'undefined') {
    // @ts-ignore
    global.navigator = { gpu: mockGpu };
  } else {
    try {
        Object.defineProperty(global.navigator, 'gpu', {
            value: mockGpu,
            writable: true,
            configurable: true
        });
    } catch (e) {
        const originalNavigator = global.navigator;
        Object.defineProperty(global, 'navigator', {
            value: {
                ...originalNavigator,
                gpu: mockGpu
            },
            writable: true,
            configurable: true
        });
    }
  }

  // Mock GPU globals
  const constants = {
    GPUTextureUsage: {
      COPY_SRC: 0x01,
      COPY_DST: 0x02,
      TEXTURE_BINDING: 0x04,
      STORAGE_BINDING: 0x08,
      RENDER_ATTACHMENT: 0x10,
    },
    GPUBufferUsage: {
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
    },
    GPUMapMode: {
      READ: 0x0001,
      WRITE: 0x0002,
    },
    GPUShaderStage: {
        VERTEX: 1,
        FRAGMENT: 2,
        COMPUTE: 4
    }
  };

  Object.entries(constants).forEach(([key, value]) => {
     if (typeof (global as any)[key] === 'undefined') {
         (global as any)[key] = value;
     }
  });

  return {
    mockGpu,
    mockAdapter
  };
}
