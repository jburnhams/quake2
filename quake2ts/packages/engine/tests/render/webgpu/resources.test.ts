import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GPUBufferResource,
  VertexBuffer,
  IndexBuffer,
  UniformBuffer,
  StorageBuffer,
  resourceTracker,
  Texture2D,
  TextureCubeMap,
  Sampler,
  createLinearSampler,
  createNearestSampler,
  createClampSampler,
  createRepeatSampler,
  ShaderModule,
  RenderPipeline,
  ComputePipeline,
  PipelineDescriptor
} from '../../../src/render/webgpu/resources.js';
import { GPUBufferUsage, GPUMapMode, GPUTextureUsage } from '../../../src/render/webgpu/constants.js';

// Mock WebGPU globals
const mockTexture = {
  createView: vi.fn(),
  destroy: vi.fn(),
} as unknown as GPUTexture;

const mockSampler = {} as unknown as GPUSampler;

const mockShaderModule = {
  getCompilationInfo: vi.fn().mockResolvedValue({ messages: [] })
} as unknown as GPUShaderModule;

const mockRenderPipeline = {} as unknown as GPURenderPipeline;
const mockComputePipeline = {} as unknown as GPUComputePipeline;

const mockDevice = {
  createBuffer: vi.fn(),
  createTexture: vi.fn(),
  createSampler: vi.fn(),
  createShaderModule: vi.fn(),
  createRenderPipeline: vi.fn(),
  createComputePipeline: vi.fn(),
  queue: {
    writeBuffer: vi.fn(),
    writeTexture: vi.fn(),
  },
} as unknown as GPUDevice;

const mockBuffer = {
  destroy: vi.fn(),
  mapAsync: vi.fn().mockResolvedValue(undefined),
  getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(10)),
  unmap: vi.fn(),
} as unknown as GPUBuffer;

describe('WebGPU Resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockDevice.createBuffer as any).mockReturnValue(mockBuffer);
    (mockDevice.createTexture as any).mockReturnValue(mockTexture);
    (mockDevice.createSampler as any).mockReturnValue(mockSampler);
    (mockDevice.createShaderModule as any).mockReturnValue(mockShaderModule);
    (mockDevice.createRenderPipeline as any).mockReturnValue(mockRenderPipeline);
    (mockDevice.createComputePipeline as any).mockReturnValue(mockComputePipeline);
    (mockTexture.createView as any).mockReturnValue({});
    resourceTracker.reset();
  });

  describe('GPUBufferResource', () => {
    it('creates a buffer with correct parameters', () => {
      const size = 1024;
      const usage = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
      const label = 'test-buffer';

      const buffer = new GPUBufferResource(mockDevice, { size, usage, label });

      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size,
        usage,
        label,
        mappedAtCreation: undefined
      });
      expect(buffer.size).toBe(size);
      expect(buffer.usage).toBe(usage);
    });

    it('writes data to buffer', () => {
      const buffer = new GPUBufferResource(mockDevice, {
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const data = new Float32Array([1, 2, 3, 4]);

      buffer.write(data);

      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledWith(
        mockBuffer,
        0,
        data
      );
    });

    it('handles mapAsync and unmap', async () => {
      const buffer = new GPUBufferResource(mockDevice, {
        size: 1024,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });

      await buffer.mapAsync();
      expect(mockBuffer.mapAsync).toHaveBeenCalled();
      expect(mockBuffer.getMappedRange).toHaveBeenCalled();

      buffer.unmap();
      expect(mockBuffer.unmap).toHaveBeenCalled();
    });

    it('destroys buffer and untracks memory', () => {
      const buffer = new GPUBufferResource(mockDevice, {
        size: 1024,
        usage: GPUBufferUsage.VERTEX
      });

      expect(resourceTracker.totalBufferMemory).toBe(1024);
      expect(resourceTracker.bufferCount).toBe(1);

      buffer.destroy();

      expect(mockBuffer.destroy).toHaveBeenCalled();
      expect(resourceTracker.totalBufferMemory).toBe(0);
      expect(resourceTracker.bufferCount).toBe(0);
    });
  });

  describe('Specific Buffer Types', () => {
    it('VertexBuffer includes VERTEX usage', () => {
      new VertexBuffer(mockDevice, { size: 100 });
      expect(mockDevice.createBuffer).toHaveBeenCalledWith(expect.objectContaining({
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      }));
    });

    it('IndexBuffer includes INDEX usage', () => {
      new IndexBuffer(mockDevice, { size: 100 });
      expect(mockDevice.createBuffer).toHaveBeenCalledWith(expect.objectContaining({
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      }));
    });

    it('UniformBuffer includes UNIFORM usage', () => {
      new UniformBuffer(mockDevice, { size: 100 });
      expect(mockDevice.createBuffer).toHaveBeenCalledWith(expect.objectContaining({
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      }));
    });

    it('StorageBuffer includes STORAGE usage', () => {
      new StorageBuffer(mockDevice, { size: 100 });
      expect(mockDevice.createBuffer).toHaveBeenCalledWith(expect.objectContaining({
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }));
    });
  });

  describe('Texture2D', () => {
    it('creates a texture with correct parameters', () => {
      const tex = new Texture2D(mockDevice, {
        width: 64,
        height: 64,
        format: 'rgba8unorm'
      });

      expect(mockDevice.createTexture).toHaveBeenCalledWith(expect.objectContaining({
        size: { width: 64, height: 64, depthOrArrayLayers: 1 },
        format: 'rgba8unorm'
      }));
      expect(resourceTracker.textureCount).toBe(1);
    });

    it('uploads data correctly', () => {
      const tex = new Texture2D(mockDevice, {
        width: 4,
        height: 4,
        format: 'rgba8unorm'
      });
      const data = new Uint8Array(4 * 4 * 4);
      tex.upload(data);

      expect(mockDevice.queue.writeTexture).toHaveBeenCalledWith(
        expect.objectContaining({ texture: mockTexture }),
        data,
        expect.objectContaining({ bytesPerRow: 4 * 4 }), // 4 width * 4 bytes
        expect.objectContaining({ width: 4, height: 4 })
      );
    });

    it('tracks memory size approx', () => {
        const tex = new Texture2D(mockDevice, {
            width: 100,
            height: 100,
            format: 'rgba8unorm',
            mipLevelCount: 1
        });
        // 100*100*4 = 40000 bytes
        expect(tex.memorySize).toBe(40000);
    });
  });

  describe('TextureCubeMap', () => {
    it('creates a cube texture with 6 layers', () => {
      const tex = new TextureCubeMap(mockDevice, {
        size: 64,
        format: 'rgba8unorm'
      });

      expect(mockDevice.createTexture).toHaveBeenCalledWith(expect.objectContaining({
        size: { width: 64, height: 64, depthOrArrayLayers: 6 },
        format: 'rgba8unorm',
        dimension: '2d'
      }));
    });

    it('uploads face correctly', () => {
      const tex = new TextureCubeMap(mockDevice, {
        size: 4,
        format: 'rgba8unorm'
      });
      const data = new Uint8Array(4 * 4 * 4);
      tex.uploadFace(2, data); // Face +z

      expect(mockDevice.queue.writeTexture).toHaveBeenCalledWith(
        expect.objectContaining({ texture: mockTexture, origin: { x: 0, y: 0, z: 2 } }),
        data,
        expect.any(Object),
        expect.any(Object)
      );
    });

     it('tracks memory size for all faces', () => {
        const tex = new TextureCubeMap(mockDevice, {
            size: 10,
            format: 'rgba8unorm',
            mipLevelCount: 1
        });
        // 10*10*4 * 6 = 2400 bytes
        expect(tex.size).toBe(2400);
    });
  });

  describe('Sampler', () => {
    it('creates a sampler', () => {
      const sampler = new Sampler(mockDevice, {
        minFilter: 'linear',
        magFilter: 'linear'
      });
      expect(mockDevice.createSampler).toHaveBeenCalledWith(expect.objectContaining({
        minFilter: 'linear',
        magFilter: 'linear'
      }));
      expect(sampler.sampler).toBe(mockSampler);
    });

    it('createLinearSampler uses correct defaults', () => {
      createLinearSampler(mockDevice);
      expect(mockDevice.createSampler).toHaveBeenCalledWith(expect.objectContaining({
        minFilter: 'linear',
        magFilter: 'linear',
        mipmapFilter: 'linear'
      }));
    });

    it('createNearestSampler uses correct defaults', () => {
      createNearestSampler(mockDevice);
      expect(mockDevice.createSampler).toHaveBeenCalledWith(expect.objectContaining({
        minFilter: 'nearest',
        magFilter: 'nearest',
        mipmapFilter: 'nearest'
      }));
    });

    it('createClampSampler uses clamp address mode', () => {
      createClampSampler(mockDevice);
      expect(mockDevice.createSampler).toHaveBeenCalledWith(expect.objectContaining({
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge'
      }));
    });

    it('createRepeatSampler uses repeat address mode', () => {
      createRepeatSampler(mockDevice);
      expect(mockDevice.createSampler).toHaveBeenCalledWith(expect.objectContaining({
        addressModeU: 'repeat',
        addressModeV: 'repeat'
      }));
    });
  });

  describe('ShaderModule & Pipelines', () => {
    it('creates ShaderModule', async () => {
      const code = '@vertex fn main() {}';
      const shader = new ShaderModule(mockDevice, { code, label: 'test-shader' });

      expect(mockDevice.createShaderModule).toHaveBeenCalledWith({
        code,
        label: 'test-shader'
      });
      expect(shader.module).toBe(mockShaderModule);
      await expect(shader.compilationInfo).resolves.toEqual({ messages: [] });
    });

    it('creates RenderPipeline', () => {
      const vertexModule = new ShaderModule(mockDevice, { code: '' });
      const fragmentModule = new ShaderModule(mockDevice, { code: '' });
      const descriptor: PipelineDescriptor = {
        vertex: {
          module: vertexModule,
          entryPoint: 'vs_main',
          buffers: []
        },
        fragment: {
          module: fragmentModule,
          entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm' }]
        },
        layout: 'auto',
        label: 'test-pipeline'
      };

      const pipeline = new RenderPipeline(mockDevice, descriptor);

      expect(mockDevice.createRenderPipeline).toHaveBeenCalledWith(expect.objectContaining({
        label: 'test-pipeline',
        layout: 'auto',
        vertex: expect.objectContaining({
          entryPoint: 'vs_main',
          module: mockShaderModule
        }),
        fragment: expect.objectContaining({
          entryPoint: 'fs_main',
          module: mockShaderModule
        })
      }));
      expect(pipeline.pipeline).toBe(mockRenderPipeline);
      expect(pipeline.layout).toBe('auto');
    });

    it('creates ComputePipeline', () => {
      const computeModule = new ShaderModule(mockDevice, { code: '' });
      const pipeline = new ComputePipeline(mockDevice, {
        compute: {
          module: computeModule,
          entryPoint: 'main'
        },
        layout: 'auto',
        label: 'compute-pipeline'
      });

      expect(mockDevice.createComputePipeline).toHaveBeenCalledWith(expect.objectContaining({
        label: 'compute-pipeline',
        layout: 'auto',
        compute: expect.objectContaining({
          entryPoint: 'main',
          module: mockShaderModule
        })
      }));
      expect(pipeline.pipeline).toBe(mockComputePipeline);
    });
  });

  describe('GPUResourceTracker', () => {
    it('tracks multiple buffers correctly', () => {
      const b1 = new VertexBuffer(mockDevice, { size: 1000 });
      const b2 = new UniformBuffer(mockDevice, { size: 500 });

      expect(resourceTracker.totalBufferMemory).toBe(1500);
      expect(resourceTracker.bufferCount).toBe(2);

      b1.destroy();
      expect(resourceTracker.totalBufferMemory).toBe(500);
      expect(resourceTracker.bufferCount).toBe(1);

      b2.destroy();
      expect(resourceTracker.totalBufferMemory).toBe(0);
      expect(resourceTracker.bufferCount).toBe(0);
    });

    it('tracks textures correctly', () => {
        const t1 = new Texture2D(mockDevice, { width: 10, height: 10, format: 'rgba8unorm' });
        expect(resourceTracker.textureCount).toBe(1);
        expect(resourceTracker.totalTextureMemory).toBe(400);

        t1.destroy();
        expect(resourceTracker.textureCount).toBe(0);
        expect(resourceTracker.totalTextureMemory).toBe(0);
    });

    it('reset clears all tracking', () => {
      new VertexBuffer(mockDevice, { size: 1000 });
      new Texture2D(mockDevice, { width: 10, height: 10, format: 'rgba8unorm' });
      resourceTracker.reset();
      expect(resourceTracker.totalBufferMemory).toBe(0);
      expect(resourceTracker.totalTextureMemory).toBe(0);
      expect(resourceTracker.bufferCount).toBe(0);
      expect(resourceTracker.textureCount).toBe(0);
    });
  });
});
