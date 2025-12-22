/// <reference types="@webgpu/types" />

/**
 * Resource tracking for memory profiling.
 */
export class GPUResourceTracker {
  private _totalBufferMemory = 0;
  private _totalTextureMemory = 0;
  private _bufferCount = 0;
  private _textureCount = 0;

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

// Global tracker instance
export const resourceTracker = new GPUResourceTracker();

/**
 * Base wrapper for GPUBuffer to handle lifecycle and tracking.
 */
export class GPUBufferResource {
  protected _buffer: GPUBuffer;
  protected _device: GPUDevice;
  protected _size: number;
  protected _usage: GPUBufferUsageFlags;
  protected _label: string | undefined;

  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      usage: GPUBufferUsageFlags;
      label?: string;
      mappedAtCreation?: boolean;
    }
  ) {
    this._device = device;
    this._size = descriptor.size;
    this._usage = descriptor.usage;
    this._label = descriptor.label;

    this._buffer = device.createBuffer({
      size: this._size,
      usage: this._usage,
      label: this._label,
      mappedAtCreation: descriptor.mappedAtCreation
    });

    resourceTracker.trackBuffer(this);
  }

  /**
   * Writes data to the buffer using device.queue.writeBuffer.
   * Efficient for frequent updates (uniforms, dynamic geometry).
   */
  write(data: BufferSource, offset = 0): void {
    this._device.queue.writeBuffer(
      this._buffer,
      offset,
      data
    );
  }

  /**
   * Maps the buffer for reading.
   * Requires MAP_READ usage.
   */
  async mapAsync(): Promise<ArrayBuffer> {
    if (!(this._usage & GPUBufferUsage.MAP_READ)) {
      throw new Error('Buffer does not have MAP_READ usage');
    }

    await this._buffer.mapAsync(GPUMapMode.READ);
    return this._buffer.getMappedRange();
  }

  /**
   * Unmaps the buffer.
   */
  unmap(): void {
    this._buffer.unmap();
  }

  /**
   * Destroys the buffer and removes it from tracking.
   */
  destroy(): void {
    this._buffer.destroy();
    resourceTracker.untrackBuffer(this);
  }

  get buffer(): GPUBuffer {
    return this._buffer;
  }

  get size(): number {
    return this._size;
  }

  /**
   * If mappedAtCreation was used, get the mapped range immediately.
   */
  getMappedRange(offset?: number, size?: number): ArrayBuffer {
    return this._buffer.getMappedRange(offset, size);
  }
}

/**
 * Vertex buffer wrapper.
 * Usage: VERTEX | COPY_DST
 */
export class VertexBuffer extends GPUBufferResource {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      label?: string;
      mappedAtCreation?: boolean;
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      label: descriptor.label,
      mappedAtCreation: descriptor.mappedAtCreation
    });
  }
}

/**
 * Index buffer wrapper.
 * Usage: INDEX | COPY_DST
 */
export class IndexBuffer extends GPUBufferResource {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      label?: string;
      mappedAtCreation?: boolean;
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      label: descriptor.label,
      mappedAtCreation: descriptor.mappedAtCreation
    });
  }
}

/**
 * Uniform buffer wrapper.
 * Usage: UNIFORM | COPY_DST
 */
export class UniformBuffer extends GPUBufferResource {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      label?: string;
      mappedAtCreation?: boolean;
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: descriptor.label,
      mappedAtCreation: descriptor.mappedAtCreation
    });
  }
}

/**
 * Storage buffer wrapper.
 * Usage: STORAGE | COPY_DST | COPY_SRC (for readback)
 */
export class StorageBuffer extends GPUBufferResource {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      label?: string;
      readBack?: boolean; // If true, adds MAP_READ usage (requires separate buffer in some flows, but simple here)
      mappedAtCreation?: boolean;
    }
  ) {
    // Note: Buffers cannot have both MAP_READ and STORAGE usage in some implementations/specs directly
    // without restrictions, but commonly for readback we might copy to a mappable buffer.
    // However, if we want direct mapping, we use MAP_READ.
    // Standard approach for readback from storage is: Storage -> Copy -> MapReadBuffer.
    // This wrapper assumes standard storage usage. If readback is needed, it might need refinement
    // or a separate staging buffer. For now, we'll keep it simple: STORAGE | COPY_DST | COPY_SRC.

    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      label: descriptor.label,
      mappedAtCreation: descriptor.mappedAtCreation
    });
  }
}

/**
 * 2D Texture wrapper.
 */
export class Texture2D {
  private _texture: GPUTexture;
  private _device: GPUDevice;
  private _width: number;
  private _height: number;
  private _format: GPUTextureFormat;
  private _memorySize: number;

  constructor(
    device: GPUDevice,
    descriptor: {
      width: number;
      height: number;
      format: GPUTextureFormat;
      usage?: GPUTextureUsageFlags;
      mipLevelCount?: number;
      label?: string;
    }
  ) {
    this._device = device;
    this._width = descriptor.width;
    this._height = descriptor.height;
    this._format = descriptor.format;

    // Calculate memory size estimation (approximate)
    // Basic calculation: width * height * bytesPerPixel
    // This assumes 4 bytes per pixel for common formats like rgba8unorm
    // For more accuracy, we'd need a format table lookup
    const bytesPerPixel = this.getBytesPerPixel(this._format);
    this._memorySize = this._width * this._height * bytesPerPixel;
    if (descriptor.mipLevelCount && descriptor.mipLevelCount > 1) {
      // Rough estimate for mips: adds ~33%
      this._memorySize = Math.floor(this._memorySize * 1.33);
    }

    this._texture = device.createTexture({
      size: { width: this._width, height: this._height, depthOrArrayLayers: 1 },
      format: this._format,
      usage: descriptor.usage || (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST),
      mipLevelCount: descriptor.mipLevelCount || 1,
      label: descriptor.label,
      dimension: '2d',
    });

    resourceTracker.trackTexture(this);
  }

  upload(data: BufferSource, options?: {
    origin?: GPUOrigin3DStrict;
    size?: GPUExtent3DStrict;
    layout?: GPUImageDataLayout;
  }): void {
    const origin = options?.origin || { x: 0, y: 0, z: 0 };
    const size = options?.size || { width: this._width, height: this._height, depthOrArrayLayers: 1 };
    const layout = options?.layout || { bytesPerRow: this._width * this.getBytesPerPixel(this._format) };

    this._device.queue.writeTexture(
      { texture: this._texture, origin: origin },
      data,
      layout,
      size
    );
  }

  // Basic implementation - generating mipmaps usually requires a pipeline or blit
  // For now, we'll stub this or implement a simple version later if needed
  generateMipmaps(commandEncoder: GPUCommandEncoder): void {
    // TODO: Implement mipmap generation
    // This requires setting up render passes or compute shaders to downsample
  }

  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView {
    return this._texture.createView(descriptor);
  }

  destroy(): void {
    this._texture.destroy();
    resourceTracker.untrackTexture(this);
  }

  get texture(): GPUTexture {
    return this._texture;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get format(): GPUTextureFormat {
    return this._format;
  }

  get memorySize(): number {
    return this._memorySize;
  }

  private getBytesPerPixel(format: GPUTextureFormat): number {
    if (format.includes('8unorm') || format.includes('8snorm') || format.includes('8uint') || format.includes('8sint')) return 4;
    if (format.includes('16float') || format.includes('16uint') || format.includes('16sint')) return 8;
    if (format.includes('32float') || format.includes('32uint') || format.includes('32sint')) return 16;
    return 4; // Default fallback
  }
}

/**
 * Cube Map Texture wrapper.
 */
export class TextureCubeMap {
  private _texture: GPUTexture;
  private _device: GPUDevice;
  private _size: number;
  private _format: GPUTextureFormat;
  private _memorySize: number;

  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      format: GPUTextureFormat;
      usage?: GPUTextureUsageFlags;
      mipLevelCount?: number;
      label?: string;
    }
  ) {
    this._device = device;
    this._size = descriptor.size;
    this._format = descriptor.format;

    // 6 faces
    const bytesPerPixel = this.getBytesPerPixel(this._format);
    this._memorySize = this._size * this._size * bytesPerPixel * 6;
    if (descriptor.mipLevelCount && descriptor.mipLevelCount > 1) {
        this._memorySize = Math.floor(this._memorySize * 1.33);
    }

    this._texture = device.createTexture({
      size: { width: this._size, height: this._size, depthOrArrayLayers: 6 },
      format: this._format,
      usage: descriptor.usage || (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST),
      mipLevelCount: descriptor.mipLevelCount || 1,
      label: descriptor.label,
      dimension: '2d', // Cubemaps are 2D arrays
    });

    resourceTracker.trackTexture(this);
  }

  uploadFace(face: number, data: BufferSource, mipLevel = 0): void {
    // Face order: +X, -X, +Y, -Y, +Z, -Z
    // In WebGPU, faces are array layers 0-5
    const size = this._size >> mipLevel;
    this._device.queue.writeTexture(
      { texture: this._texture, origin: { x: 0, y: 0, z: face }, mipLevel },
      data,
      { bytesPerRow: size * this.getBytesPerPixel(this._format) },
      { width: size, height: size }
    );
  }

  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView {
    return this._texture.createView({
      dimension: 'cube',
      ...descriptor
    });
  }

  destroy(): void {
    this._texture.destroy();
    resourceTracker.untrackTexture(this);
  }

  get texture(): GPUTexture {
    return this._texture;
  }

  get size(): number {
    return this._size;
  }

  get memorySize(): number {
    return this._memorySize;
  }

  private getBytesPerPixel(format: GPUTextureFormat): number {
    // Reuse logic or helper
    if (format.includes('8unorm') || format.includes('8snorm') || format.includes('8uint') || format.includes('8sint')) return 4;
    if (format.includes('16float') || format.includes('16uint') || format.includes('16sint')) return 8;
    if (format.includes('32float') || format.includes('32uint') || format.includes('32sint')) return 16;
    return 4; // Default fallback
  }
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
  private _sampler: GPUSampler;

  constructor(device: GPUDevice, descriptor: SamplerDescriptor) {
    this._sampler = device.createSampler({
      ...descriptor
    });
  }

  get sampler(): GPUSampler {
    return this._sampler;
  }

  // Samplers are lightweight and usually don't need manual destruction unless managing limit strictly
}

export function createLinearSampler(device: GPUDevice): Sampler {
  return new Sampler(device, {
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
    label: 'Linear Sampler'
  });
}

export function createNearestSampler(device: GPUDevice): Sampler {
  return new Sampler(device, {
    minFilter: 'nearest',
    magFilter: 'nearest',
    mipmapFilter: 'nearest',
    label: 'Nearest Sampler'
  });
}

export function createClampSampler(device: GPUDevice): Sampler {
  return new Sampler(device, {
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    minFilter: 'linear',
    magFilter: 'linear',
    label: 'Clamp Sampler'
  });
}

export function createRepeatSampler(device: GPUDevice): Sampler {
  return new Sampler(device, {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    minFilter: 'linear',
    magFilter: 'linear',
    label: 'Repeat Sampler'
  });
}

export class ShaderModule {
  private _module: GPUShaderModule;

  constructor(
    device: GPUDevice,
    descriptor: {
      code: string;  // WGSL source
      label?: string;
    }
  ) {
    this._module = device.createShaderModule(descriptor);
  }

  get module(): GPUShaderModule {
    return this._module;
  }

  get compilationInfo(): Promise<GPUCompilationInfo> {
    return this._module.getCompilationInfo();
  }
}

export interface RenderPipelineDescriptor {
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
  private _pipeline: GPURenderPipeline;
  private _layout: GPUPipelineLayout;

  constructor(device: GPUDevice, descriptor: RenderPipelineDescriptor) {
    const layout = descriptor.layout;

    this._pipeline = device.createRenderPipeline({
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
      layout: layout,
      label: descriptor.label
    });

    // Use passed layout. If 'auto', individual bind group layouts can be retrieved via getBindGroupLayout
    this._layout = layout as GPUPipelineLayout;
  }

  get pipeline(): GPURenderPipeline {
    return this._pipeline;
  }
}

export class ComputePipeline {
  private _pipeline: GPUComputePipeline;

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
    this._pipeline = device.createComputePipeline({
      compute: {
        module: descriptor.compute.module.module,
        entryPoint: descriptor.compute.entryPoint
      },
      layout: descriptor.layout,
      label: descriptor.label
    });
  }

  get pipeline(): GPUComputePipeline {
    return this._pipeline;
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
  private _layout: GPUBindGroupLayout;

  constructor(device: GPUDevice, descriptor: BindGroupLayoutDescriptor) {
    this._layout = device.createBindGroupLayout(descriptor);
  }

  get layout(): GPUBindGroupLayout {
    return this._layout;
  }
}

export interface BindGroupEntry {
  binding: number;
  resource: GPUBufferBinding | GPUTextureView | GPUSampler;
}

export class BindGroup {
  private _bindGroup: GPUBindGroup;

  constructor(
    device: GPUDevice,
    layout: BindGroupLayout,
    entries: BindGroupEntry[],
    label?: string
  ) {
    this._bindGroup = device.createBindGroup({
      layout: layout.layout,
      entries: entries,
      label: label
    });
  }

  get bindGroup(): GPUBindGroup {
    return this._bindGroup;
  }
}

export class BindGroupBuilder {
  private _entries: BindGroupLayoutDescriptor['entries'] = [];

  addUniformBuffer(binding: number, visibility: GPUShaderStageFlags): this {
    this._entries.push({
      binding,
      visibility,
      buffer: { type: 'uniform' }
    });
    return this;
  }

  addTexture(binding: number, visibility: GPUShaderStageFlags, viewDimension: GPUTextureViewDimension = '2d'): this {
    this._entries.push({
      binding,
      visibility,
      texture: { viewDimension }
    });
    return this;
  }

  addSampler(binding: number, visibility: GPUShaderStageFlags, type: GPUSamplerBindingType = 'filtering'): this {
    this._entries.push({
      binding,
      visibility,
      sampler: { type }
    });
    return this;
  }

  addStorageBuffer(binding: number, visibility: GPUShaderStageFlags, type: GPUBufferBindingType = 'read-only-storage'): this {
    this._entries.push({
      binding,
      visibility,
      buffer: { type }
    });
    return this;
  }

  build(device: GPUDevice, label?: string): BindGroupLayout {
    return new BindGroupLayout(device, {
      entries: this._entries,
      label
    });
  }
}

export interface RenderPassAttachmentOptions {
  loadOp?: GPULoadOp;
  storeOp?: GPUStoreOp;
  clearValue?: GPUColor;
}

export interface DepthStencilAttachmentOptions {
  depthLoadOp?: GPULoadOp;
  depthStoreOp?: GPUStoreOp;
  depthClearValue?: number;
  stencilLoadOp?: GPULoadOp;
  stencilStoreOp?: GPUStoreOp;
  stencilClearValue?: number;
}

export class RenderPassDescriptorBuilder {
  private _colorAttachments: GPURenderPassColorAttachment[] = [];
  private _depthStencilAttachment: GPURenderPassDepthStencilAttachment | undefined;

  setColorAttachment(
    view: GPUTextureView,
    options: RenderPassAttachmentOptions = {}
  ): this {
    this._colorAttachments.push({
      view,
      loadOp: options.loadOp || 'clear',
      storeOp: options.storeOp || 'store',
      clearValue: options.clearValue || { r: 0, g: 0, b: 0, a: 1 }
    });
    return this;
  }

  setDepthStencilAttachment(
    view: GPUTextureView,
    options: DepthStencilAttachmentOptions = {}
  ): this {
    this._depthStencilAttachment = {
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
      colorAttachments: this._colorAttachments,
      depthStencilAttachment: this._depthStencilAttachment
    };
  }
}

export function createRenderPassDescriptor(): RenderPassDescriptorBuilder {
  return new RenderPassDescriptorBuilder();
}
