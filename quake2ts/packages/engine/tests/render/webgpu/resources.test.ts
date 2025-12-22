import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GPUBufferResource,
  VertexBuffer,
  IndexBuffer,
  UniformBuffer,
  StorageBuffer,
  Texture2D,
  TextureCubeMap,
  resourceTracker,
  createLinearSampler,
  createNearestSampler,
  Sampler,
  ShaderModule,
  RenderPipeline,
  BindGroupBuilder,
  BindGroup,
  BindGroupLayout,
  createRenderPassDescriptor
} from '../../../src/render/webgpu/resources';

// Mocks
const mockDestroy = vi.fn();
const mockWriteBuffer = vi.fn();
const mockWriteTexture = vi.fn();
const mockMapAsync = vi.fn();
const mockUnmap = vi.fn();
const mockGetMappedRange = vi.fn();
const mockCreateView = vi.fn();
const mockGetCompilationInfo = vi.fn().mockResolvedValue({ messages: [] });
const mockGetBindGroupLayout = vi.fn().mockReturnValue({});

const mockCreateBuffer = vi.fn((desc) => ({
  destroy: mockDestroy,
  mapAsync: mockMapAsync,
  unmap: mockUnmap,
  getMappedRange: mockGetMappedRange,
  ...desc
}));

const mockCreateTexture = vi.fn((desc) => ({
  destroy: mockDestroy,
  createView: mockCreateView,
  ...desc
}));

const mockCreateSampler = vi.fn();
const mockCreateShaderModule = vi.fn((desc) => ({
  getCompilationInfo: mockGetCompilationInfo,
  ...desc
}));
const mockCreateRenderPipeline = vi.fn((desc) => ({
  getBindGroupLayout: mockGetBindGroupLayout
}));
const mockCreateBindGroupLayout = vi.fn();
const mockCreateBindGroup = vi.fn();

const mockDevice = {
  createBuffer: mockCreateBuffer,
  createTexture: mockCreateTexture,
  createSampler: mockCreateSampler,
  createShaderModule: mockCreateShaderModule,
  createRenderPipeline: mockCreateRenderPipeline,
  createBindGroupLayout: mockCreateBindGroupLayout,
  createBindGroup: mockCreateBindGroup,
  queue: {
    writeBuffer: mockWriteBuffer,
    writeTexture: mockWriteTexture
  }
} as unknown as GPUDevice;

// Mock globals
global.GPUBufferUsage = {
  MAP_READ: 1,
  MAP_WRITE: 2,
  COPY_SRC: 4,
  COPY_DST: 8,
  INDEX: 16,
  VERTEX: 32,
  UNIFORM: 64,
  STORAGE: 128,
  INDIRECT: 256,
  QUERY_RESOLVE: 512,
} as any;

global.GPUTextureUsage = {
  COPY_SRC: 0x01,
  COPY_DST: 0x02,
  TEXTURE_BINDING: 0x04,
  STORAGE_BINDING: 0x08,
  RENDER_ATTACHMENT: 0x10,
} as any;

global.GPUMapMode = {
  READ: 1,
  WRITE: 2
} as any;

describe('WebGPU Resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resourceTracker.reset();
  });

  describe('GPUBufferResource', () => {
    // ... previous buffer tests ...
    it('creates a buffer with correct descriptor', () => {
      const size = 1024;
      const usage = GPUBufferUsage.VERTEX;
      const label = 'test-buffer';

      const buffer = new GPUBufferResource(mockDevice, { size, usage, label });

      expect(mockCreateBuffer).toHaveBeenCalledWith({ size, usage, label, mappedAtCreation: undefined });
      expect(buffer.size).toBe(size);
      expect(resourceTracker.bufferCount).toBe(1);
      expect(resourceTracker.totalBufferMemory).toBe(size);
    });

    it('creates a mappedAtCreation buffer', () => {
      const buffer = new GPUBufferResource(mockDevice, {
        size: 1024,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
      });

      expect(mockCreateBuffer).toHaveBeenCalledWith(expect.objectContaining({ mappedAtCreation: true }));
      buffer.getMappedRange();
      expect(mockGetMappedRange).toHaveBeenCalled();
    });

    it('writes data to buffer', () => {
      const buffer = new GPUBufferResource(mockDevice, {
        size: 16,
        usage: GPUBufferUsage.UNIFORM
      });
      const data = new Float32Array([1, 2, 3, 4]);

      buffer.write(data);

      expect(mockWriteBuffer).toHaveBeenCalledWith(
        expect.anything(),
        0,
        data
      );
    });

    it('destroys buffer and updates tracker', () => {
      const buffer = new GPUBufferResource(mockDevice, {
        size: 1024,
        usage: GPUBufferUsage.VERTEX
      });

      expect(resourceTracker.bufferCount).toBe(1);

      buffer.destroy();

      expect(mockDestroy).toHaveBeenCalled();
      expect(resourceTracker.bufferCount).toBe(0);
      expect(resourceTracker.totalBufferMemory).toBe(0);
    });
  });

  describe('Texture Abstractions', () => {
    it('Texture2D creates GPUTexture with correct usage', () => {
      const tex = new Texture2D(mockDevice, {
        width: 256,
        height: 256,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING
      });

      expect(mockCreateTexture).toHaveBeenCalledWith(expect.objectContaining({
        size: { width: 256, height: 256, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING,
        dimension: '2d'
      }));
      expect(resourceTracker.textureCount).toBe(1);
      // 256 * 256 * 4 bytes = 262144
      expect(resourceTracker.totalTextureMemory).toBe(262144);
    });

    it('Texture2D uploads data with defaults', () => {
      const tex = new Texture2D(mockDevice, {
        width: 16,
        height: 16,
        format: 'rgba8unorm'
      });
      const data = new Uint8Array(16 * 16 * 4);
      tex.upload(data);

      expect(mockWriteTexture).toHaveBeenCalledWith(
        expect.objectContaining({ texture: expect.anything(), origin: { x: 0, y: 0, z: 0 } }),
        data,
        expect.objectContaining({ bytesPerRow: 16 * 4 }),
        { width: 16, height: 16, depthOrArrayLayers: 1 }
      );
    });

    it('Texture2D uploads data with custom options', () => {
      const tex = new Texture2D(mockDevice, {
        width: 16,
        height: 16,
        format: 'rgba8unorm'
      });
      const data = new Uint8Array(8 * 8 * 4);
      tex.upload(data, {
        origin: { x: 4, y: 4, z: 0 },
        size: { width: 8, height: 8, depthOrArrayLayers: 1 },
        layout: { bytesPerRow: 8 * 4 }
      });

      expect(mockWriteTexture).toHaveBeenCalledWith(
        expect.objectContaining({ texture: expect.anything(), origin: { x: 4, y: 4, z: 0 } }),
        data,
        expect.objectContaining({ bytesPerRow: 8 * 4 }),
        { width: 8, height: 8, depthOrArrayLayers: 1 }
      );
    });

    it('TextureCubeMap creates array texture', () => {
      const tex = new TextureCubeMap(mockDevice, {
        size: 128,
        format: 'rgba8unorm'
      });

      expect(mockCreateTexture).toHaveBeenCalledWith(expect.objectContaining({
        size: { width: 128, height: 128, depthOrArrayLayers: 6 },
        dimension: '2d'
      }));
      // 128 * 128 * 4 * 6 = 393216
      expect(resourceTracker.totalTextureMemory).toBe(393216);
    });

    it('TextureCubeMap uploads specific face', () => {
      const tex = new TextureCubeMap(mockDevice, {
        size: 64,
        format: 'rgba8unorm'
      });
      const data = new Uint8Array(64 * 64 * 4);
      tex.uploadFace(2, data); // +Y

      expect(mockWriteTexture).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: { x: 0, y: 0, z: 2 }
        }),
        data,
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('Samplers & Shaders', () => {
    it('creates samplers using factory functions', () => {
      createLinearSampler(mockDevice);
      expect(mockCreateSampler).toHaveBeenCalledWith(expect.objectContaining({
        minFilter: 'linear',
        magFilter: 'linear'
      }));

      createNearestSampler(mockDevice);
      expect(mockCreateSampler).toHaveBeenCalledWith(expect.objectContaining({
        minFilter: 'nearest',
        magFilter: 'nearest'
      }));
    });

    it('creates shader module', async () => {
      const shader = new ShaderModule(mockDevice, { code: 'test code' });
      expect(mockCreateShaderModule).toHaveBeenCalledWith(expect.objectContaining({
        code: 'test code'
      }));

      const info = await shader.compilationInfo;
      expect(info.messages).toEqual([]);
    });
  });

  describe('Pipelines & BindGroups', () => {
    it('creates render pipeline', () => {
      const vertexModule = new ShaderModule(mockDevice, { code: 'vert' });
      const fragmentModule = new ShaderModule(mockDevice, { code: 'frag' });

      new RenderPipeline(mockDevice, {
        vertex: { module: vertexModule, entryPoint: 'main', buffers: [] },
        fragment: { module: fragmentModule, entryPoint: 'main', targets: [] },
        layout: 'auto'
      });

      expect(mockCreateRenderPipeline).toHaveBeenCalled();
    });

    it('builds bind group layout', () => {
      const builder = new BindGroupBuilder();
      builder.addUniformBuffer(0, 1)
             .addTexture(1, 1)
             .addSampler(2, 1);

      const layout = builder.build(mockDevice);
      expect(mockCreateBindGroupLayout).toHaveBeenCalled();
    });

    it('creates bind group', () => {
      const layout = new BindGroupLayout(mockDevice, { entries: [] });
      new BindGroup(mockDevice, layout, []);
      expect(mockCreateBindGroup).toHaveBeenCalled();
    });
  });

  describe('RenderPass', () => {
    it('builds render pass descriptor', () => {
      const mockView = {} as GPUTextureView;
      const builder = createRenderPassDescriptor();
      builder.setColorAttachment(mockView, { clearValue: { r: 1, g: 0, b: 0, a: 1 } });

      const descriptor = builder.build();
      expect(descriptor.colorAttachments).toHaveLength(1);
      expect(descriptor.colorAttachments[0].view).toBe(mockView);
      expect(descriptor.colorAttachments[0].clearValue).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });
  });
});
