import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest';
import { SkyboxPipeline, SkyboxRenderOptions } from '../../../src/render/webgpu/pipelines/skybox.js';
import { CameraState } from '../../../src/render/types/camera.js';
import { TextureCubeMap } from '../../../src/render/resources.js';
import { mat4, vec3 } from 'gl-matrix';

// Polyfill WebGPU Globals
beforeAll(() => {
  vi.stubGlobal('GPUBufferUsage', {
    VERTEX: 1,
    COPY_DST: 2,
    UNIFORM: 4,
  });
  vi.stubGlobal('GPUShaderStage', {
    VERTEX: 1,
    FRAGMENT: 2,
  });
});

// Mocks
const mockDevice = {
  createShaderModule: vi.fn(),
  createBuffer: vi.fn(() => ({
    getMappedRange: vi.fn(() => new ArrayBuffer(1024)),
    unmap: vi.fn(),
    destroy: vi.fn(),
  })),
  createBindGroupLayout: vi.fn(),
  createPipelineLayout: vi.fn(),
  createRenderPipeline: vi.fn(),
  createBindGroup: vi.fn(),
  createSampler: vi.fn(),
  queue: {
    writeBuffer: vi.fn(),
  },
} as unknown as GPUDevice;

const mockCubemap = {
  createView: vi.fn(),
} as unknown as TextureCubeMap;

const mockPassEncoder = {
  setPipeline: vi.fn(),
  setBindGroup: vi.fn(),
  setVertexBuffer: vi.fn(),
  draw: vi.fn(),
} as unknown as GPURenderPassEncoder;

describe('Skybox Pipeline (Native Coordinates)', () => {
  let pipeline: SkyboxPipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new SkyboxPipeline(mockDevice, 'bgra8unorm');
  });

  test('uses CameraState to build matrices', () => {
    const cameraState: CameraState = {
      position: vec3.fromValues(0, 0, 50),
      angles: vec3.fromValues(0, 0, 0),
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000,
    };

    // Should not throw
    pipeline.draw(mockPassEncoder, {
      cameraState,
      scroll: [0, 0],
      cubemap: mockCubemap,
    });

    // Check that writeBuffer was called to update uniforms
    expect(mockDevice.queue.writeBuffer).toHaveBeenCalled();
    const callArgs = (mockDevice.queue.writeBuffer as any).mock.calls[0];
    const uniformData = callArgs[2] as Float32Array;

    // Verify useNative flag (index 18) is set to 1
    expect(uniformData[18]).toBe(1);

    // Verify matrix values are written (not all zeros)
    // We check index 15 which should be 0 for standard perspective
    expect(uniformData[15]).toBe(0);

    // We can't easily assert on viewProjection elements without re-calculating the exact multiplication
    // but we can verify it's not identity (identity[0] would be 1, but P[0] is not 1)
    expect(uniformData[0]).not.toBe(1);
  });

  test('falls back to viewProjection legacy path', () => {
    const viewProjection = mat4.create(); // Identity

    pipeline.draw(mockPassEncoder, {
      viewProjection: viewProjection as Float32Array,
      scroll: [0, 0],
      cubemap: mockCubemap,
    });

    // Check that writeBuffer was called
    expect(mockDevice.queue.writeBuffer).toHaveBeenCalled();
    const callArgs = (mockDevice.queue.writeBuffer as any).mock.calls[0];
    const uniformData = callArgs[2] as Float32Array;

    // Verify useNative flag (index 18) is set to 0
    expect(uniformData[18]).toBe(0);
  });

  test('throws if neither cameraState nor viewProjection provided', () => {
    expect(() => {
      pipeline.draw(mockPassEncoder, {
        scroll: [0, 0],
        cubemap: mockCubemap,
      } as SkyboxRenderOptions);
    }).toThrow('SkyboxPipeline: Either cameraState or viewProjection must be provided');
  });
});
