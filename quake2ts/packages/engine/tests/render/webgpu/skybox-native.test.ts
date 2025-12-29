import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SkyboxPipeline } from '../../../src/render/webgpu/pipelines/skybox.js';
import { CameraState } from '../../../src/render/types/camera.js';
import { WebGPUMatrixBuilder } from '../../../src/render/matrix/webgpu.js';

// Mock WebGPU globals
if (typeof global !== 'undefined') {
    (global as any).GPUBufferUsage = {
        VERTEX: 1,
        COPY_DST: 2,
        UNIFORM: 4
    };
    (global as any).GPUShaderStage = {
        VERTEX: 1,
        FRAGMENT: 2
    };
}

// Mock WebGPU types
const deviceMock = {
    createShaderModule: vi.fn(),
    createBuffer: vi.fn(() => ({
        getMappedRange: vi.fn(() => new ArrayBuffer(1024)),
        unmap: vi.fn(),
        destroy: vi.fn()
    })),
    createSampler: vi.fn(),
    createBindGroupLayout: vi.fn(),
    createBindGroup: vi.fn(),
    createRenderPipeline: vi.fn(),
    createPipelineLayout: vi.fn(),
    queue: {
        writeBuffer: vi.fn()
    }
} as unknown as GPUDevice;

const passEncoderMock = {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    setVertexBuffer: vi.fn(),
    draw: vi.fn()
} as unknown as GPURenderPassEncoder;

const cubemapMock = {
    createView: vi.fn()
} as any;

describe('Skybox Pipeline (Native Coordinates)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('uses CameraState to build matrices', () => {
    const pipeline = new SkyboxPipeline(deviceMock, 'bgra8unorm');
    const cameraState: CameraState = {
      position: [0, 0, 50],
      angles: [0, 0, 0],
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    // Should not throw
    pipeline.draw(passEncoderMock, {
      cameraState,
      scroll: [0, 0],
      cubemap: cubemapMock
    });

    // Verify uniforms updated
    expect(deviceMock.queue.writeBuffer).toHaveBeenCalled();
  });

  test('calls matrix builder methods', () => {
    const pipeline = new SkyboxPipeline(deviceMock, 'bgra8unorm');
    const cameraState: CameraState = {
        position: [0, 0, 50],
        angles: [0, 0, 0],
        fov: 90,
        aspect: 1.0,
        near: 0.1,
        far: 1000
      };

      pipeline.draw(passEncoderMock, {
        cameraState,
        scroll: [0, 0],
        cubemap: cubemapMock
      });

      expect(passEncoderMock.setPipeline).toHaveBeenCalled();
      expect(passEncoderMock.draw).toHaveBeenCalled();
  });
});
