import { vi } from 'vitest';

export interface MockWebGPUContext {
  adapter: GPUAdapter;
  device: GPUDevice;
  queue: GPUQueue;
}

export function createMockGPUAdapter(options: Partial<GPUAdapter> = {}): GPUAdapter {
  return {
    features: new Set(),
    limits: {},
    isFallbackAdapter: false,
    requestDevice: vi.fn().mockResolvedValue(createMockGPUDevice()),
    requestAdapterInfo: vi.fn().mockResolvedValue({}),
    ...options,
  } as unknown as GPUAdapter;
}

export function createMockGPUDevice(features: Set<GPUFeatureName> = new Set()): GPUDevice {
  const queue = createMockQueue();

  return {
    features,
    limits: {},
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
  return {
    width: descriptor.size.width || 0,
    height: descriptor.size.height || 0,
    depthOrArrayLayers: descriptor.size.depthOrArrayLayers || 1,
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
