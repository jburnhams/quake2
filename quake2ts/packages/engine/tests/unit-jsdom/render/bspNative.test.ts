import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer';
import { Camera } from '../../../src/render/camera';
import { BspMap, parseBsp } from '../../../src/assets/bsp';
import { buildBspGeometry } from '../../../src/render/bsp';
import { createTextureManager, TextureManager } from '../../../src/render/texture';
import { MaterialManager } from '../../../src/render/materials';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createMockGPUDevice, setupWebGPUMocks } from '@quake2ts/test-utils/src/engine/mocks/webgpu';

// Setup WebGPU globals
setupWebGPUMocks();

// Mock dependencies
// We mock context creation but not the renderer class itself, to test integration
const mockContext = {
  device: createMockGPUDevice(),
  context: {
    getCurrentTexture: () => ({
      createView: () => ({ label: 'mock-render-target' })
    })
  },
  format: 'bgra8unorm',
  width: 800,
  height: 600
} as any;

vi.mock('../../../src/render/webgpu/context', () => ({
  createWebGPUContext: () => Promise.resolve(mockContext)
}));

// Remove mock for bspTraversal to avoid path resolution issues
// We will construct a minimal valid BSP map instead

// Mock extractFrustumPlanes
vi.mock('../../../src/render/culling', () => ({
    extractFrustumPlanes: () => []
}));

describe('BSP Native Coordinate System Integration', () => {
  let renderer: any;
  let camera: Camera;
  let map: BspMap;

  beforeEach(async () => {
    renderer = await createWebGPURenderer(mockContext.device.canvas, {
        width: 800,
        height: 600
    });
    camera = new Camera(800, 600);

    // Create a minimal mock map with valid single leaf
    // so gatherVisibleFaces returns the single face
    map = {
       version: 38,
       entities: '',
       planes: [],
       vertices: [],
       nodes: [],
       texInfo: [],
       faces: [{ styles: [0, 255, 255, 255] } as any],
       leaves: [],
       leaffaces: [],
       leafbrushes: [],
       edges: [],
       surfedges: [],
       // Single model pointing to leaf 0 (index -1)
       models: [{ headNode: -1 } as any],
       // Leaf 0 containing face 0
       leafs: [{
           cluster: 0,
           area: 0,
           numLeafFaces: 1,
           firstLeafFace: 0,
           mins: [-1000, -1000, -1000],
           maxs: [1000, 1000, 1000]
       } as any],
       leafLists: { leafFaces: [[0]] } as any,
       brushes: [],
       brushsides: [],
       lightmaps: [],
       vis: undefined, // Always visible
       areas: [],
       areaPortals: []
    } as any;
  });

  it('BSP geometry renders correctly at diagonal angle (Integration Mock)', async () => {
    // Set up camera at a diagonal
    camera.setPosition(100, 200, 50);
    // Yaw 135 (Diagonal), Pitch 30 (Looking down)
    camera.setRotation(30, 135, 0);

    const frameRenderer = renderer['frameRenderer'];
    const bspPipeline = frameRenderer['pipelines']['bsp'];
    const bindSpy = vi.spyOn(bspPipeline, 'bind');
    const drawSpy = vi.spyOn(bspPipeline, 'draw');

    // Create a mock surface
    const surface = {
        mins: { x: -100, y: -100, z: -100 },
        maxs: { x: 100, y: 100, z: 100 },
        surfaceFlags: 0,
        vertexCount: 3,
        indexCount: 3,
        gpuVertexBuffer: mockContext.device.createBuffer({ size: 100, usage: GPUBufferUsage.VERTEX }),
        gpuIndexBuffer: mockContext.device.createBuffer({ size: 100, usage: GPUBufferUsage.INDEX })
    };

    const worldState = {
        map: map,
        surfaces: [surface],
        lightStyles: [],
        materials: { update: () => {} }
    };

    // Execute renderFrame
    // This will trigger the actual logic in frame.ts
    // We expect it to call bspPipeline.bind with cameraState because USE_NATIVE_COORDINATE_SYSTEM is true
    renderer.renderFrame({
        camera,
        world: worldState
    });

    expect(bindSpy).toHaveBeenCalled();
    const callArgs = bindSpy.mock.calls[0][1];

    // Verify CameraState was passed
    expect(callArgs.cameraState).toBeDefined();
    expect(callArgs.cameraState.position[0]).toBe(100);
    expect(callArgs.cameraState.position[1]).toBe(200);
    expect(callArgs.cameraState.position[2]).toBe(50);
    expect(callArgs.cameraState.angles[0]).toBe(30);
    expect(callArgs.cameraState.angles[1]).toBe(135);

    // Verify matrix building logic works inside bind (by checking if it didn't throw and likely updated buffer)
    // We can't easily check the buffer content in mock, but we can verify execution flow.
    // The previous tests verified matrix math correctness.

    expect(drawSpy).toHaveBeenCalled();
  });
});
