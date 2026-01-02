import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VertexBuffer,
  IndexBuffer,
  UniformBuffer,
  StorageBuffer,
  Texture2D,
  TextureCubeMap,
  setResourceTracker,
  Sampler,
  createLinearSampler,
  ShaderModule,
  RenderPipeline,
  ComputePipeline,
  BindGroupLayout,
  BindGroup,
  BindGroupBuilder,
  createRenderPassDescriptor,
  GPUResourceTracker
} from '../../../../src/render/webgpu/resources';
import { setupWebGPUMocks } from '@quake2ts/test-utils/src/engine/mocks/webgpu';

describe('WebGPU Buffer Resources', () => {
  let mockDevice: GPUDevice;
  let mockQueue: GPUQueue;

  beforeEach(() => {
    const { mockDevice: device } = setupWebGPUMocks();
    mockDevice = device;
    mockQueue = device.queue;

    setResourceTracker({
        trackBuffer: vi.fn(),
        trackTexture: vi.fn(),
        untrackBuffer: vi.fn(),
        untrackTexture: vi.fn()
    } as any);
  });

  describe('VertexBuffer', () => {
    it('creates buffer with correct usage flags', () => {
      const buffer = new VertexBuffer(mockDevice, { size: 1024, label: 'test-vertex' });

      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: 1024,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        label: 'test-vertex',
        mappedAtCreation: undefined
      });
      expect(buffer.size).toBe(1024);
    });

    it('allows adding extra usage flags', () => {
      new VertexBuffer(mockDevice, {
        size: 1024,
        usage: GPUBufferUsage.STORAGE
      });

      const calls = (mockDevice.createBuffer as any).mock.calls;
      const descriptor = calls[calls.length - 1][0];
      expect(descriptor.usage & GPUBufferUsage.STORAGE).toBeTruthy();
      expect(descriptor.usage & GPUBufferUsage.VERTEX).toBeTruthy();
    });
  });

  describe('IndexBuffer', () => {
    it('creates buffer with correct usage flags', () => {
      new IndexBuffer(mockDevice, { size: 512 });

      const calls = (mockDevice.createBuffer as any).mock.calls;
      const descriptor = calls[calls.length - 1][0];
      expect(descriptor.usage & GPUBufferUsage.INDEX).toBeTruthy();
      expect(descriptor.usage & GPUBufferUsage.COPY_DST).toBeTruthy();
    });
  });

  describe('UniformBuffer', () => {
    it('creates buffer with correct usage flags', () => {
      new UniformBuffer(mockDevice, { size: 256 });

      const calls = (mockDevice.createBuffer as any).mock.calls;
      const descriptor = calls[calls.length - 1][0];
      expect(descriptor.usage & GPUBufferUsage.UNIFORM).toBeTruthy();
      expect(descriptor.usage & GPUBufferUsage.COPY_DST).toBeTruthy();
    });
  });

  describe('StorageBuffer', () => {
    it('creates buffer with correct usage flags', () => {
      new StorageBuffer(mockDevice, { size: 2048 });

      const calls = (mockDevice.createBuffer as any).mock.calls;
      const descriptor = calls[calls.length - 1][0];
      expect(descriptor.usage & GPUBufferUsage.STORAGE).toBeTruthy();
      expect(descriptor.usage & GPUBufferUsage.COPY_DST).toBeTruthy();
    });
  });

  describe('GPUBufferResource Base Functionality', () => {
    it('writes data to buffer', () => {
      const buffer = new VertexBuffer(mockDevice, { size: 1024 });
      const data = new Float32Array([1, 2, 3, 4]);

      buffer.write(data);

      expect(mockQueue.writeBuffer).toHaveBeenCalledWith(
        buffer.buffer,
        0,
        data,
        0
        // size is optional/undefined in current implementation
      );
    });

    it('supports write with offset', () => {
      const buffer = new VertexBuffer(mockDevice, { size: 1024 });
      const data = new Float32Array([1, 2]);

      buffer.write(data, 128);

      expect(mockQueue.writeBuffer).toHaveBeenCalledWith(
        buffer.buffer,
        128,
        data,
        0
        // size is optional/undefined in current implementation
      );
    });

    it('maps buffer async', async () => {
      const buffer = new StorageBuffer(mockDevice, { size: 1024 });

      await buffer.mapAsync(GPUMapMode.READ);

      expect(buffer.buffer.mapAsync).toHaveBeenCalledWith(GPUMapMode.READ, 0, undefined);
    });

    it('gets mapped range', () => {
      const buffer = new StorageBuffer(mockDevice, { size: 1024 });

      buffer.getMappedRange();

      expect(buffer.buffer.getMappedRange).toHaveBeenCalledWith(0, undefined);
    });

    it('unmaps buffer', () => {
      const buffer = new StorageBuffer(mockDevice, { size: 1024 });

      buffer.unmap();

      expect(buffer.buffer.unmap).toHaveBeenCalled();
    });

    it('destroys buffer', () => {
      const buffer = new VertexBuffer(mockDevice, { size: 1024 });

      buffer.destroy();

      expect(buffer.buffer.destroy).toHaveBeenCalled();
    });
  });

  describe('Resource Tracking', () => {
    it('tracks buffer creation and destruction', () => {
      const tracker = {
        trackBuffer: vi.fn(),
        trackTexture: vi.fn(),
        untrackBuffer: vi.fn(),
        untrackTexture: vi.fn()
      };
      setResourceTracker(tracker);

      const buffer = new VertexBuffer(mockDevice, { size: 1024 });
      expect(tracker.trackBuffer).toHaveBeenCalledWith(buffer);

      buffer.destroy();
      expect(tracker.untrackBuffer).toHaveBeenCalledWith(buffer);
    });
  });
});

describe('WebGPU Texture Resources', () => {
    let mockDevice: GPUDevice;
    let mockQueue: GPUQueue;

    beforeEach(() => {
        const { mockDevice: device } = setupWebGPUMocks();
        mockDevice = device;
        mockQueue = device.queue;

        setResourceTracker({
            trackBuffer: vi.fn(),
            trackTexture: vi.fn(),
            untrackBuffer: vi.fn(),
            untrackTexture: vi.fn()
        } as any);
    });

    describe('Texture2D', () => {
        it('creates texture with correct dimensions and format', () => {
            const texture = new Texture2D(mockDevice, {
                width: 256,
                height: 256,
                format: 'rgba8unorm',
                label: 'test-texture'
            });

            expect(mockDevice.createTexture).toHaveBeenCalledWith({
                size: [256, 256, 1],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
                mipLevelCount: 1,
                label: 'test-texture'
            });
            expect(texture.width).toBe(256);
            expect(texture.height).toBe(256);
            expect(texture.format).toBe('rgba8unorm');
        });

        it('uploads data to texture', () => {
            const texture = new Texture2D(mockDevice, {
                width: 256,
                height: 256,
                format: 'rgba8unorm'
            });
            const data = new Uint8Array(256 * 256 * 4);

            texture.upload(data);

            expect(mockQueue.writeTexture).toHaveBeenCalledWith(
                { texture: texture.texture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
                data,
                { offset: 0, bytesPerRow: 256 * 4, rowsPerImage: 256 },
                { width: 256, height: 256, depthOrArrayLayers: 1 }
            );
        });

        it('calculates memory size correctly for RGBA8', () => {
            const texture = new Texture2D(mockDevice, {
                width: 256,
                height: 256,
                format: 'rgba8unorm'
            });
            expect(texture.memorySize).toBe(256 * 256 * 4);
        });

        it('creates texture view', () => {
            const texture = new Texture2D(mockDevice, {
                width: 256,
                height: 256,
                format: 'rgba8unorm'
            });

            texture.createView();
            expect(texture.texture.createView).toHaveBeenCalled();
        });

        it('destroys texture', () => {
            const texture = new Texture2D(mockDevice, {
                width: 256,
                height: 256,
                format: 'rgba8unorm'
            });

            texture.destroy();
            expect(texture.texture.destroy).toHaveBeenCalled();
        });

        it('generates mipmaps using render passes', () => {
            const texture = new Texture2D(mockDevice, {
                width: 256,
                height: 256,
                format: 'rgba8unorm',
                mipLevelCount: 3 // levels 0, 1, 2
            });

            const commandEncoder = mockDevice.createCommandEncoder();
            const beginRenderPassSpy = vi.spyOn(commandEncoder, 'beginRenderPass');

            texture.generateMipmaps(commandEncoder);

            // Should generate level 1 from 0, and level 2 from 1. Total 2 passes.
            expect(beginRenderPassSpy).toHaveBeenCalledTimes(2);

            // First pass: render to level 1
            const pass1 = beginRenderPassSpy.mock.calls[0][0];
            const attachments1 = pass1.colorAttachments as GPURenderPassColorAttachment[];
            expect(attachments1[0].view).toBeDefined(); // can't easily check mip level on mock view without more complex mock

            // Should create pipeline and sampler
            expect(mockDevice.createRenderPipeline).toHaveBeenCalled();
            expect(mockDevice.createSampler).toHaveBeenCalled();
        });

        it('uses cached mipmap pipeline for same format', () => {
             const texture1 = new Texture2D(mockDevice, { width: 32, height: 32, format: 'rgba8unorm', mipLevelCount: 2 });
             const texture2 = new Texture2D(mockDevice, { width: 32, height: 32, format: 'rgba8unorm', mipLevelCount: 2 });
             const commandEncoder = mockDevice.createCommandEncoder();

             texture1.generateMipmaps(commandEncoder);
             texture2.generateMipmaps(commandEncoder);

             // Should create pipeline only once for rgba8unorm
             expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(1);
        });

        it('creates new mipmap pipeline for different format', () => {
             const texture1 = new Texture2D(mockDevice, { width: 32, height: 32, format: 'rgba8unorm', mipLevelCount: 2 });
             const texture2 = new Texture2D(mockDevice, { width: 32, height: 32, format: 'bgra8unorm', mipLevelCount: 2 });
             const commandEncoder = mockDevice.createCommandEncoder();

             texture1.generateMipmaps(commandEncoder);
             texture2.generateMipmaps(commandEncoder);

             // Should create pipeline twice
             expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(2);
        });
    });

    describe('TextureCubeMap', () => {
        it('creates cubemap with 6 layers', () => {
            const cubemap = new TextureCubeMap(mockDevice, {
                size: 256,
                format: 'rgba8unorm'
            });

            expect(mockDevice.createTexture).toHaveBeenCalledWith({
                size: [256, 256, 6],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
                mipLevelCount: 1,
                label: undefined
            });
        });

        it('uploads to a specific face', () => {
            const cubemap = new TextureCubeMap(mockDevice, {
                size: 256,
                format: 'rgba8unorm'
            });
            const data = new Uint8Array(256 * 256 * 4);

            cubemap.uploadFace(2, data); // Face 2

            expect(mockQueue.writeTexture).toHaveBeenCalledWith(
                { texture: cubemap.texture, mipLevel: 0, origin: { x: 0, y: 0, z: 2 } },
                data,
                { offset: 0, bytesPerRow: 256 * 4, rowsPerImage: 256 },
                { width: 256, height: 256, depthOrArrayLayers: 1 }
            );
        });

        it('calculates memory size correctly (6 faces)', () => {
            const cubemap = new TextureCubeMap(mockDevice, {
                size: 256,
                format: 'rgba8unorm'
            });
            // 256*256*4 bytes * 6 faces
            expect(cubemap.memorySize).toBe(256 * 256 * 4 * 6);
        });

        it('creates view as cube', () => {
            const cubemap = new TextureCubeMap(mockDevice, {
                size: 256,
                format: 'rgba8unorm'
            });

            cubemap.createView();
            expect(cubemap.texture.createView).toHaveBeenCalledWith({ dimension: 'cube' });
        });
    });
});

describe('WebGPU Sampler Management', () => {
    let mockDevice: GPUDevice;

    beforeEach(() => {
        const { mockDevice: device } = setupWebGPUMocks();
        mockDevice = device;
    });

    it('creates a sampler with given descriptor', () => {
        const sampler = new Sampler(mockDevice, {
            minFilter: 'linear',
            label: 'test-sampler'
        });

        expect(mockDevice.createSampler).toHaveBeenCalledWith({
            minFilter: 'linear',
            label: 'test-sampler'
        });
        expect(sampler.sampler).toBeDefined();
    });

    it('createLinearSampler creates correct sampler', () => {
        createLinearSampler(mockDevice);
        expect(mockDevice.createSampler).toHaveBeenCalledWith(expect.objectContaining({
            minFilter: 'linear',
            magFilter: 'linear'
        }));
    });
});

describe('WebGPU Shader & Pipeline', () => {
    let mockDevice: GPUDevice;

    beforeEach(() => {
        const { mockDevice: device } = setupWebGPUMocks();
        mockDevice = device;
    });

    describe('ShaderModule', () => {
        it('compiles shader module', () => {
            const code = '@vertex fn main() {}';
            const shader = new ShaderModule(mockDevice, { code, label: 'test-shader' });

            expect(mockDevice.createShaderModule).toHaveBeenCalledWith({
                code,
                label: 'test-shader'
            });
            expect(shader.module).toBeDefined();
        });

        it('provides compilation info', async () => {
            const shader = new ShaderModule(mockDevice, { code: '' });
            const info = await shader.compilationInfo;
            expect(info).toBeDefined();
        });
    });

    describe('RenderPipeline', () => {
        it('creates render pipeline', () => {
            const vertexModule = new ShaderModule(mockDevice, { code: '' });
            const fragmentModule = new ShaderModule(mockDevice, { code: '' });

            new RenderPipeline(mockDevice, {
                vertex: {
                    module: vertexModule,
                    entryPoint: 'main',
                    buffers: []
                },
                fragment: {
                    module: fragmentModule,
                    entryPoint: 'main',
                    targets: [{ format: 'bgra8unorm' }]
                },
                layout: 'auto',
                label: 'test-pipeline'
            });

            expect(mockDevice.createRenderPipeline).toHaveBeenCalledWith(expect.objectContaining({
                label: 'test-pipeline',
                vertex: expect.objectContaining({ entryPoint: 'main' }),
                fragment: expect.objectContaining({ entryPoint: 'main' })
            }));
        });
    });

    describe('ComputePipeline', () => {
        it('creates compute pipeline', () => {
            const computeModule = new ShaderModule(mockDevice, { code: '' });

            new ComputePipeline(mockDevice, {
                compute: {
                    module: computeModule,
                    entryPoint: 'main'
                },
                layout: 'auto',
                label: 'test-compute'
            });

            expect(mockDevice.createComputePipeline).toHaveBeenCalledWith(expect.objectContaining({
                label: 'test-compute',
                compute: expect.objectContaining({ entryPoint: 'main' })
            }));
        });
    });
});

describe('WebGPU Bind Group Management', () => {
    let mockDevice: GPUDevice;

    beforeEach(() => {
        const { mockDevice: device } = setupWebGPUMocks();
        mockDevice = device;
    });

    describe('BindGroupLayout', () => {
        it('creates bind group layout', () => {
            new BindGroupLayout(mockDevice, {
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                }],
                label: 'test-layout'
            });

            expect(mockDevice.createBindGroupLayout).toHaveBeenCalledWith({
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                }],
                label: 'test-layout'
            });
        });
    });

    describe('BindGroup', () => {
        it('creates bind group with resources', () => {
            const layout = new BindGroupLayout(mockDevice, { entries: [] });
            const buffer = new UniformBuffer(mockDevice, { size: 16 });

            new BindGroup(mockDevice, layout, [
                { binding: 0, resource: buffer }
            ], 'test-bindgroup');

            expect(mockDevice.createBindGroup).toHaveBeenCalledWith(expect.objectContaining({
                label: 'test-bindgroup',
                layout: layout.layout,
                entries: expect.arrayContaining([
                    expect.objectContaining({
                        binding: 0,
                        resource: { buffer: buffer.buffer }
                    })
                ])
            }));
        });

        it('handles texture views and samplers', () => {
            const layout = new BindGroupLayout(mockDevice, { entries: [] });
            const texture = new Texture2D(mockDevice, { width: 4, height: 4, format: 'rgba8unorm' });
            const view = texture.createView();
            const sampler = new Sampler(mockDevice, {});

            new BindGroup(mockDevice, layout, [
                { binding: 0, resource: view },
                { binding: 1, resource: sampler }
            ]);

            expect(mockDevice.createBindGroup).toHaveBeenCalledWith(expect.objectContaining({
                entries: expect.arrayContaining([
                    expect.objectContaining({ binding: 0, resource: view }),
                    expect.objectContaining({ binding: 1, resource: sampler.sampler })
                ])
            }));
        });
    });

    describe('BindGroupBuilder', () => {
        it('builds layout with ergonomic API', () => {
            const builder = new BindGroupBuilder('test-builder');

            builder
                .addUniformBuffer(0, GPUShaderStage.VERTEX)
                .addTexture(1, GPUShaderStage.FRAGMENT)
                .addSampler(2, GPUShaderStage.FRAGMENT);

            const layout = builder.build(mockDevice);

            expect(mockDevice.createBindGroupLayout).toHaveBeenCalledWith(expect.objectContaining({
                label: 'test-builder',
                entries: expect.arrayContaining([
                    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
                    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
                    { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
                ])
            }));
        });
    });
});

describe('WebGPU Render Pass Helpers', () => {
    let mockDevice: GPUDevice;

    beforeEach(() => {
        const { mockDevice: device } = setupWebGPUMocks();
        mockDevice = device;
    });

    it('builds a render pass descriptor', () => {
        const texture = new Texture2D(mockDevice, { width: 256, height: 256, format: 'rgba8unorm' });
        const view = texture.createView();

        const builder = createRenderPassDescriptor();
        builder.setColorAttachment(0, view, { clearValue: { r: 1, g: 0, b: 0, a: 1 } });

        const descriptor = builder.build();

        expect(descriptor.colorAttachments).toHaveLength(1);
        expect((descriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view).toBe(view);
        expect((descriptor.colorAttachments as GPURenderPassColorAttachment[])[0].clearValue).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });

    it('supports depth stencil attachment', () => {
        const texture = new Texture2D(mockDevice, { width: 256, height: 256, format: 'depth24plus' });
        const view = texture.createView();

        const builder = createRenderPassDescriptor();
        builder.setDepthStencilAttachment(view, { depthClearValue: 0.5 });

        const descriptor = builder.build();

        expect(descriptor.depthStencilAttachment).toBeDefined();
        expect(descriptor.depthStencilAttachment!.view).toBe(view);
        expect(descriptor.depthStencilAttachment!.depthClearValue).toBe(0.5);
    });
});

describe('GPUResourceTracker', () => {
    let mockDevice: GPUDevice;

    beforeEach(() => {
        const { mockDevice: device } = setupWebGPUMocks();
        mockDevice = device;
    });

    it('tracks resource usage', () => {
        const tracker = new GPUResourceTracker();
        setResourceTracker(tracker);

        // Initial state
        expect(tracker.bufferCount).toBe(0);
        expect(tracker.totalBufferMemory).toBe(0);

        // Create buffer
        const buffer = new VertexBuffer(mockDevice, { size: 1024 });
        expect(tracker.bufferCount).toBe(1);
        expect(tracker.totalBufferMemory).toBe(1024);

        // Create texture
        const texture = new Texture2D(mockDevice, { width: 4, height: 4, format: 'rgba8unorm' }); // 16 pixels * 4 bytes = 64 bytes
        expect(tracker.textureCount).toBe(1);
        expect(tracker.totalTextureMemory).toBe(64);

        // Destroy
        buffer.destroy();
        expect(tracker.bufferCount).toBe(0);
        expect(tracker.totalBufferMemory).toBe(0);

        texture.destroy();
        expect(tracker.textureCount).toBe(0);
        expect(tracker.totalTextureMemory).toBe(0);
    });

    it('resets tracking', () => {
        const tracker = new GPUResourceTracker();
        setResourceTracker(tracker);

        new VertexBuffer(mockDevice, { size: 1024 });

        tracker.reset();

        expect(tracker.bufferCount).toBe(0);
        expect(tracker.totalBufferMemory).toBe(0);
    });
});
