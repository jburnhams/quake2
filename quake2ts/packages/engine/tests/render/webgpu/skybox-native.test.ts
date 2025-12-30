import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkyboxPipeline } from '../../../src/render/webgpu/pipelines/skybox.js';
import { TextureCubeMap } from '../../../src/render/webgpu/resources.js';
import { CameraState } from '../../../src/render/types/camera.js';
import { mat4 } from 'gl-matrix';
import { WebGPUMatrixBuilder } from '../../../src/render/matrix/webgpu.js';

// --- Mocks ---

// Mock WebGPUMatrixBuilder
vi.mock('../../../src/render/matrix/webgpu.js', () => {
    const MockBuilder = vi.fn();
    // @ts-ignore
    MockBuilder.prototype.buildViewMatrix = vi.fn();
    // @ts-ignore
    MockBuilder.prototype.buildProjectionMatrix = vi.fn();
    return {
        WebGPUMatrixBuilder: MockBuilder
    };
});


// --- Global Mocks for WebGPU ---
// Since we are running in a node environment, WebGPU globals like GPUBufferUsage are not defined.
// We need to polyfill them or mock them.

if (typeof GPUBufferUsage === 'undefined') {
  (global as any).GPUBufferUsage = {
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    COPY_DST: 0x0008,
  };
}

if (typeof GPUShaderStage === 'undefined') {
    (global as any).GPUShaderStage = {
      VERTEX: 0x1,
      FRAGMENT: 0x2,
    };
  }

const mockDevice = {
  createShaderModule: vi.fn(),
  createBuffer: vi.fn().mockImplementation((desc) => ({
    getMappedRange: vi.fn(() => new ArrayBuffer(desc.size)),
    unmap: vi.fn(),
    destroy: vi.fn(),
  })),
  createSampler: vi.fn(),
  createBindGroupLayout: vi.fn(),
  createRenderPipeline: vi.fn(),
  createPipelineLayout: vi.fn(),
  createBindGroup: vi.fn(),
  queue: {
    writeBuffer: vi.fn(),
  },
} as unknown as GPUDevice;

const mockPassEncoder = {
  setPipeline: vi.fn(),
  setBindGroup: vi.fn(),
  setVertexBuffer: vi.fn(),
  draw: vi.fn(),
} as unknown as GPURenderPassEncoder;

const mockCubemap = {
  createView: vi.fn(),
} as unknown as TextureCubeMap;

describe('Skybox Pipeline (Native Coordinates)', () => {
  let pipeline: SkyboxPipeline;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock return values
    // @ts-ignore
    WebGPUMatrixBuilder.prototype.buildViewMatrix.mockReturnValue(mat4.create());
    // @ts-ignore
    WebGPUMatrixBuilder.prototype.buildProjectionMatrix.mockReturnValue(mat4.create());

    pipeline = new SkyboxPipeline(mockDevice, 'bgra8unorm');
  });

  it('initializes correctly', () => {
    expect(mockDevice.createShaderModule).toHaveBeenCalled();
    expect(mockDevice.createRenderPipeline).toHaveBeenCalled();
    expect(WebGPUMatrixBuilder).toHaveBeenCalled();
  });

  it('uses CameraState to build matrices and removes translation', () => {
    const cameraState: CameraState = {
      position: [100, 200, 300],
      angles: [0, 90, 0], // Looking left
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000,
    };

    // Setup specific matrix returns to verify translation removal
    const mockView = mat4.create();
    mockView[12] = 100;
    mockView[13] = 200;
    mockView[14] = 300;

    // @ts-ignore
    WebGPUMatrixBuilder.prototype.buildViewMatrix.mockReturnValue(mockView);

    pipeline.draw(mockPassEncoder, {
      cameraState,
      scroll: [0, 0],
      cubemap: mockCubemap,
    });

    // Verify builder methods were called
    // @ts-ignore
    expect(WebGPUMatrixBuilder.prototype.buildViewMatrix).toHaveBeenCalledWith(cameraState);
    // @ts-ignore
    expect(WebGPUMatrixBuilder.prototype.buildProjectionMatrix).toHaveBeenCalledWith(cameraState);

    // Check if writeBuffer was called with correct data size
    expect(mockDevice.queue.writeBuffer).toHaveBeenCalled();
    const writeCall = (mockDevice.queue.writeBuffer as any).mock.calls[0];
    const uniformData = writeCall[2] as Float32Array;

    expect(uniformData.length).toBe(20);

    // Verify useNative flag (index 18) is set to 1
    expect(uniformData[18]).toBe(1);

    // Verify translation was removed from the view matrix used in calculation
    // Since the pipeline modifies the matrix in place (as verified by implementation),
    // we can check if the mockView was modified.
    expect(mockView[12]).toBe(0);
    expect(mockView[13]).toBe(0);
    expect(mockView[14]).toBe(0);
  });

  it('supports legacy viewProjection for backward compatibility', () => {
    const viewProjection = new Float32Array(16);
    viewProjection[0] = 1;

    pipeline.draw(mockPassEncoder, {
      viewProjection,
      scroll: [0, 0],
      cubemap: mockCubemap,
    });

    const writeCall = (mockDevice.queue.writeBuffer as any).mock.calls[0];
    const uniformData = writeCall[2] as Float32Array;

    // Verify useNative flag (index 18) is set to 0
    expect(uniformData[18]).toBe(0);
    // Verify matrix matches input
    expect(uniformData[0]).toBe(1);
  });

  it('throws if neither cameraState nor viewProjection is provided', () => {
    expect(() => {
      pipeline.draw(mockPassEncoder, {
        scroll: [0, 0],
        cubemap: mockCubemap,
      } as any);
    }).toThrow('SkyboxPipeline: Either cameraState or viewProjection must be provided');
  });
});
