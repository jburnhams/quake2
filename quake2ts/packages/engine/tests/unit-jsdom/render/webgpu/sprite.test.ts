import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpriteRenderer } from '../../../../src/render/webgpu/pipelines/sprite';
import { setupWebGPUMocks } from '@quake2ts/test-utils/src/engine/mocks/webgpu';
import { Texture2D } from '../../../../src/render/webgpu/resources';

describe('SpriteRenderer', () => {
  let mockDevice: GPUDevice;

  beforeEach(() => {
    const { mockDevice: device } = setupWebGPUMocks();
    mockDevice = device;
  });

  it('initializes correctly', () => {
    const renderer = new SpriteRenderer(mockDevice, 'rgba8unorm');
    expect(renderer).toBeDefined();
    expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(2); // Solid + Textured
    expect(mockDevice.createBuffer).toHaveBeenCalledTimes(3); // Vertex, Index, Uniform
  });

  it('sets projection matrix', () => {
    const renderer = new SpriteRenderer(mockDevice, 'rgba8unorm');
    renderer.setProjection(800, 600);
    // Should write to uniform buffer
    expect(mockDevice.queue.writeBuffer).toHaveBeenCalled();
  });

  it('batches solid rectangles', () => {
    const renderer = new SpriteRenderer(mockDevice, 'rgba8unorm');
    const mockEncoder = mockDevice.createCommandEncoder();
    const mockTexture = mockDevice.createTexture({
      size: [800, 600, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const mockView = mockTexture.createView();

    renderer.begin(mockEncoder, mockView);
    renderer.drawSolidRect(0, 0, 100, 100, [1, 0, 0, 1]);
    renderer.drawSolidRect(100, 0, 100, 100, [0, 1, 0, 1]);
    renderer.end();

    // Should have written vertices
    expect(mockDevice.queue.writeBuffer).toHaveBeenCalled();
    // Should have started render pass
    expect(mockEncoder.beginRenderPass).toHaveBeenCalled();
  });

  it('batches textured quads', () => {
    const renderer = new SpriteRenderer(mockDevice, 'rgba8unorm');
    const mockEncoder = mockDevice.createCommandEncoder();
    const mockView = ({} as any);

    // Create dummy texture
    const texture = new Texture2D(mockDevice, { width: 32, height: 32, format: 'rgba8unorm' });

    renderer.begin(mockEncoder, mockView);
    renderer.drawTexturedQuad(0, 0, 32, 32, texture);
    renderer.end();

    expect(mockEncoder.beginRenderPass).toHaveBeenCalled();
  });
});
