import { describe, test, expect, vi } from 'vitest';
import { SkyboxPipeline } from '../../../src/render/webgpu/pipelines/skybox.js';
import { CameraState } from '../../../src/render/types/camera.js';
import { CoordinateSystem } from '../../../src/render/types/coordinates.js';
import { WebGPUMatrixBuilder } from '../../../src/render/matrix/webgpu.js';
import { mat4, vec3 } from 'gl-matrix';
import { TextureCubeMap } from '../../../src/render/webgpu/resources.js';

// Define GPUBufferUsage mock if not available (headless environment)
if (typeof GPUBufferUsage === 'undefined') {
  global.GPUBufferUsage = {
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
  } as any;
}
if (typeof GPUShaderStage === 'undefined') {
  global.GPUShaderStage = {
    VERTEX: 0x1,
    FRAGMENT: 0x2,
    COMPUTE: 0x4,
  } as any;
}


// Mock WebGPU device and objects
const createMockDevice = () => {
  return {
    createShaderModule: vi.fn(),
    createBuffer: vi.fn().mockReturnValue({
      getMappedRange: vi.fn().mockReturnValue(new Float32Array(100)),
      unmap: vi.fn(),
      destroy: vi.fn(),
    }),
    createSampler: vi.fn(),
    createBindGroupLayout: vi.fn(),
    createPipelineLayout: vi.fn(),
    createRenderPipeline: vi.fn(),
    createBindGroup: vi.fn(),
    queue: {
      writeBuffer: vi.fn(),
    },
  } as unknown as GPUDevice;
};

const createMockCubemap = () => {
    return {
        createView: vi.fn()
    } as unknown as TextureCubeMap;
};

const createMockPassEncoder = () => {
    return {
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        setVertexBuffer: vi.fn(),
        draw: vi.fn(),
    } as unknown as GPURenderPassEncoder;
};

describe('Skybox Pipeline (Native Coordinates)', () => {
  test('uses CameraState to build matrices', () => {
    const device = createMockDevice();
    const pipeline = new SkyboxPipeline(device, 'bgra8unorm');

    const cameraState: CameraState = {
      position: vec3.fromValues(0, 0, 50),
      angles: vec3.fromValues(0, 0, 0),
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 1000
    };

    const passEncoder = createMockPassEncoder();
    const cubemap = createMockCubemap();

    // Should not throw
    pipeline.draw(passEncoder, {
      cameraState,
      scroll: [0, 0],
      cubemap
    });

    // Verify uniforms updated
    expect(device.queue.writeBuffer).toHaveBeenCalled();
  });

  test('matrices use WebGPU coordinate system', () => {
     // Verify the matrix construction logic via builder
     const builder = new WebGPUMatrixBuilder();
     expect(builder.coordinateSystem).toBe(CoordinateSystem.WEBGPU);

     const cameraState: CameraState = {
      position: vec3.fromValues(0, 0, 0),
      angles: vec3.fromValues(0, 0, 0),
      fov: 90,
      aspect: 1.0,
      near: 0.1,
      far: 100
    };

    const view = builder.buildViewMatrix(cameraState);
    const proj = builder.buildProjectionMatrix(cameraState);

    // WebGPU Projection should have [11] = -1 (standard perspective)
    expect(proj[11]).toBe(-1);
    // [15] should be 0
    expect(proj[15]).toBe(0);

    // View matrix for 0,0,0 angles (Quake +X forward) should look down -Z in WebGPU
    // So rotation part should map +X -> -Z
    // Column 0 of View (from Quake X) should be (0, 0, -1) ?
    // View Matrix transforms World to View.
    // Basis vectors of View Space in World Coords are rows of View Matrix (if orthogonal).
    // Or Columns of Inverse View.

    // Let's check transform of Forward vector (1, 0, 0)
    const forwardQuake = vec3.fromValues(1, 0, 0);
    const forwardView = vec3.transformMat4(vec3.create(), forwardQuake, view);

    // In View Space (WebGPU), Forward is -Z? Or +Z?
    // Standard Right Handed View Space: Camera at Origin looking down -Z.
    // So Forward vector should map to (0, 0, -something).
    // Since it's a direction, w=0.

    // Our builder maps Quake +X to WebGPU -Z.
    expect(forwardView[0]).toBeCloseTo(0);
    expect(forwardView[1]).toBeCloseTo(0);
    expect(forwardView[2]).toBeCloseTo(-1);
  });
});
