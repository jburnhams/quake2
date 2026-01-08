import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Camera } from '../../../src/render/camera';
import { BspMap } from '../../../src/assets/bsp';
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

// Mock gathering visible faces to avoid complex BSP logic deps and ensure we hit the loop
vi.mock('../../../src/render/bspTraversal.js', () => {
    return {
        gatherVisibleFaces: vi.fn(() => [{ faceIndex: 0, sortKey: 0 }])
    };
});

// Mock extractFrustumPlanes
vi.mock('../../../src/render/culling.js', () => ({
    extractFrustumPlanes: () => []
}));

describe('BSP Native Coordinate System Integration', () => {
  let renderer: any;
  let camera: Camera;
  let map: BspMap;
  let createWebGPURenderer: any;
  let gatherVisibleFaces: any;

  beforeEach(async () => {
    // Reset modules to ensure mocks are applied correctly before loading the renderer
    vi.resetModules();

    // Import the function and mock after module reset
    const rendererModule = await import('../../../src/render/webgpu/renderer');
    createWebGPURenderer = rendererModule.createWebGPURenderer;

    const bspTraversalModule = await import('../../../src/render/bspTraversal.js');
    gatherVisibleFaces = bspTraversalModule.gatherVisibleFaces;

    renderer = await createWebGPURenderer(mockContext.device.canvas, {
        width: 800,
        height: 600
    });
    camera = new Camera(800, 600);

    // Create a minimal mock map
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
       models: [],
       brushes: [],
       brushsides: [],
       lightmaps: [],
       vis: new Uint8Array(0)
    };
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
    const renderFrameSpy = vi.spyOn(frameRenderer, 'renderFrame');

    // Create a mock surface
    const surface = {
        mins: { x: -100, y: -100, z: -100 },
        maxs: { x: 100, y: 100, z: 100 },
        surfaceFlags: 0,
        vertexCount: 3,
        indexCount: 3,
        texture: 'test_texture',
        vertexData: new Float32Array(24), // 3 vertices * 8 floats per vertex
        indexData: new Uint16Array([0, 1, 2]),
        gpuVertexBuffer: mockContext.device.createBuffer({ size: 100, usage: GPUBufferUsage.VERTEX }),
        gpuIndexBuffer: mockContext.device.createBuffer({ size: 100, usage: GPUBufferUsage.INDEX }),
        // WebGL-specific properties (not needed for WebGPU but required by interface)
        vao: {} as any,
        vertexBuffer: {} as any,
        indexBuffer: {} as any
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
    try {
        renderer.renderFrame({
            camera,
            world: worldState
        });
    } catch (error) {
        console.error('renderFrame threw error:', error);
        throw error;
    }

    // Debug: Check if frameRenderer.renderFrame was called
    expect(renderFrameSpy).toHaveBeenCalled();

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
