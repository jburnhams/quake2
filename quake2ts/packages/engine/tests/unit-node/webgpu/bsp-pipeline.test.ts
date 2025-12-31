import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BspSurfacePipeline } from '@quake2ts/engine/render/webgpu/pipelines/bspPipeline';
import { createMockGPUDevice, setupWebGPUMocks } from '@quake2ts/test-utils/src/engine/mocks/webgpu';

// Mock shader import
vi.mock('@quake2ts/engine/render/webgpu/shaders/bsp.wgsl', () => ({
  default: '/* mock shader */',
}));

describe('BspSurfacePipeline', () => {
  let device: GPUDevice;
  let pipeline: BspSurfacePipeline;

  beforeEach(() => {
    // Setup globals like GPUBufferUsage
    setupWebGPUMocks();
    device = createMockGPUDevice();
    pipeline = new BspSurfacePipeline(device, 'bgra8unorm', 'depth24plus');
  });

  it('initializes correctly', () => {
    expect(pipeline).toBeDefined();
    expect(device.createRenderPipeline).toHaveBeenCalledTimes(2); // Regular + Wireframe
    expect(device.createBindGroupLayout).toHaveBeenCalledTimes(3); // Frame, Surface, Texture
  });

  it('creates uniform buffers with correct sizes', () => {
    // Check constructor calls to createBuffer
    // We expect 2 buffers: Frame (large) and Surface (small)
    expect(device.createBuffer).toHaveBeenCalledWith(expect.objectContaining({
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      size: 2048 // Frame buffer
    }));

    expect(device.createBuffer).toHaveBeenCalledWith(expect.objectContaining({
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      size: 256 // Surface buffer
    }));
  });

  it('bind writes frame uniforms', () => {
    const encoder = {
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
    } as unknown as GPURenderPassEncoder;

    const options = {
      modelViewProjection: new Float32Array(16),
      timeSeconds: 1.0,
      brightness: 1.5,
      dlights: [{
        origin: { x: 10, y: 20, z: 30 },
        color: { x: 1, y: 0, z: 0 },
        intensity: 200,
        die: 0,
        radiusSpeed: 0
      }]
    };

    pipeline.bind(encoder, options);

    expect(device.queue.writeBuffer).toHaveBeenCalled();
    // We could inspect the written data if the mock supports it,
    // but verifying it's called is a good start.
  });
});
