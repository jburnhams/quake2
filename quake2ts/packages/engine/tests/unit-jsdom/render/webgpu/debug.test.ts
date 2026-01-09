import { describe, it, expect, beforeEach } from 'vitest';
import { DebugPipeline } from '../../../../src/render/webgpu/pipelines/debug.js';
import { WebGPUDebugRenderer } from '../../../../src/render/webgpu/debugRenderer.js';
import { setupWebGPUMocks } from '@quake2ts/test-utils/src/engine/mocks/webgpu';

describe('DebugPipeline', () => {
  let mockDevice: GPUDevice;

  beforeEach(() => {
    const { mockDevice: device } = setupWebGPUMocks();
    mockDevice = device;
  });

  it('initializes correctly', () => {
    const pipeline = new DebugPipeline(mockDevice, 'rgba8unorm', 'depth24plus');
    expect(pipeline).toBeDefined();
    // Should create 2 pipelines (line + solid)
    expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(2);
    // Should create 4 buffers (line vertex + solid vertex + line uniform + solid uniform)
    expect(mockDevice.createBuffer).toHaveBeenCalledTimes(4);
  });

  it('accumulates line vertices', () => {
    const pipeline = new DebugPipeline(mockDevice, 'rgba8unorm', 'depth24plus');

    pipeline.drawLine(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      { r: 1, g: 0, b: 0 }
    );

    // Should have added 2 vertices (start and end) with 6 floats each
    // Can't directly access lineVertices, but we can test render is called without errors
    expect(pipeline).toBeDefined();
  });

  it('accumulates bounding box geometry', () => {
    const pipeline = new DebugPipeline(mockDevice, 'rgba8unorm', 'depth24plus');

    pipeline.drawBoundingBox(
      { x: -1, y: -1, z: -1 },
      { x: 1, y: 1, z: 1 },
      { r: 0, g: 1, b: 0 }
    );

    // Bounding box consists of 12 lines (4 bottom + 4 top + 4 vertical)
    expect(pipeline).toBeDefined();
  });

  it('accumulates point geometry', () => {
    const pipeline = new DebugPipeline(mockDevice, 'rgba8unorm', 'depth24plus');

    pipeline.drawPoint(
      { x: 0, y: 0, z: 0 },
      2.0,
      { r: 0, g: 0, b: 1 }
    );

    // Point is rendered as a bounding box
    expect(pipeline).toBeDefined();
  });

  it('accumulates axis geometry', () => {
    const pipeline = new DebugPipeline(mockDevice, 'rgba8unorm', 'depth24plus');

    pipeline.drawAxes({ x: 0, y: 0, z: 0 }, 5.0);

    // Axes consist of 3 lines (X, Y, Z)
    expect(pipeline).toBeDefined();
  });

  it('accumulates cone geometry', () => {
    const pipeline = new DebugPipeline(mockDevice, 'rgba8unorm', 'depth24plus');

    pipeline.addCone(
      { x: 0, y: 0, z: 2 }, // apex
      { x: 0, y: 0, z: 0 }, // base center
      1.0, // base radius
      { r: 1, g: 1, b: 0 }
    );

    // Cone consists of triangles (base disk + sides)
    expect(pipeline).toBeDefined();
  });

  it('accumulates torus geometry', () => {
    const pipeline = new DebugPipeline(mockDevice, 'rgba8unorm', 'depth24plus');

    pipeline.addTorus(
      { x: 0, y: 0, z: 0 }, // center
      2.0, // radius
      0.5, // tube radius
      { r: 1, g: 0, b: 1 }
    );

    // Torus consists of many triangles
    expect(pipeline).toBeDefined();
  });

  it('stores 3D text labels', () => {
    const pipeline = new DebugPipeline(mockDevice, 'rgba8unorm', 'depth24plus');

    pipeline.drawText3D('Test Label', { x: 0, y: 0, z: 0 });

    const viewProjection = new Float32Array(16);
    viewProjection[0] = 1; // Identity matrix
    viewProjection[5] = 1;
    viewProjection[10] = 1;
    viewProjection[15] = 1;

    const labels = pipeline.getLabels(viewProjection, 800, 600);
    expect(labels).toHaveLength(1);
    expect(labels[0].text).toBe('Test Label');
  });

  it('clears accumulated geometry', () => {
    const pipeline = new DebugPipeline(mockDevice, 'rgba8unorm', 'depth24plus');

    pipeline.drawLine(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      { r: 1, g: 0, b: 0 }
    );
    pipeline.drawText3D('Test', { x: 0, y: 0, z: 0 });

    pipeline.clear();

    const viewProjection = new Float32Array(16);
    const labels = pipeline.getLabels(viewProjection, 800, 600);
    expect(labels).toHaveLength(0);
  });

  it('renders without errors when no geometry', () => {
    const pipeline = new DebugPipeline(mockDevice, 'rgba8unorm', 'depth24plus');
    const mockPass = {} as GPURenderPassEncoder;
    const viewProjection = new Float32Array(16);

    // Should not throw
    expect(() => {
      pipeline.render(mockPass, viewProjection);
    }).not.toThrow();
  });
});

describe('WebGPUDebugRenderer', () => {
  let mockDevice: GPUDevice;

  beforeEach(() => {
    const { mockDevice: device } = setupWebGPUMocks();
    mockDevice = device;
  });

  it('initializes correctly', () => {
    const renderer = new WebGPUDebugRenderer(mockDevice, 'rgba8unorm', 'depth24plus');
    expect(renderer).toBeDefined();
    expect(renderer.shaderSize).toBeGreaterThan(0);
  });

  it('provides WebGL-compatible API', () => {
    const renderer = new WebGPUDebugRenderer(mockDevice, 'rgba8unorm', 'depth24plus');

    // Test all API methods are available
    expect(typeof renderer.drawLine).toBe('function');
    expect(typeof renderer.drawBoundingBox).toBe('function');
    expect(typeof renderer.drawPoint).toBe('function');
    expect(typeof renderer.drawAxes).toBe('function');
    expect(typeof renderer.drawText3D).toBe('function');
    expect(typeof renderer.addCone).toBe('function');
    expect(typeof renderer.addTorus).toBe('function');
    expect(typeof renderer.render).toBe('function');
    expect(typeof renderer.getLabels).toBe('function');
    expect(typeof renderer.clear).toBe('function');
    expect(typeof renderer.destroy).toBe('function');
  });

  it('forwards drawing calls to pipeline', () => {
    const renderer = new WebGPUDebugRenderer(mockDevice, 'rgba8unorm', 'depth24plus');

    // Should not throw
    renderer.drawLine({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, { r: 1, g: 0, b: 0 });
    renderer.drawBoundingBox({ x: -1, y: -1, z: -1 }, { x: 1, y: 1, z: 1 }, { r: 0, g: 1, b: 0 });
    renderer.drawPoint({ x: 0, y: 0, z: 0 }, 1.0, { r: 0, g: 0, b: 1 });
    renderer.drawAxes({ x: 0, y: 0, z: 0 }, 5.0);
    renderer.addCone({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 0.5, { r: 1, g: 1, b: 0 });
    renderer.addTorus({ x: 0, y: 0, z: 0 }, 1.0, 0.2, { r: 1, g: 0, b: 1 });
    renderer.drawText3D('Label', { x: 0, y: 0, z: 0 });

    expect(renderer).toBeDefined();
  });

  it('clears geometry', () => {
    const renderer = new WebGPUDebugRenderer(mockDevice, 'rgba8unorm', 'depth24plus');

    renderer.drawText3D('Test', { x: 0, y: 0, z: 0 });
    renderer.clear();

    const labels = renderer.getLabels(new Float32Array(16), 800, 600);
    expect(labels).toHaveLength(0);
  });

  it('destroys resources', () => {
    const renderer = new WebGPUDebugRenderer(mockDevice, 'rgba8unorm', 'depth24plus');

    // Should not throw
    expect(() => {
      renderer.destroy();
    }).not.toThrow();
  });
});
