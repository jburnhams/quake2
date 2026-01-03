import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupWebGPUMocks } from '@quake2ts/test-utils/src/engine/mocks/webgpu';

// Setup mocks BEFORE importing code that uses them
const { mockDevice, mockGpu } = setupWebGPUMocks();

// Now import the code under test
import { BspSurfacePipeline, BspSurfaceBindOptions } from '../../../src/render/webgpu/pipelines/bspPipeline.js';
import { DLight } from '../../../src/render/dlight.js';
import { CameraState } from '../../../src/render/types/camera.js';

describe('WebGPU BspSurfacePipeline', () => {
  let pipeline: BspSurfacePipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    // We use the mocked device from setupWebGPUMocks which already has the queue mocked
    pipeline = new BspSurfacePipeline(mockDevice, 'rgba8unorm', 'depth24plus');
  });

  it('should build matrices from CameraState and update uniforms', () => {
    const cameraState: CameraState = {
      position: [100, 200, 50],
      angles: [0, 90, 0], // pitch, yaw, roll
      fov: 90,
      aspect: 1.33,
      near: 4,
      far: 4096,
    };

    const options: BspSurfaceBindOptions = {
      cameraState,
      dlights: [],
    };

    const mockPassEncoder = mockDevice.createCommandEncoder().beginRenderPass({} as any);

    pipeline.bind(mockPassEncoder, options);

    // Verify matrix generation happened (implicitly by checking buffer write)
    expect(mockDevice.queue.writeBuffer).toHaveBeenCalled();

    // Check first write (Frame Uniforms)
    const calls = (mockDevice.queue.writeBuffer as any).mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const frameData = calls[0][2] as Float32Array;
    expect(frameData).toBeInstanceOf(Float32Array);

    // Check Camera Position at offset 16
    expect(frameData[16]).toBeCloseTo(100);
    expect(frameData[17]).toBeCloseTo(200);
    expect(frameData[18]).toBeCloseTo(50);
  });

  it('should bind dlights correctly to uniform buffer', () => {
    const cameraState: CameraState = {
      position: [0, 0, 0],
      angles: [0, 0, 0],
      fov: 90,
      aspect: 1,
      near: 4,
      far: 4096,
    };

    const dlights: DLight[] = [
      {
        origin: { x: 10, y: 20, z: 30 },
        color: { x: 1, y: 0.5, z: 0 },
        intensity: 200,
        die: 0
      },
      {
        origin: { x: -10, y: -20, z: -30 },
        color: { x: 0, y: 0, z: 1 },
        intensity: 100,
        die: 0
      }
    ];

    const options: BspSurfaceBindOptions = {
      cameraState,
      dlights: dlights
    };

    const mockPassEncoder = mockDevice.createCommandEncoder().beginRenderPass({} as any);

    pipeline.bind(mockPassEncoder, options);

    // Get the frame uniform data written
    const calls = (mockDevice.queue.writeBuffer as any).mock.calls;
    const frameData = calls[0][2] as Float32Array;

    // numDlights is at 24 * 4 bytes = index 24 (Uint32 view)
    // Re-interpreting to check integer values:
    const uintView = new Uint32Array(frameData.buffer);
    expect(uintView[24]).toBe(2);

    // Light 0 (Offset 32)
    let offset = 32;
    expect(frameData[offset + 0]).toBe(10); // x
    expect(frameData[offset + 1]).toBe(20); // y
    expect(frameData[offset + 2]).toBe(30); // z
    expect(frameData[offset + 3]).toBe(200); // intensity
    expect(frameData[offset + 4]).toBe(1); // r
    expect(frameData[offset + 5]).toBe(0.5); // g
    expect(frameData[offset + 6]).toBe(0); // b

    // Light 1 (Offset 40)
    offset = 40;
    expect(frameData[offset + 0]).toBe(-10);
    expect(frameData[offset + 1]).toBe(-20);
    expect(frameData[offset + 2]).toBe(-30);
    expect(frameData[offset + 3]).toBe(100);
    expect(frameData[offset + 4]).toBe(0);
    expect(frameData[offset + 5]).toBe(0);
    expect(frameData[offset + 6]).toBe(1);
  });
});
