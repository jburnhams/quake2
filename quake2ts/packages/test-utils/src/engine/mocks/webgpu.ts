import { vi } from 'vitest';
import { globals } from 'webgpu';
import { LegacyMock } from '../../vitest-compat.js';

export interface MockWebGPUContext {
  adapter: GPUAdapter;
  device: GPUDevice;
  queue: GPUQueue;
}

export interface WebGPUMocks {
  mockGpu: {
    requestAdapter: LegacyMock<[GPURequestAdapterOptions?], Promise<GPUAdapter | null>>;
    getPreferredCanvasFormat: LegacyMock<[], GPUTextureFormat>;
  };
  mockAdapter: GPUAdapter;
  mockDevice: GPUDevice;
}

/**
 * Patches globalThis with WebGPU globals (GPUBufferUsage, etc.)
 * and optionally patches navigator.gpu.
 */
export function setupWebGPUMocks(): WebGPUMocks {
    // 1. Inject globals like GPUBufferUsage, GPUTextureUsage
    Object.assign(globalThis, globals);

    // Create mocks for Adapter and Device first so we can use them in the GPU mock
    const mockAdapter = createMockGPUAdapter();
    const mockDevice = createMockGPUDevice();

    // 2. Setup Navigator mock
    const mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue(mockAdapter) as unknown as LegacyMock<[GPURequestAdapterOptions?], Promise<GPUAdapter | null>>,
      getPreferredCanvasFormat: vi.fn().mockReturnValue('bgra8unorm') as unknown as LegacyMock<[], GPUTextureFormat>,
    };

    // Wire them up
    // @ts-ignore - vitest mock manipulation
    mockAdapter.requestDevice.mockResolvedValue(mockDevice);

    if (!globalThis.navigator) {
      // @ts-ignore
      globalThis.navigator = {};
    }

    // Safely redefine navigator.gpu
    try {
        // If it exists and is configurable, define it.
        // If it doesn't exist, define it.
        // If it exists and is NOT configurable, we can't do much (but that shouldn't happen in our test env if we control it)
        Object.defineProperty(globalThis.navigator, 'gpu', {
            value: mockGpu,
            writable: true,
            configurable: true
        });
    } catch (e) {
        // Fallback: simple assignment if defineProperty fails (e.g. some JSDOM quirks)
        // @ts-ignore
        globalThis.navigator.gpu = mockGpu;
    }

    return {
      mockGpu,
      mockAdapter,
      mockDevice
    };
}

export function createMockGPUAdapter(options: Partial<GPUAdapter> = {}): GPUAdapter {
  // Mock GPU limits with reasonable default values (same as device)
  const limits = {
    maxTextureDimension1D: 8192,
    maxTextureDimension2D: 8192,
    maxTextureDimension3D: 2048,
    maxTextureArrayLayers: 256,
    maxBindGroups: 4,
    maxBindGroupsPlusVertexBuffers: 24,
    maxBindingsPerBindGroup: 1000,
    maxDynamicUniformBuffersPerPipelineLayout: 8,
    maxDynamicStorageBuffersPerPipelineLayout: 4,
    maxSampledTexturesPerShaderStage: 16,
    maxSamplersPerShaderStage: 16,
    maxStorageBuffersPerShaderStage: 8,
    maxStorageTexturesPerShaderStage: 4,
    maxUniformBuffersPerShaderStage: 12,
    maxUniformBufferBindingSize: 65536,
    maxStorageBufferBindingSize: 134217728,
    minUniformBufferOffsetAlignment: 256,
    minStorageBufferOffsetAlignment: 256,
    maxVertexBuffers: 8,
    maxBufferSize: 268435456,
    maxVertexAttributes: 16,
    maxVertexBufferArrayStride: 2048,
    maxInterStageShaderComponents: 60,
    maxInterStageShaderVariables: 16,
    maxColorAttachments: 8,
    maxColorAttachmentBytesPerSample: 32,
    maxComputeWorkgroupStorageSize: 16384,
    maxComputeInvocationsPerWorkgroup: 256,
    maxComputeWorkgroupSizeX: 256,
    maxComputeWorkgroupSizeY: 256,
    maxComputeWorkgroupSizeZ: 64,
    maxComputeWorkgroupsPerDimension: 65535,
  } as unknown as GPUSupportedLimits;

  return {
    features: new Set(),
    limits,
    isFallbackAdapter: false,
    requestDevice: vi.fn().mockResolvedValue(createMockGPUDevice()),
    requestAdapterInfo: vi.fn().mockResolvedValue({}),
    ...options,
  } as unknown as GPUAdapter;
}

export function createMockGPUDevice(features: Set<GPUFeatureName> = new Set()): GPUDevice {
  const queue = createMockQueue();

  // Mock GPU limits with reasonable default values
  // Based on WebGPU spec default limits
  const limits = {
    maxTextureDimension1D: 8192,
    maxTextureDimension2D: 8192,
    maxTextureDimension3D: 2048,
    maxTextureArrayLayers: 256,
    maxBindGroups: 4,
    maxBindGroupsPlusVertexBuffers: 24,
    maxBindingsPerBindGroup: 1000,
    maxDynamicUniformBuffersPerPipelineLayout: 8,
    maxDynamicStorageBuffersPerPipelineLayout: 4,
    maxSampledTexturesPerShaderStage: 16,
    maxSamplersPerShaderStage: 16,
    maxStorageBuffersPerShaderStage: 8,
    maxStorageTexturesPerShaderStage: 4,
    maxUniformBuffersPerShaderStage: 12,
    maxUniformBufferBindingSize: 65536,
    maxStorageBufferBindingSize: 134217728,
    minUniformBufferOffsetAlignment: 256,
    minStorageBufferOffsetAlignment: 256,
    maxVertexBuffers: 8,
    maxBufferSize: 268435456,
    maxVertexAttributes: 16,
    maxVertexBufferArrayStride: 2048,
    maxInterStageShaderComponents: 60,
    maxInterStageShaderVariables: 16,
    maxColorAttachments: 8,
    maxColorAttachmentBytesPerSample: 32,
    maxComputeWorkgroupStorageSize: 16384,
    maxComputeInvocationsPerWorkgroup: 256,
    maxComputeWorkgroupSizeX: 256,
    maxComputeWorkgroupSizeY: 256,
    maxComputeWorkgroupSizeZ: 64,
    maxComputeWorkgroupsPerDimension: 65535,
  } as unknown as GPUSupportedLimits;

  return {
    features,
    limits,
    queue,
    destroy: vi.fn(),
    createBuffer: vi.fn((descriptor: GPUBufferDescriptor) => createMockGPUBuffer(descriptor)),
    createTexture: vi.fn((descriptor: GPUTextureDescriptor) => createMockGPUTexture(descriptor)),
    createSampler: vi.fn(() => createMockSampler()),
    createBindGroupLayout: vi.fn(() => ({ label: 'mock-bind-group-layout' })),
    createPipelineLayout: vi.fn(() => ({ label: 'mock-pipeline-layout' })),
    createBindGroup: vi.fn(() => ({ label: 'mock-bind-group' })),
    createShaderModule: vi.fn((descriptor: GPUShaderModuleDescriptor) => createMockShaderModule(descriptor)),
    createComputePipeline: vi.fn(() => createMockComputePipeline()),
    createRenderPipeline: vi.fn(() => createMockRenderPipeline()),
    createComputePipelineAsync: vi.fn().mockResolvedValue(createMockComputePipeline()),
    createRenderPipelineAsync: vi.fn().mockResolvedValue(createMockRenderPipeline()),
    createCommandEncoder: vi.fn(() => createMockCommandEncoder()),
    createQuerySet: vi.fn(() => ({ label: 'mock-query-set' })),
    pushErrorScope: vi.fn(),
    popErrorScope: vi.fn().mockResolvedValue(null),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onuncapturederror: null,
    label: '',
    lost: Promise.resolve({ reason: 'destroyed', message: 'Device lost' }),
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

export function createMockGPUBuffer(descriptor: GPUBufferDescriptor): GPUBuffer {
  return {
    size: descriptor.size,
    usage: descriptor.usage,
    mapState: 'unmapped',
    mapAsync: vi.fn().mockResolvedValue(undefined),
    getMappedRange: vi.fn(() => new ArrayBuffer(descriptor.size)),
    unmap: vi.fn(),
    destroy: vi.fn(),
    label: descriptor.label || '',
  } as unknown as GPUBuffer;
}

export function createMockGPUTexture(descriptor: GPUTextureDescriptor): GPUTexture {
  const size = descriptor.size;
  let width = 0;
  let height = 0;
  let depthOrArrayLayers = 1;

  if (Array.isArray(size) || size instanceof Float32Array || size instanceof Uint32Array) {
      // Iterable<number>
      const arr = Array.from(size as Iterable<number>);
      width = arr[0] || 0;
      height = arr[1] || 1;
      depthOrArrayLayers = arr[2] || 1;
  } else if (typeof size === 'object') {
      // GPUExtent3DDict
      const dict = size as GPUExtent3DDict;
      width = dict.width;
      height = dict.height || 1;
      depthOrArrayLayers = dict.depthOrArrayLayers || 1;
  }

  return {
    width,
    height,
    depthOrArrayLayers,
    mipLevelCount: descriptor.mipLevelCount || 1,
    sampleCount: descriptor.sampleCount || 1,
    dimension: descriptor.dimension || '2d',
    format: descriptor.format,
    usage: descriptor.usage,
    createView: vi.fn(() => createMockTextureView()),
    destroy: vi.fn(),
    label: descriptor.label || '',
  } as unknown as GPUTexture;
}

export function createMockTextureView(): GPUTextureView {
  return {
    label: '',
  } as unknown as GPUTextureView;
}

export function createMockSampler(): GPUSampler {
  return {
    label: '',
  } as unknown as GPUSampler;
}

export function createMockShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule {
  return {
    getCompilationInfo: vi.fn().mockResolvedValue({ messages: [] }),
    label: descriptor.label || '',
  } as unknown as GPUShaderModule;
}

export function createMockComputePipeline(): GPUComputePipeline {
  return {
    getBindGroupLayout: vi.fn(() => ({ label: 'mock-bind-group-layout' })),
    label: '',
  } as unknown as GPUComputePipeline;
}

export function createMockRenderPipeline(): GPURenderPipeline {
  return {
    getBindGroupLayout: vi.fn(() => ({ label: 'mock-bind-group-layout' })),
    label: '',
  } as unknown as GPURenderPipeline;
}

export function createMockCommandEncoder(): GPUCommandEncoder {
  return {
    beginRenderPass: vi.fn(() => createMockRenderPassEncoder()),
    beginComputePass: vi.fn(() => createMockComputePassEncoder()),
    copyBufferToBuffer: vi.fn(),
    copyBufferToTexture: vi.fn(),
    copyTextureToBuffer: vi.fn(),
    copyTextureToTexture: vi.fn(),
    clearBuffer: vi.fn(),
    writeTimestamp: vi.fn(),
    resolveQuerySet: vi.fn(),
    finish: vi.fn(() => ({ label: 'mock-command-buffer' })),
    pushDebugGroup: vi.fn(),
    popDebugGroup: vi.fn(),
    insertDebugMarker: vi.fn(),
    label: '',
  } as unknown as GPUCommandEncoder;
}

export function createMockRenderPassEncoder(): GPURenderPassEncoder {
  return {
    setPipeline: vi.fn(),
    setIndexBuffer: vi.fn(),
    setVertexBuffer: vi.fn(),
    setBindGroup: vi.fn(),
    setViewport: vi.fn(),
    setScissorRect: vi.fn(),
    setBlendConstant: vi.fn(),
    setStencilReference: vi.fn(),
    beginOcclusionQuery: vi.fn(),
    endOcclusionQuery: vi.fn(),
    executeBundles: vi.fn(),
    draw: vi.fn(),
    drawIndexed: vi.fn(),
    drawIndirect: vi.fn(),
    drawIndexedIndirect: vi.fn(),
    end: vi.fn(),
    pushDebugGroup: vi.fn(),
    popDebugGroup: vi.fn(),
    insertDebugMarker: vi.fn(),
    label: '',
  } as unknown as GPURenderPassEncoder;
}

export function createMockComputePassEncoder(): GPUComputePassEncoder {
  return {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    dispatchWorkgroups: vi.fn(),
    dispatchWorkgroupsIndirect: vi.fn(),
    end: vi.fn(),
    pushDebugGroup: vi.fn(),
    popDebugGroup: vi.fn(),
    insertDebugMarker: vi.fn(),
    label: '',
  } as unknown as GPUComputePassEncoder;
}

export function createMockWebGPUContext(): MockWebGPUContext {
  const adapter = createMockGPUAdapter();
  const device = createMockGPUDevice();
  return {
    adapter,
    device,
    queue: device.queue,
  };
}

/**
 * Cleans up WebGPU mocks from globalThis.
 * Should be called in afterAll hooks to prevent memory leaks.
 */
export function teardownWebGPUMocks(): void {
  // Remove navigator.gpu if it was set by setupWebGPUMocks
  if (globalThis.navigator?.gpu) {
    try {
      delete (globalThis.navigator as any).gpu;
    } catch (e) {
      // If delete fails (read-only), try setting to undefined
      (globalThis.navigator as any).gpu = undefined;
    }
  }

  // Note: GPU* globals (GPUBufferUsage, etc.) injected via Object.assign(globalThis, globals)
  // are harder to clean up as we don't track which ones were added.
  // For now, we leave them as they're mostly constants and unlikely to cause significant leaks.
}
