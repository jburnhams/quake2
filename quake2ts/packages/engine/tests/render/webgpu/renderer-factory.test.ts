import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebGPURenderer, WebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { Camera } from '../../../src/render/camera.js';
import { mat4 } from 'gl-matrix';

// Mock Navigator.gpu
const mockGpu = {
  requestAdapter: vi.fn(() => Promise.resolve({
    requestDevice: vi.fn(() => Promise.resolve({
      createCommandEncoder: vi.fn(() => ({
        beginRenderPass: vi.fn(() => ({
          end: vi.fn(),
          setBindGroup: vi.fn(),
          setPipeline: vi.fn(),
          setVertexBuffer: vi.fn(),
          setIndexBuffer: vi.fn(),
          draw: vi.fn(),
          drawIndexed: vi.fn(),
        })),
        finish: vi.fn(),
      })),
      createTexture: vi.fn(() => ({
        createView: vi.fn(() => ({})),
        destroy: vi.fn(),
      })),
      createPipelineLayout: vi.fn(() => ({})),
      createBindGroupLayout: vi.fn(() => ({})),
      createRenderPipeline: vi.fn(() => ({
        getBindGroupLayout: vi.fn(() => ({})),
      })),
      createShaderModule: vi.fn(() => ({})),
      createBuffer: vi.fn((descriptor: any) => ({
        destroy: vi.fn(),
        getMappedRange: vi.fn(() => new ArrayBuffer(descriptor.size)),
        unmap: vi.fn(),
      })),
      createBindGroup: vi.fn(() => ({})),
      createSampler: vi.fn(() => ({})),
      limits: {},
      queue: {
        submit: vi.fn(),
        writeBuffer: vi.fn(),
        writeTexture: vi.fn(),
      },
      lost: Promise.resolve({ reason: 'destroyed' }),
      destroy: vi.fn(),
    })),
    features: new Set(),
  })),
  getPreferredCanvasFormat: vi.fn(() => 'bgra8unorm'),
};

(global as any).navigator = {
  gpu: mockGpu
};

// Mock GPUTextureUsage/BufferUsage if needed
if (typeof GPUTextureUsage === 'undefined') {
  (global as any).GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
}
if (typeof GPUBufferUsage === 'undefined') {
    (global as any).GPUBufferUsage = {
      MAP_READ: 0x0001,
      MAP_WRITE: 0x0002,
      COPY_SRC: 0x0004,
      COPY_DST: 0x0008,
      INDEX: 0x0010,
      VERTEX: 0x0020,
      UNIFORM: 0x0040,
      STORAGE: 0x0080,
      INDIRECT: 0x0100,
      QUERY_RESOLVE: 0x0200,
    };
}
if (typeof GPUShaderStage === 'undefined') {
    (global as any).GPUShaderStage = {
        VERTEX: 1,
        FRAGMENT: 2,
        COMPUTE: 4
    };
}


describe('WebGPURenderer Integration (Mocked)', () => {
  it('creates a renderer and renders a frame', async () => {
    const renderer = await createWebGPURenderer();
    expect(renderer).toBeDefined();
    expect(renderer.type).toBe('webgpu');

    const camera = new Camera(90, 1.0);
    // renderFrame returns void per IRenderer interface
    renderer.renderFrame({
      camera,
      timeSeconds: 0,
    });

    // Verify no errors thrown during rendering
    expect(renderer).toBeDefined();

    // Check if pipelines were initialized
    expect(renderer.pipelines.sprite).toBeDefined();
  });
});
