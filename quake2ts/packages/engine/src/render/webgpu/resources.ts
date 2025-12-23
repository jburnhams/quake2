/// <reference types="@webgpu/types" />

// Resource tracking interface (to be implemented fully in Task 7)
export interface ResourceTracker {
  trackBuffer(buffer: GPUBufferResource): void;
  trackTexture(texture: Texture2D | TextureCubeMap): void;
  untrackBuffer(buffer: GPUBufferResource): void;
  untrackTexture(texture: Texture2D | TextureCubeMap): void;
}

// Global tracker instance (singleton)
let globalTracker: ResourceTracker | undefined;

export function setResourceTracker(tracker: ResourceTracker) {
  globalTracker = tracker;
}

export class TextureCache {
  private cache = new Map<string, Texture2D>();
  private device: GPUDevice;

  constructor(device: GPUDevice) {
      this.device = device;
  }

  get(name: string): Texture2D | undefined {
      return this.cache.get(name);
  }

  // Method to add textures (used by asset loaders)
  set(name: string, texture: Texture2D) {
      this.cache.set(name, texture);
  }

  destroy() {
      for (const texture of this.cache.values()) {
          texture.destroy();
      }
      this.cache.clear();
  }
}

// Default resource tracker implementation
export class GPUResourceTracker implements ResourceTracker {
  private _totalBufferMemory = 0;
  private _totalTextureMemory = 0;
  private _bufferCount = 0;
  private _textureCount = 0;

  // Track sets for debugging/validation
  private trackedBuffers = new Set<GPUBufferResource>();
  private trackedTextures = new Set<Texture2D | TextureCubeMap>();

  trackBuffer(buffer: GPUBufferResource): void {
    if (this.trackedBuffers.has(buffer)) return;
    this.trackedBuffers.add(buffer);
    this._bufferCount++;
    this._totalBufferMemory += buffer.size;
  }

  trackTexture(texture: Texture2D | TextureCubeMap): void {
    if (this.trackedTextures.has(texture)) return;
    this.trackedTextures.add(texture);
    this._textureCount++;
    const size = (texture as any).memorySize || 0;
    this._totalTextureMemory += size;
  }

  untrackBuffer(buffer: GPUBufferResource): void {
    if (!this.trackedBuffers.has(buffer)) return;
    this.trackedBuffers.delete(buffer);
    this._bufferCount--;
    this._totalBufferMemory -= buffer.size;
  }

  untrackTexture(texture: Texture2D | TextureCubeMap): void {
    if (!this.trackedTextures.has(texture)) return;
    this.trackedTextures.delete(texture);
    this._textureCount--;
     const size = (texture as any).memorySize || 0;
    this._totalTextureMemory -= size;
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
    this.trackedBuffers.clear();
    this.trackedTextures.clear();
  }
}

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
      usage?: GPUBufferUsageFlags;
      mappedAtCreation?: boolean;
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | (descriptor.usage || 0),
      label: descriptor.label,
      mappedAtCreation: descriptor.mappedAtCreation
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
      mappedAtCreation?: boolean;
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | (descriptor.usage || 0),
      label: descriptor.label,
      mappedAtCreation: descriptor.mappedAtCreation
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
      mappedAtCreation?: boolean;
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | (descriptor.usage || 0),
      label: descriptor.label,
      mappedAtCreation: descriptor.mappedAtCreation
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
      mappedAtCreation?: boolean;
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | (descriptor.usage || 0),
      label: descriptor.label,
      mappedAtCreation: descriptor.mappedAtCreation
    });
  }
}

export interface TextureUploadOptions {
  width?: number;
  height?: number;
  depthOrArrayLayers?: number;
  bytesPerRow?: number;
  rowsPerImage?: number;
  mipLevel?: number;
  origin?: GPUOrigin3D;
}

export class Texture2D {
  public readonly texture: GPUTexture;
  public readonly width: number;
  public readonly height: number;
  public readonly format: GPUTextureFormat;
  public readonly mipLevelCount: number;

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
    this.mipLevelCount = descriptor.mipLevelCount || 1;

    // Default usage: Texture binding, Copy destination/source
    const usage = descriptor.usage ??
      (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT);

    this.texture = device.createTexture({
      size: [this.width, this.height, 1],
      format: this.format,
      usage: usage,
      mipLevelCount: this.mipLevelCount,
      dimension: '2d',
      label: descriptor.label
    });

    globalTracker?.trackTexture(this);
  }

  upload(data: BufferSource, options: TextureUploadOptions = {}): void {
    const mipLevel = options.mipLevel || 0;

    // Simple 2D write
    this.device.queue.writeTexture(
      {
        texture: this.texture,
        mipLevel,
        origin: options.origin
      },
      data,
      {
        offset: 0,
        bytesPerRow: options.bytesPerRow,
        rowsPerImage: options.rowsPerImage
      },
      {
        width: (options.width ?? (this.width >> mipLevel)) || 1,
        height: (options.height ?? (this.height >> mipLevel)) || 1,
        depthOrArrayLayers: 1
      }
    );
  }

  generateMipmaps(commandEncoder: GPUCommandEncoder): void {
    // TODO: Implement mipmap generation.
    // This requires blitting or compute shaders.
  }

  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView {
    return this.texture.createView(descriptor);
  }

  destroy(): void {
    globalTracker?.untrackTexture(this);
    this.texture.destroy();
  }

  get memorySize(): number {
    // Approximate memory size
    const bytesPerPixel = getBytesPerPixel(this.format);
    let size = 0;
    let w = this.width;
    let h = this.height;

    for (let i = 0; i < this.mipLevelCount; i++) {
      size += w * h * bytesPerPixel;
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }

    return size;
  }
}

export class TextureCubeMap {
  public readonly texture: GPUTexture;
  public readonly size: number; // width/height (square)
  public readonly format: GPUTextureFormat;
  public readonly mipLevelCount: number;

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
    this.mipLevelCount = descriptor.mipLevelCount || 1;

    const usage = descriptor.usage ??
      (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT);

    this.texture = device.createTexture({
      size: [this.size, this.size, 6],
      format: this.format,
      usage: usage,
      mipLevelCount: this.mipLevelCount,
      dimension: '2d', // Cubemaps are 2D arrays (6 layers) in WebGPU but viewed as cube
      label: descriptor.label
    });

    globalTracker?.trackTexture(this);
  }

  uploadFace(face: number, data: BufferSource, mipLevel = 0): void {
    if (face < 0 || face > 5) throw new Error('Invalid cubemap face index');

    const width = Math.max(1, this.size >> mipLevel);
    const height = Math.max(1, this.size >> mipLevel);

    this.device.queue.writeTexture(
      {
        texture: this.texture,
        mipLevel,
        origin: [0, 0, face] // z-layer corresponds to face
      },
      data,
      {
        offset: 0,
        bytesPerRow: width * getBytesPerPixel(this.format),
        rowsPerImage: height
      },
      {
        width,
        height,
        depthOrArrayLayers: 1
      }
    );
  }

  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView {
    return this.texture.createView({
      dimension: 'cube',
      ...descriptor
    });
  }

  destroy(): void {
    globalTracker?.untrackTexture(this);
    this.texture.destroy();
  }

  get memorySize(): number {
    const bytesPerPixel = getBytesPerPixel(this.format);
    let size = 0;
    let w = this.size;
    let h = this.size;

    // 6 faces
    for (let i = 0; i < this.mipLevelCount; i++) {
      size += w * h * bytesPerPixel * 6;
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
    return size;
  }
}

// Helper to estimate bytes per pixel (incomplete, covers common formats)
function getBytesPerPixel(format: GPUTextureFormat): number {
  if (format.includes('rgba8') || format.includes('bgra8')) return 4;
  if (format.includes('rg8')) return 2;
  if (format.includes('r8')) return 1;
  if (format.includes('float32')) return 16; // rgba32float
  if (format.includes('float16')) return 8;  // rgba16float
  if (format === 'depth24plus') return 4;    // Approximate
  if (format === 'depth32float') return 4;

  // Default fallback
  return 4;
}

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
      minFilter: descriptor.minFilter || 'nearest',
      magFilter: descriptor.magFilter || 'nearest',
      mipmapFilter: descriptor.mipmapFilter || 'nearest',
      addressModeU: descriptor.addressModeU || 'clamp-to-edge',
      addressModeV: descriptor.addressModeV || 'clamp-to-edge',
      addressModeW: descriptor.addressModeW || 'clamp-to-edge',
      maxAnisotropy: descriptor.maxAnisotropy || 1,
      compare: descriptor.compare,
      label: descriptor.label
    });
  }

  destroy(): void {
    // Samplers don't need explicit destroy in WebGPU JS API usually, but good for tracking if wrapped
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
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    addressModeW: 'clamp-to-edge',
    label: 'clamp-sampler'
  });
}

export function createRepeatSampler(device: GPUDevice): Sampler {
  return new Sampler(device, {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    addressModeW: 'repeat',
    label: 'repeat-sampler'
  });
}

export class ShaderModule {
  public readonly module: GPUShaderModule;

  constructor(
    protected readonly device: GPUDevice,
    descriptor: {
      code: string;
      label?: string;
    }
  ) {
    this.module = device.createShaderModule({
      code: descriptor.code,
      label: descriptor.label
    });
  }

  async getCompilationInfo(): Promise<GPUCompilationInfo> {
    return this.module.getCompilationInfo();
  }
}

export interface PipelineDescriptor {
  vertex: {
    module: ShaderModule;
    entryPoint: string;
    buffers?: GPUVertexBufferLayout[];
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
  public readonly layout: GPUPipelineLayout | 'auto';

  constructor(device: GPUDevice, descriptor: PipelineDescriptor) {
    const pipelineDescriptor: GPURenderPipelineDescriptor = {
      vertex: {
        module: descriptor.vertex.module.module,
        entryPoint: descriptor.vertex.entryPoint,
        buffers: descriptor.vertex.buffers
      },
      primitive: descriptor.primitive,
      depthStencil: descriptor.depthStencil,
      multisample: descriptor.multisample,
      layout: descriptor.layout,
      label: descriptor.label
    };

    if (descriptor.fragment) {
      pipelineDescriptor.fragment = {
        module: descriptor.fragment.module.module,
        entryPoint: descriptor.fragment.entryPoint,
        targets: descriptor.fragment.targets
      };
    }

    this.pipeline = device.createRenderPipeline(pipelineDescriptor);
    this.layout = descriptor.layout;
  }

  destroy(): void {
    // Pipelines don't have destroy in WebGPU
  }
}

export class ComputePipeline {
  public readonly pipeline: GPUComputePipeline;
  public readonly layout: GPUPipelineLayout | 'auto';

  constructor(
    device: GPUDevice,
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
      compute: {
        module: descriptor.compute.module.module,
        entryPoint: descriptor.compute.entryPoint
      },
      layout: descriptor.layout,
      label: descriptor.label
    });
    this.layout = descriptor.layout;
  }

  destroy(): void {
    // Pipelines don't have destroy
  }
}

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

  constructor(device: GPUDevice, descriptor: BindGroupLayoutDescriptor) {
    this.layout = device.createBindGroupLayout({
      entries: descriptor.entries,
      label: descriptor.label
    });
  }
}

export interface BindGroupEntry {
  binding: number;
  resource: GPUBuffer | GPUTextureView | GPUSampler | GPUBindingResource;
}

export class BindGroup {
  public readonly bindGroup: GPUBindGroup;

  constructor(
    device: GPUDevice,
    layout: BindGroupLayout,
    entries: BindGroupEntry[],
    label?: string
  ) {
    this.bindGroup = device.createBindGroup({
      layout: layout.layout,
      entries: entries.map(e => ({
        binding: e.binding,
        resource: e.resource
      })),
      label: label
    });
  }

  destroy(): void {
    // BindGroups don't have explicit destroy
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

  addUniformBuffer(binding: number, visibility: GPUShaderStageFlags): this {
    this.entries.push({
      binding,
      visibility,
      buffer: { type: 'uniform' }
    });
    return this;
  }

  addTexture(binding: number, visibility: GPUShaderStageFlags, viewDimension: GPUTextureViewDimension = '2d'): this {
    this.entries.push({
      binding,
      visibility,
      texture: { viewDimension }
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

  addStorageBuffer(binding: number, visibility: GPUShaderStageFlags, type: GPUBufferBindingType = 'storage'): this {
    this.entries.push({
      binding,
      visibility,
      buffer: { type }
    });
    return this;
  }

  build(device: GPUDevice, label?: string): BindGroupLayout {
    return new BindGroupLayout(device, {
      entries: this.entries,
      label
    });
  }
}

export class RenderPassDescriptorBuilder {
  private colorAttachments: GPURenderPassColorAttachment[] = [];
  private depthStencilAttachment?: GPURenderPassDepthStencilAttachment;

  setColorAttachment(
    index: number,
    view: GPUTextureView,
    options: {
      loadOp?: GPULoadOp;
      storeOp?: GPUStoreOp;
      clearValue?: GPUColor;
    } = {}
  ): this {
    this.colorAttachments[index] = {
      view,
      loadOp: options.loadOp || 'clear',
      storeOp: options.storeOp || 'store',
      clearValue: options.clearValue
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
    this.depthStencilAttachment = {
      view,
      depthLoadOp: options.depthLoadOp || 'clear',
      depthStoreOp: options.depthStoreOp || 'store',
      depthClearValue: options.depthClearValue ?? 1.0,
      stencilLoadOp: options.stencilLoadOp || 'clear',
      stencilStoreOp: options.stencilStoreOp || 'store',
      stencilClearValue: options.stencilClearValue ?? 0
    };
    return this;
  }

  build(): GPURenderPassDescriptor {
    return {
      colorAttachments: this.colorAttachments,
      depthStencilAttachment: this.depthStencilAttachment
    };
  }
}

export function createRenderPassDescriptor(): RenderPassDescriptorBuilder {
  return new RenderPassDescriptorBuilder();
}
