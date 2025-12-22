import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VertexBuffer,
  IndexBuffer,
  UniformBuffer,
  StorageBuffer,
  Texture2D,
  TextureCubeMap,
  setResourceTracker,
  ResourceTracker,
  Sampler,
  createLinearSampler,
  createNearestSampler,
  ShaderModule,
  RenderPipeline,
  ComputePipeline,
  BindGroupLayout,
  BindGroup,
  BindGroupBuilder,
  createRenderPassDescriptor,
  GPUResourceTracker
} from '../../../src/render/webgpu/resources.js';
import { createMockGPUDevice, setupWebGPUMocks } from '../../../../test-utils/src/engine/mocks/webgpu.js';

describe('WebGPU Resources', () => {
  let device: GPUDevice;
  let tracker: ResourceTracker;

  beforeEach(() => {
    setupWebGPUMocks();
    device = createMockGPUDevice();

    // Mock tracker
    tracker = {
      trackBuffer: vi.fn(),
      trackTexture: vi.fn(),
      untrackBuffer: vi.fn(),
      untrackTexture: vi.fn()
    };
    setResourceTracker(tracker);
  });

  describe('VertexBuffer', () => {
    it('creates buffer with correct usage', () => {
      const buffer = new VertexBuffer(device, { size: 1024, label: 'test-vertex' });

      expect(device.createBuffer).toHaveBeenCalledWith(expect.objectContaining({
        size: 1024,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        label: 'test-vertex'
      }));
      expect(buffer.size).toBe(1024);
      expect(tracker.trackBuffer).toHaveBeenCalledWith(buffer);
    });

    it('writes data to buffer', () => {
      const buffer = new VertexBuffer(device, { size: 1024 });
      const data = new Float32Array([1, 2, 3]);

      buffer.write(data);

      expect(device.queue.writeBuffer).toHaveBeenCalledWith(
        expect.anything(),
        0,
        data,
        0,
        data.byteLength
      );
    });

    it('destroys buffer and updates tracker', () => {
      const buffer = new VertexBuffer(device, { size: 1024 });
      buffer.destroy();

      expect(tracker.untrackBuffer).toHaveBeenCalledWith(buffer);
    });
  });

  describe('IndexBuffer', () => {
    it('creates buffer with correct usage', () => {
      new IndexBuffer(device, { size: 512 });

      expect(device.createBuffer).toHaveBeenCalledWith(expect.objectContaining({
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      }));
    });
  });

  describe('UniformBuffer', () => {
    it('creates buffer with correct usage', () => {
      new UniformBuffer(device, { size: 256 });

      expect(device.createBuffer).toHaveBeenCalledWith(expect.objectContaining({
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      }));
    });
  });

  describe('StorageBuffer', () => {
    it('creates buffer with correct usage', () => {
      new StorageBuffer(device, { size: 1024 });

      expect(device.createBuffer).toHaveBeenCalledWith(expect.objectContaining({
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }));
    });

    it('maps and unmaps buffer', async () => {
      // Need MAP_READ usage for mapping in read mode
      // Or we need to use mapState mock.
      // But StorageBuffer constructor hardcodes usages to STORAGE | COPY_DST.
      // If we want to test mapAsync for read, we need a buffer with MAP_READ.
      // The current StorageBuffer abstraction doesn't easily allow adding MAP_READ unless we modify the constructor usage or add it.
      // Let's modify the test to manually create a buffer or assume the user would create a generic GPUBufferResource for readback if needed,
      // or that StorageBuffer supports additional flags.
      // The class StorageBuffer in resources.ts takes a descriptor but overrides usage?
      // Ah, I updated the class to take mappedAtCreation, but the usage flags in subclasses are fixed ORed with input?
      // Looking at `StorageBuffer` constructor:
      // super(device, { ..., usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | (descriptor.usage || 0) ... })
      // So we can pass MAP_READ in usage.

      const buffer = new StorageBuffer(device, {
        size: 1024,
        usage: GPUBufferUsage.MAP_READ
      });

      await buffer.mapAsync(GPUMapMode.READ);
      expect(buffer.buffer.mapAsync).toHaveBeenCalledWith(GPUMapMode.READ, 0, undefined);

      buffer.getMappedRange();
      expect(buffer.buffer.getMappedRange).toHaveBeenCalled();

      buffer.unmap();
      expect(buffer.buffer.unmap).toHaveBeenCalled();
    });
  });

  describe('Texture2D', () => {
    it('creates texture with correct dimension and format', () => {
      const texture = new Texture2D(device, {
        width: 100,
        height: 100,
        format: 'rgba8unorm',
        label: 'test-texture'
      });

      expect(device.createTexture).toHaveBeenCalledWith(expect.objectContaining({
        size: [100, 100, 1],
        format: 'rgba8unorm',
        dimension: '2d',
        label: 'test-texture'
      }));
      expect(tracker.trackTexture).toHaveBeenCalledWith(texture);
      expect(texture.memorySize).toBeGreaterThan(0);
    });

    it('uploads data to texture', () => {
      const texture = new Texture2D(device, {
        width: 2,
        height: 2,
        format: 'rgba8unorm'
      });
      const data = new Uint8Array([255, 0, 0, 255]);

      texture.upload(data);

      expect(device.queue.writeTexture).toHaveBeenCalledWith(
        expect.objectContaining({ texture: texture.texture }),
        data,
        expect.anything(),
        expect.anything()
      );
    });

    it('creates view', () => {
      const texture = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      texture.createView();
      expect(texture.texture.createView).toHaveBeenCalled();
    });

    it('destroys texture and updates tracker', () => {
      const texture = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      texture.destroy();
      expect(tracker.untrackTexture).toHaveBeenCalledWith(texture);
      expect(texture.texture.destroy).toHaveBeenCalled();
    });
  });

  describe('TextureCubeMap', () => {
    it('creates cubemap texture (6 layers)', () => {
      const cubemap = new TextureCubeMap(device, {
        size: 64,
        format: 'rgba8unorm',
        label: 'skybox'
      });

      expect(device.createTexture).toHaveBeenCalledWith(expect.objectContaining({
        size: [64, 64, 6],
        dimension: '2d', // WebGPU uses 2d array for cubes
        label: 'skybox'
      }));
      expect(tracker.trackTexture).toHaveBeenCalledWith(cubemap);
    });

    it('uploads to a specific face', () => {
      const cubemap = new TextureCubeMap(device, { size: 64, format: 'rgba8unorm' });
      const data = new Uint8Array(100);

      cubemap.uploadFace(2, data); // +Y face

      expect(device.queue.writeTexture).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: [0, 0, 2]
        }),
        data,
        expect.anything(),
        expect.anything()
      );
    });

    it('creates cube view', () => {
      const cubemap = new TextureCubeMap(device, { size: 64, format: 'rgba8unorm' });
      cubemap.createView();

      expect(cubemap.texture.createView).toHaveBeenCalledWith(expect.objectContaining({
        dimension: 'cube'
      }));
    });
  });

  describe('Sampler', () => {
    it('creates sampler with descriptor', () => {
      new Sampler(device, {
        minFilter: 'linear',
        magFilter: 'linear'
      });

      expect(device.createSampler).toHaveBeenCalledWith(expect.objectContaining({
        minFilter: 'linear',
        magFilter: 'linear'
      }));
    });

    it('factory functions create correct samplers', () => {
      createLinearSampler(device);
      expect(device.createSampler).toHaveBeenCalledWith(expect.objectContaining({
        minFilter: 'linear',
        magFilter: 'linear'
      }));

      createNearestSampler(device);
      expect(device.createSampler).toHaveBeenCalledWith(expect.objectContaining({
        minFilter: 'nearest',
        magFilter: 'nearest'
      }));
    });
  });

  describe('ShaderModule', () => {
    it('creates shader module from code', async () => {
      const shader = new ShaderModule(device, {
        code: '@vertex fn main() {}',
        label: 'test-shader'
      });

      expect(device.createShaderModule).toHaveBeenCalledWith(expect.objectContaining({
        code: '@vertex fn main() {}',
        label: 'test-shader'
      }));

      await shader.getCompilationInfo();
      expect(shader.module.getCompilationInfo).toHaveBeenCalled();
    });
  });

  describe('RenderPipeline', () => {
    it('creates render pipeline', () => {
      const vertexModule = new ShaderModule(device, { code: '' });
      const fragmentModule = new ShaderModule(device, { code: '' });

      new RenderPipeline(device, {
        vertex: {
          module: vertexModule,
          entryPoint: 'vs_main'
        },
        fragment: {
          module: fragmentModule,
          entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm' }]
        },
        layout: 'auto',
        label: 'test-pipeline'
      });

      expect(device.createRenderPipeline).toHaveBeenCalledWith(expect.objectContaining({
        vertex: expect.objectContaining({
           entryPoint: 'vs_main'
        }),
        fragment: expect.objectContaining({
           entryPoint: 'fs_main'
        }),
        layout: 'auto',
        label: 'test-pipeline'
      }));
    });
  });

  describe('ComputePipeline', () => {
    it('creates compute pipeline', () => {
      const module = new ShaderModule(device, { code: '' });

      new ComputePipeline(device, {
        compute: {
          module: module,
          entryPoint: 'main'
        },
        layout: 'auto'
      });

      expect(device.createComputePipeline).toHaveBeenCalledWith(expect.objectContaining({
        compute: expect.objectContaining({ entryPoint: 'main' }),
        layout: 'auto'
      }));
    });
  });

  describe('BindGroup', () => {
    it('creates bind group layout with builder', () => {
      const builder = new BindGroupBuilder();
      builder
        .addUniformBuffer(0, GPUShaderStage.VERTEX)
        .addTexture(1, GPUShaderStage.FRAGMENT)
        .addSampler(2, GPUShaderStage.FRAGMENT);

      const layout = builder.build(device, 'test-layout');

      expect(device.createBindGroupLayout).toHaveBeenCalledWith(expect.objectContaining({
        label: 'test-layout',
        entries: [
          expect.objectContaining({ binding: 0, buffer: { type: 'uniform' } }),
          expect.objectContaining({ binding: 1, texture: { viewDimension: '2d' } }),
          expect.objectContaining({ binding: 2, sampler: { type: 'filtering' } })
        ]
      }));
    });

    it('creates bind group from layout', () => {
      const layout = new BindGroupLayout(device, { entries: [] });
      const buffer = new UniformBuffer(device, { size: 16 });

      new BindGroup(device, layout, [
        { binding: 0, resource: { buffer: buffer.buffer } }
      ], 'test-group');

      expect(device.createBindGroup).toHaveBeenCalledWith(expect.objectContaining({
        layout: layout.layout,
        entries: [
           expect.objectContaining({ binding: 0 })
        ],
        label: 'test-group'
      }));
    });
  });

  describe('RenderPass', () => {
    it('creates render pass descriptor', () => {
      const view = {} as GPUTextureView;
      const depthView = {} as GPUTextureView;

      const descriptor = createRenderPassDescriptor()
        .setColorAttachment(0, view, { clearValue: { r: 0, g: 0, b: 0, a: 1 } })
        .setDepthStencilAttachment(depthView)
        .build();

      expect(descriptor.colorAttachments).toHaveLength(1);

      // We need to check if the color attachment is defined and matches structure
      // Note: descriptor.colorAttachments is array of GPUColorAttachment | null
      const attachment = (descriptor.colorAttachments as GPURenderPassColorAttachment[])[0];
      expect(attachment).toBeDefined();
      expect(attachment.view).toBe(view);
      expect(attachment.loadOp).toBe('clear');

      expect(descriptor.depthStencilAttachment).toBeDefined();
      expect(descriptor.depthStencilAttachment!.view).toBe(depthView);
    });
  });

  describe('ResourceTracker', () => {
    it('tracks buffer memory', () => {
      const realTracker = new GPUResourceTracker();
      setResourceTracker(realTracker);

      const buffer = new VertexBuffer(device, { size: 1000 });
      expect(realTracker.totalBufferMemory).toBe(1000);
      expect(realTracker.bufferCount).toBe(1);

      buffer.destroy();
      expect(realTracker.totalBufferMemory).toBe(0);
      expect(realTracker.bufferCount).toBe(0);
    });

    it('tracks texture memory', () => {
      const realTracker = new GPUResourceTracker();
      setResourceTracker(realTracker);

      const texture = new Texture2D(device, { width: 10, height: 10, format: 'rgba8unorm' });
      // 10*10*4 = 400 bytes approx
      expect(realTracker.totalTextureMemory).toBeGreaterThan(0);
      expect(realTracker.textureCount).toBe(1);

      texture.destroy();
      expect(realTracker.totalTextureMemory).toBe(0);
      expect(realTracker.textureCount).toBe(0);
    });

    it('reset clears stats', () => {
      const realTracker = new GPUResourceTracker();
      setResourceTracker(realTracker);

      new VertexBuffer(device, { size: 1000 });
      realTracker.reset();

      expect(realTracker.totalBufferMemory).toBe(0);
      expect(realTracker.bufferCount).toBe(0);
    });
  });
});
