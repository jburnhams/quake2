/// <reference types="@webgpu/types" />
import { GPUBufferUsage, GPUMapMode, GPUTextureUsage } from './constants';

/**
 * Tracks GPU memory usage for buffers and textures.
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
    if (texture instanceof Texture2D) {
       this._totalTextureMemory += texture.memorySize;
    } else if (texture instanceof TextureCubeMap) {
       this._totalTextureMemory += texture.size;
    }
    this._textureCount++;
  }

  untrackBuffer(buffer: GPUBufferResource): void {
    this._totalBufferMemory -= buffer.size;
    this._bufferCount--;
  }

  untrackTexture(texture: Texture2D | TextureCubeMap): void {
    if (texture instanceof Texture2D) {
       this._totalTextureMemory -= texture.memorySize;
    } else if (texture instanceof TextureCubeMap) {
       this._totalTextureMemory -= texture.size;
    }
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
 * Base class for all GPU buffer resources.
 */
export class GPUBufferResource {
  private _buffer: GPUBuffer;
  private _size: number;
  private _usage: GPUBufferUsageFlags;
  private _device: GPUDevice;
  private _label: string | undefined;

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
   * Writes data to the buffer.
   */
  write(data: BufferSource, offset = 0): void {
    this._device.queue.writeBuffer(
      this._buffer,
      offset,
      data
    );
  }

  /**
   * Maps the buffer for reading (async).
   * Note: Buffer must have MAP_READ usage.
   */
  async mapAsync(mode: GPUMapModeFlags = GPUMapMode.READ, offset = 0, size?: number): Promise<ArrayBuffer> {
    await this._buffer.mapAsync(mode, offset, size);
    return this._buffer.getMappedRange(offset, size);
  }

  /**
   * Unmaps the buffer.
   */
  unmap(): void {
    this._buffer.unmap();
  }

  /**
   * Destroys the buffer and releases resources.
   */
  destroy(): void {
    resourceTracker.untrackBuffer(this);
    this._buffer.destroy();
  }

  get buffer(): GPUBuffer {
    return this._buffer;
  }

  get size(): number {
    return this._size;
  }

  get usage(): GPUBufferUsageFlags {
    return this._usage;
  }
}

/**
 * Vertex buffer wrapper.
 */
export class VertexBuffer extends GPUBufferResource {
  constructor(
    device: GPUDevice,
    descriptor: {
      size: number;
      label?: string;
      usage?: GPUBufferUsageFlags; // Allow extra flags
    }
  ) {
    super(device, {
      size: descriptor.size,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | (descriptor.usage || 0),
      label: descriptor.label
    });
  }
}

/**
 * Index buffer wrapper.
 */
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

/**
 * Uniform buffer wrapper.
 */
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

/**
 * Storage buffer wrapper.
 */
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

export interface TextureUploadOptions {
  x?: number;
  y?: number;
  z?: number;
  width?: number;
  height?: number;
  depth?: number;
  mipLevel?: number;
}

/**
 * Helper to get bytes per pixel for memory tracking.
 */
function getFormatBlockSize(format: GPUTextureFormat): number {
  if (format.endsWith('8unorm') || format.endsWith('8snorm') || format.endsWith('8uint') || format.endsWith('8sint')) {
    return 4; // Assuming RGBA8 usually
  }
  if (format === 'bgra8unorm') return 4;
  if (format === 'rgba16float') return 8;
  if (format === 'depth24plus') return 4;
  if (format === 'depth32float') return 4;
  if (format === 'r8unorm') return 1;
  // Fallback estimation
  return 4;
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
  private _mipLevelCount: number;

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
    this._mipLevelCount = descriptor.mipLevelCount || 1;

    this._texture = device.createTexture({
      size: { width: this._width, height: this._height, depthOrArrayLayers: 1 },
      format: this._format,
      usage: descriptor.usage || (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST),
      mipLevelCount: this._mipLevelCount,
      label: descriptor.label
    });

    resourceTracker.trackTexture(this);
  }

  upload(data: BufferSource, options: TextureUploadOptions = {}): void {
    const mipLevel = options.mipLevel || 0;
    const x = options.x || 0;
    const y = options.y || 0;
    const z = options.z || 0;
    // For mipLevel > 0, size is smaller. This assumes full upload if width not specified.
    const width = options.width || Math.max(1, this._width >> mipLevel);
    const height = options.height || Math.max(1, this._height >> mipLevel);
    const depth = options.depth || 1;

    const bytesPerPixel = getFormatBlockSize(this._format);
    const bytesPerRow = width * bytesPerPixel;

    // Note: queue.writeTexture does NOT require 256-byte alignment for bytesPerRow,
    // unlike CopyBufferToTexture. It handles tight packing.
    this._device.queue.writeTexture(
      { texture: this._texture, mipLevel, origin: { x, y, z } },
      data,
      { bytesPerRow },
      { width, height, depthOrArrayLayers: depth }
    );
  }

  generateMipmaps(commandEncoder: GPUCommandEncoder): void {
      // Placeholder: Requires render/compute pipeline
      console.warn('generateMipmaps not implemented yet (requires pipeline abstractions)');
  }

  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView {
    return this._texture.createView(descriptor);
  }

  destroy(): void {
    resourceTracker.untrackTexture(this);
    this._texture.destroy();
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
    // Approximate: width * height * bytes * 1.33 for mips
    const base = this._width * this._height * getFormatBlockSize(this._format);
    return this._mipLevelCount > 1 ? Math.floor(base * 1.33) : base;
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
  private _mipLevelCount: number;

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
    this._size = descriptor.size; // Width/Height
    this._format = descriptor.format;
    this._mipLevelCount = descriptor.mipLevelCount || 1;

    this._texture = device.createTexture({
      size: { width: this._size, height: this._size, depthOrArrayLayers: 6 },
      format: this._format,
      usage: descriptor.usage || (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT),
      mipLevelCount: this._mipLevelCount,
      label: descriptor.label,
      dimension: '2d', // Yes, cubemaps are 2d array layers
    });

    resourceTracker.trackTexture(this);
  }

  uploadFace(face: number, data: BufferSource, mipLevel = 0): void {
    if (face < 0 || face > 5) throw new Error('Invalid cubemap face index');

    const width = Math.max(1, this._size >> mipLevel);
    const height = width;
    const bytesPerPixel = getFormatBlockSize(this._format);
    const bytesPerRow = width * bytesPerPixel;

    this._device.queue.writeTexture(
      { texture: this._texture, mipLevel, origin: { x: 0, y: 0, z: face } }, // z is layer index
      data,
      { bytesPerRow },
      { width, height, depthOrArrayLayers: 1 }
    );
  }

  createView(): GPUTextureView {
    return this._texture.createView({
      dimension: 'cube',
      arrayLayerCount: 6
    });
  }

  destroy(): void {
    resourceTracker.untrackTexture(this);
    this._texture.destroy();
  }

  get texture(): GPUTexture {
    return this._texture;
  }

  get size(): number {
    // Total memory bytes
    const faceBase = this._size * this._size * getFormatBlockSize(this._format);
    const totalBase = faceBase * 6;
    return this._mipLevelCount > 1 ? Math.floor(totalBase * 1.33) : totalBase;
  }
}
