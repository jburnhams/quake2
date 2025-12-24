/// <reference types="@webgpu/types" />

// ============================================================================
// TASK 7: Memory Tracking & Profiling
// ============================================================================

export interface ResourceTracker {
  trackBuffer(buffer: GPUBufferResource): void;
  trackTexture(texture: Texture2D | TextureCubeMap): void;
  untrackBuffer(buffer: GPUBufferResource): void;
  untrackTexture(texture: Texture2D | TextureCubeMap): void;
}

export class GPUResourceTracker implements ResourceTracker {
  private _totalBufferMemory = 0;
  private _totalTextureMemory = 0;
  private _bufferCount = 0;
  private _textureCount = 0;

  // Detailed tracking by type could be added here if needed

  trackBuffer(buffer: GPUBufferResource): void {
    this._totalBufferMemory += buffer.size;
    this._bufferCount++;
  }

  trackTexture(texture: Texture2D | TextureCubeMap): void {
    this._totalTextureMemory += texture.memorySize;
    this._textureCount++;
  }

  untrackBuffer(buffer: GPUBufferResource): void {
    this._totalBufferMemory -= buffer.size;
    this._bufferCount--;
  }

  untrackTexture(texture: Texture2D | TextureCubeMap): void {
    this._totalTextureMemory -= texture.memorySize;
    this._textureCount--;
  }

  get totalBufferMemory(): number {
    return this._totalBufferMemory;
  }

  get totalTextureMemory(): number {
    return this._totalTextureMemory;
  }

  get bufferCount(): number {
    return this._bufferCount;
  }

  get textureCount(): number {
    return this._textureCount;
  }

  reset(): void {
    this._totalBufferMemory = 0;
    this._totalTextureMemory = 0;
    this._bufferCount = 0;
    this._textureCount = 0;
  }
}

// Global tracker instance (singleton)
let globalTracker: ResourceTracker | undefined;

export function setResourceTracker(tracker: ResourceTracker) {
  globalTracker = tracker;
}

// Helper to get the current global tracker (for testing or usage)
export function getResourceTracker(): ResourceTracker | undefined {
  return globalTracker;
}


// ============================================================================
// TASK 1: Buffer Abstractions
// ============================================================================

export class GPUBufferResource {
  public readonly buffer: GPUBuffer;
  public readonly size: number;
  public readonly usage: GPUBufferUsageFlags;

  constructor(
    protected readonly device: GPUDevice,
    descriptor: {
      size: number;
      usage: GPUBufferUsageFlags;
      label?: string;
      mappedAtCreation?: boolean;
    }
  ) {
    this.size = descriptor.size;
    this.usage = descriptor.usage;

    this.buffer = device.createBuffer({
      size: this.size,
      usage: this.usage,
      label: descriptor.label,
      mappedAtCreation: descriptor.mappedAtCreation
    });

    globalTracker?.trackBuffer(this);
  }

  write(data: BufferSource, offset = 0): void {
    this.device.queue.writeBuffer(
      this.buffer,
      offset,
      data,
      0, // dataOffset
      data.byteLength // size
    );
  }

  async mapAsync(mode: GPUMapModeFlags, offset = 0, size?: number): Promise<void> {
    await this.buffer.mapAsync(mode, offset, size);
  }

  getMappedRange(offset = 0, size?: number): ArrayBuffer {
    return this.buffer.getMappedRange(offset, size);
  }

  unmap(): void {
    this.buffer.unmap();
  }

  destroy(): void {
    globalTracker?.untrackBuffer(this);
    this.buffer.destroy();
  }
}

export class VertexBuffer extends GPUBufferResource {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      label?: string;
      usage?: GPUBufferUsageFlags; // Allow adding extra flags like COPY_DST
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | (descriptor.usage || 0),
      label: descriptor.label
    });
  }
}

export class IndexBuffer extends GPUBufferResource {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      label?: string;
      usage?: GPUBufferUsageFlags;
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | (descriptor.usage || 0),
      label: descriptor.label
    });
  }
}

export class UniformBuffer extends GPUBufferResource {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      label?: string;
      usage?: GPUBufferUsageFlags;
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | (descriptor.usage || 0),
      label: descriptor.label
    });
  }
}

export class StorageBuffer extends GPUBufferResource {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      label?: string;
      usage?: GPUBufferUsageFlags;
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | (descriptor.usage || 0),
      label: descriptor.label
    });
  }
}

// ============================================================================
// TASK 2: Texture Abstractions
// ============================================================================

import { MIPMAP_SHADER } from './shaders/mipmapShader.js';

// Helper to get byte size of a texture format
function getBlockSize(format: GPUTextureFormat): number {
  // Common formats used in the engine
  switch (format) {
    case 'rgba8unorm':
    case 'rgba8unorm-srgb':
    case 'bgra8unorm':
    case 'bgra8unorm-srgb':
    case 'rgba8sint':
    case 'rgba8uint':
      return 4;
    case 'rg8unorm':
    case 'rg8sint':
    case 'rg8uint':
    case 'r16float':
    case 'r16sint':
    case 'r16uint':
      return 2;
    case 'r8unorm':
    case 'r8sint':
    case 'r8uint':
      return 1;
    case 'rgba16float':
    case 'rgba16sint':
    case 'rgba16uint':
    case 'rgba32float': // Often used for heavy precision
      return 8; // wait, rgba16 is 8 bytes. rgba32 is 16 bytes.

    case 'rgba32float':
    case 'rgba32sint':
    case 'rgba32uint':
      return 16;

    case 'depth24plus':
    case 'depth24plus-stencil8': // approximate
    case 'depth32float':
      return 4;

    default:
      // Fallback for unknown formats or block compressed
      return 4;
  }
}

export interface TextureUploadOptions {
  width?: number;
  height?: number;
  depthOrArrayLayers?: number;
  mipLevel?: number;
  bytesPerRow?: number;
  rowsPerImage?: number;
}

export class Texture2D {
  public readonly texture: GPUTexture;
  public readonly width: number;
  public readonly height: number;
  public readonly format: GPUTextureFormat;

  // Cache pipelines per device and per format
  private static mipmapPipelines = new WeakMap<GPUDevice, Map<GPUTextureFormat, GPURenderPipeline>>();
  private static mipmapSamplers = new WeakMap<GPUDevice, GPUSampler>();

  constructor(
    protected readonly device: GPUDevice,
    descriptor: {
      width: number;
      height: number;
      format: GPUTextureFormat;
      usage?: GPUTextureUsageFlags;
      mipLevelCount?: number;
      label?: string;
    }
  ) {
    this.width = descriptor.width;
    this.height = descriptor.height;
    this.format = descriptor.format;

    // Default usage: TEXTURE_BINDING | COPY_DST | RENDER_ATTACHMENT (needed for mip generation)
    const usage = descriptor.usage ?? (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT);

    this.texture = device.createTexture({
      size: [this.width, this.height, 1],
      format: this.format,
      usage: usage,
      mipLevelCount: descriptor.mipLevelCount ?? 1,
      label: descriptor.label
    });

    globalTracker?.trackTexture(this);
  }

  upload(data: BufferSource, options: TextureUploadOptions = {}): void {
    const width = options.width ?? this.width;
    const height = options.height ?? this.height;
    const depthOrArrayLayers = options.depthOrArrayLayers ?? 1;
    const mipLevel = options.mipLevel ?? 0;

    // Calculate bytesPerRow if not provided
    const blockSize = getBlockSize(this.format);
    let bytesPerRow = options.bytesPerRow;

    if (!bytesPerRow) {
        bytesPerRow = width * blockSize;
    }

    this.device.queue.writeTexture(
      { texture: this.texture, mipLevel, origin: { x: 0, y: 0, z: 0 } },
      data,
      {
        offset: 0,
        bytesPerRow: bytesPerRow,
        rowsPerImage: options.rowsPerImage ?? height
      },
      { width, height, depthOrArrayLayers }
    );
  }

  private getMipmapPipeline(format: GPUTextureFormat): GPURenderPipeline {
    let devicePipelines = Texture2D.mipmapPipelines.get(this.device);
    if (!devicePipelines) {
        devicePipelines = new Map();
        Texture2D.mipmapPipelines.set(this.device, devicePipelines);
    }

    let pipeline = devicePipelines.get(format);
    if (!pipeline) {
       const module = this.device.createShaderModule({
           code: MIPMAP_SHADER,
           label: 'mipmap-shader'
       });

       pipeline = this.device.createRenderPipeline({
           layout: 'auto',
           vertex: {
               module,
               entryPoint: 'vs_main'
           },
           fragment: {
               module,
               entryPoint: 'fs_main',
               targets: [{ format }]
           },
           primitive: {
               topology: 'triangle-list'
           },
           label: `mipmap-pipeline-${format}`
       });
       devicePipelines.set(format, pipeline);
    }
    return pipeline;
  }

  private getMipmapSampler(): GPUSampler {
      let sampler = Texture2D.mipmapSamplers.get(this.device);
      if (!sampler) {
          sampler = this.device.createSampler({
              minFilter: 'linear',
              magFilter: 'linear',
              label: 'mipmap-sampler'
          });
          Texture2D.mipmapSamplers.set(this.device, sampler);
      }
      return sampler;
  }

  generateMipmaps(commandEncoder: GPUCommandEncoder): void {
    const mipCount = this.texture.mipLevelCount;
    if (mipCount <= 1) return;

    const pipeline = this.getMipmapPipeline(this.format);
    const sampler = this.getMipmapSampler();

    // Use loop to generate each mip level from the previous one
    for (let i = 1; i < mipCount; i++) {
        const srcView = this.texture.createView({
            baseMipLevel: i - 1,
            mipLevelCount: 1,
            label: `mipmap-src-${i-1}`
        });

        const dstView = this.texture.createView({
            baseMipLevel: i,
            mipLevelCount: 1,
            label: `mipmap-dst-${i}`
        });

        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: dstView,
                loadOp: 'clear',
                storeOp: 'store'
            }],
            label: `mipmap-pass-${i}`
        });

        const bindGroup = this.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: srcView }
            ],
            label: `mipmap-bindgroup-${i}`
        });

        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(6);
        passEncoder.end();
    }
  }

  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView {
    return this.texture.createView(descriptor);
  }

  destroy(): void {
    globalTracker?.untrackTexture(this);
    this.texture.destroy();
  }

  get memorySize(): number {
    const blockSize = getBlockSize(this.format);
    let size = 0;
    let w = this.width;
    let h = this.height;
    const mipCount = this.texture.mipLevelCount;

    for (let i = 0; i < mipCount; i++) {
      size += w * h * blockSize;
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
    }
    return size;
  }
}

export class TextureCubeMap {
  public readonly texture: GPUTexture;
  public readonly size: number; // width/height (cubemaps are square)
  public readonly format: GPUTextureFormat;

  constructor(
    protected readonly device: GPUDevice,
    descriptor: {
      size: number;
      format: GPUTextureFormat;
      usage?: GPUTextureUsageFlags;
      mipLevelCount?: number;
      label?: string;
    }
  ) {
    this.size = descriptor.size;
    this.format = descriptor.format;

    const usage = descriptor.usage ?? (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST);

    this.texture = device.createTexture({
      size: [this.size, this.size, 6], // 6 layers
      format: this.format,
      usage: usage,
      mipLevelCount: descriptor.mipLevelCount ?? 1,
      label: descriptor.label
    });

    globalTracker?.trackTexture(this);
  }

  uploadFace(face: number, data: BufferSource, mipLevel = 0): void {
    if (face < 0 || face > 5) throw new Error('Invalid cubemap face index');

    const blockSize = getBlockSize(this.format);
    const mipSize = Math.max(1, Math.floor(this.size / Math.pow(2, mipLevel)));
    const bytesPerRow = mipSize * blockSize;

    this.device.queue.writeTexture(
      { texture: this.texture, mipLevel, origin: { x: 0, y: 0, z: face } },
      data,
      {
        offset: 0,
        bytesPerRow: bytesPerRow,
        rowsPerImage: mipSize
      },
      { width: mipSize, height: mipSize, depthOrArrayLayers: 1 }
    );
  }

  createView(): GPUTextureView {
    return this.texture.createView({
      dimension: 'cube'
    });
  }

  destroy(): void {
    globalTracker?.untrackTexture(this);
    this.texture.destroy();
  }

  get memorySize(): number {
    const blockSize = getBlockSize(this.format);
    let size = 0;
    let s = this.size;
    const mipCount = this.texture.mipLevelCount;

    for (let i = 0; i < mipCount; i++) {
      size += s * s * blockSize * 6; // 6 faces
      s = Math.max(1, Math.floor(s / 2));
    }
    return size;
  }
}

// ============================================================================
// TASK 3: Sampler Management
// ============================================================================

export interface SamplerDescriptor {
  minFilter?: GPUFilterMode;
  magFilter?: GPUFilterMode;
  mipmapFilter?: GPUMipmapFilterMode;
  addressModeU?: GPUAddressMode;
  addressModeV?: GPUAddressMode;
  addressModeW?: GPUAddressMode;
  maxAnisotropy?: number;
  compare?: GPUCompareFunction;
  label?: string;
}

export class Sampler {
  public readonly sampler: GPUSampler;

  constructor(device: GPUDevice, descriptor: SamplerDescriptor) {
    this.sampler = device.createSampler({
      ...descriptor,
      label: descriptor.label
    });
  }

  destroy(): void {
    // GC
  }
}

export function createLinearSampler(device: GPUDevice): Sampler {
  return new Sampler(device, {
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
    label: 'linear-sampler'
  });
}

export function createNearestSampler(device: GPUDevice): Sampler {
  return new Sampler(device, {
    minFilter: 'nearest',
    magFilter: 'nearest',
    mipmapFilter: 'nearest',
    label: 'nearest-sampler'
  });
}

export function createClampSampler(device: GPUDevice): Sampler {
  return new Sampler(device, {
    minFilter: 'linear',
    magFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    label: 'clamp-sampler'
  });
}

export function createRepeatSampler(device: GPUDevice): Sampler {
  return new Sampler(device, {
    minFilter: 'linear',
    magFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    label: 'repeat-sampler'
  });
}

// ============================================================================
// TASK 4: Shader Module & Pipeline Abstractions
// ============================================================================

export class ShaderModule {
  public readonly module: GPUShaderModule;

  constructor(
    protected readonly device: GPUDevice,
    descriptor: {
      code: string;  // WGSL source
      label?: string;
    }
  ) {
    this.module = device.createShaderModule({
      code: descriptor.code,
      label: descriptor.label
    });
  }

  get compilationInfo(): Promise<GPUCompilationInfo> {
    return this.module.getCompilationInfo();
  }
}

export interface PipelineDescriptor {
  vertex: {
    module: ShaderModule;
    entryPoint: string;
    buffers: GPUVertexBufferLayout[];
  };
  fragment?: {
    module: ShaderModule;
    entryPoint: string;
    targets: GPUColorTargetState[];
  };
  primitive?: GPUPrimitiveState;
  depthStencil?: GPUDepthStencilState;
  multisample?: GPUMultisampleState;
  layout: GPUPipelineLayout | 'auto';
  label?: string;
}

export class RenderPipeline {
  public readonly pipeline: GPURenderPipeline;

  constructor(
    protected readonly device: GPUDevice,
    descriptor: PipelineDescriptor
  ) {
    const layout = descriptor.layout;

    this.pipeline = device.createRenderPipeline({
      layout,
      vertex: {
        module: descriptor.vertex.module.module,
        entryPoint: descriptor.vertex.entryPoint,
        buffers: descriptor.vertex.buffers
      },
      fragment: descriptor.fragment ? {
        module: descriptor.fragment.module.module,
        entryPoint: descriptor.fragment.entryPoint,
        targets: descriptor.fragment.targets
      } : undefined,
      primitive: descriptor.primitive,
      depthStencil: descriptor.depthStencil,
      multisample: descriptor.multisample,
      label: descriptor.label
    });
  }

  get layout(): GPUPipelineLayout {
    throw new Error("Cannot retrieve layout from pipeline created with 'auto' layout");
  }

  destroy(): void {
    // GC
  }
}

export class ComputePipeline {
  public readonly pipeline: GPUComputePipeline;

  constructor(
    protected readonly device: GPUDevice,
    descriptor: {
      compute: {
        module: ShaderModule;
        entryPoint: string;
      };
      layout: GPUPipelineLayout | 'auto';
      label?: string;
    }
  ) {
    this.pipeline = device.createComputePipeline({
      layout: descriptor.layout,
      compute: {
        module: descriptor.compute.module.module,
        entryPoint: descriptor.compute.entryPoint
      },
      label: descriptor.label
    });
  }

  get layout(): GPUPipelineLayout {
    throw new Error("Cannot retrieve layout from pipeline created with 'auto' layout");
  }

  destroy(): void {
    // GC
  }
}

// ============================================================================
// TASK 5: Bind Group Management
// ============================================================================

export interface BindGroupLayoutDescriptor {
  entries: {
    binding: number;
    visibility: GPUShaderStageFlags;
    buffer?: GPUBufferBindingLayout;
    texture?: GPUTextureBindingLayout;
    sampler?: GPUSamplerBindingLayout;
    storageTexture?: GPUStorageTextureBindingLayout;
  }[];
  label?: string;
}

export class BindGroupLayout {
  public readonly layout: GPUBindGroupLayout;

  constructor(
    protected readonly device: GPUDevice,
    descriptor: BindGroupLayoutDescriptor
  ) {
    this.layout = device.createBindGroupLayout({
      entries: descriptor.entries,
      label: descriptor.label
    });
  }
}

export interface BindGroupEntry {
  binding: number;
  resource: GPUBufferResource | GPUTextureView | Sampler | GPUBindingResource;
}

export class BindGroup {
  public readonly bindGroup: GPUBindGroup;

  constructor(
    protected readonly device: GPUDevice,
    layout: BindGroupLayout,
    entries: BindGroupEntry[],
    label?: string
  ) {
    const gpuEntries: GPUBindGroupEntry[] = entries.map(entry => {
      let resource: GPUBindingResource;

      if (entry.resource instanceof GPUBufferResource) {
        resource = { buffer: entry.resource.buffer };
      } else if (entry.resource instanceof Sampler) {
        resource = entry.resource.sampler;
      } else {
        resource = entry.resource as GPUBindingResource;
      }

      return {
        binding: entry.binding,
        resource: resource
      };
    });

    this.bindGroup = device.createBindGroup({
      layout: layout.layout,
      entries: gpuEntries,
      label: label
    });
  }

  destroy(): void {
    // GC
  }
}

export class BindGroupBuilder {
  private entries: {
    binding: number;
    visibility: GPUShaderStageFlags;
    buffer?: GPUBufferBindingLayout;
    texture?: GPUTextureBindingLayout;
    sampler?: GPUSamplerBindingLayout;
    storageTexture?: GPUStorageTextureBindingLayout;
  }[] = [];

  constructor(private label?: string) {}

  addUniformBuffer(binding: number, visibility: GPUShaderStageFlags): this {
    this.entries.push({
      binding,
      visibility,
      buffer: { type: 'uniform' }
    });
    return this;
  }

  addStorageBuffer(binding: number, visibility: GPUShaderStageFlags, type: GPUBufferBindingType = 'read-only-storage'): this {
    this.entries.push({
      binding,
      visibility,
      buffer: { type }
    });
    return this;
  }

  addTexture(binding: number, visibility: GPUShaderStageFlags, sampleType: GPUTextureSampleType = 'float', viewDimension: GPUTextureViewDimension = '2d'): this {
    this.entries.push({
      binding,
      visibility,
      texture: { sampleType, viewDimension }
    });
    return this;
  }

  addSampler(binding: number, visibility: GPUShaderStageFlags, type: GPUSamplerBindingType = 'filtering'): this {
    this.entries.push({
      binding,
      visibility,
      sampler: { type }
    });
    return this;
  }

  build(device: GPUDevice): BindGroupLayout {
    return new BindGroupLayout(device, {
      entries: this.entries,
      label: this.label
    });
  }
}

// ============================================================================
// TASK 6: Render Pass Helpers
// ============================================================================

export class RenderPassDescriptorBuilder {
  private descriptor: GPURenderPassDescriptor;

  constructor() {
    this.descriptor = {
      colorAttachments: [],
      depthStencilAttachment: undefined
    };
  }

  setColorAttachment(
    index: number,
    view: GPUTextureView,
    options: {
      loadOp?: GPULoadOp;
      storeOp?: GPUStoreOp;
      clearValue?: GPUColor;
    } = {}
  ): this {
    const attachments = this.descriptor.colorAttachments as GPURenderPassColorAttachment[];

    // Ensure array is large enough (sparse if needed, but usually we just push)
    // If index is sparse, we fill with nulls, but WebGPU usually expects packed or explicit attachment slots.
    // For simplicity, we'll assume index is sequential or we just place it.
    // However, the descriptor takes an array. If we want to support sparse, we need to handle it.
    // Let's assume sequential for now or just set at index.

    while (attachments.length <= index) {
      // @ts-ignore - Temporary hole
      attachments.push(null);
    }

    attachments[index] = {
      view: view,
      loadOp: options.loadOp || 'clear',
      storeOp: options.storeOp || 'store',
      clearValue: options.clearValue || { r: 0, g: 0, b: 0, a: 1 }
    };

    return this;
  }

  setDepthStencilAttachment(
    view: GPUTextureView,
    options: {
      depthLoadOp?: GPULoadOp;
      depthStoreOp?: GPUStoreOp;
      depthClearValue?: number;
      stencilLoadOp?: GPULoadOp;
      stencilStoreOp?: GPUStoreOp;
      stencilClearValue?: number;
    } = {}
  ): this {
    this.descriptor.depthStencilAttachment = {
      view: view,
      depthLoadOp: options.depthLoadOp || 'clear',
      depthStoreOp: options.depthStoreOp || 'store',
      depthClearValue: options.depthClearValue ?? 1.0,
      stencilLoadOp: options.stencilLoadOp, // Optional
      stencilStoreOp: options.stencilStoreOp, // Optional
      stencilClearValue: options.stencilClearValue ?? 0
    };

    return this;
  }

  build(): GPURenderPassDescriptor {
    // Filter out potential sparse holes if any (though TS types might complain if we left nulls)
    // WebGPU spec expects valid attachments.
    const attachments = this.descriptor.colorAttachments as (GPURenderPassColorAttachment | null)[];

    // Check if any holes are present which shouldn't happen if used sequentially.
    for (let i = 0; i < attachments.length; i++) {
        if (!attachments[i]) {
             throw new Error(`Color attachment at index ${i} is missing.`);
        }
    }

    return this.descriptor;
  }
}

export function createRenderPassDescriptor(): RenderPassDescriptorBuilder {
  return new RenderPassDescriptorBuilder();
}
