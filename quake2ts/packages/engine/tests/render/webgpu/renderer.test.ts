import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebGPURendererImpl } from '../../../src/render/webgpu/renderer.js';
import { FrameRenderer } from '../../../src/render/webgpu/frame.js';
import { WebGPUContextState } from '../../../src/render/webgpu/context.js';
import { SpriteRenderer } from '../../../src/render/webgpu/pipelines/sprite.js';
import { createMockWebGPUContext, setupWebGPUMocks } from '../../../../test-utils/src/engine/mocks/webgpu.js';

// Mock dependencies
vi.mock('../../../src/render/webgpu/frame.js');
vi.mock('../../../src/render/webgpu/pipelines/sprite.js');

describe('WebGPURendererImpl', () => {
  let renderer: WebGPURendererImpl;
  let mockContext: WebGPUContextState;
  let mockFrameRenderer: any;
  let mockSpriteRenderer: any;

  beforeEach(() => {
    setupWebGPUMocks();
    const { device, adapter } = createMockWebGPUContext();

    mockContext = {
      device,
      adapter,
      format: 'bgra8unorm',
      features: new Set(),
      limits: {} as GPUSupportedLimits,
      isHeadless: true,
      width: 800,
      height: 600,
      context: undefined
    };

    mockFrameRenderer = new FrameRenderer(mockContext, {} as any);
    mockSpriteRenderer = new SpriteRenderer(device, 'bgra8unorm');

    renderer = new WebGPURendererImpl(mockContext, mockFrameRenderer, { sprite: mockSpriteRenderer });
  });

  it('should initialize correctly', () => {
    expect(renderer).toBeDefined();
    expect(renderer.width).toBe(800);
    expect(renderer.height).toBe(600);
  });

  it('should delegate renderFrame to FrameRenderer', () => {
    const options: any = { camera: {} };
    renderer.renderFrame(options, []);
    expect(mockFrameRenderer.renderFrame).toHaveBeenCalledWith(options, [], expect.anything());
  });

  it('should handle begin2D/end2D lifecycle', () => {
    renderer.begin2D();

    expect(mockContext.device.createCommandEncoder).toHaveBeenCalled();
    expect(mockSpriteRenderer.setProjection).toHaveBeenCalledWith(800, 600);
    expect(mockSpriteRenderer.begin).toHaveBeenCalled();

    renderer.end2D();

    expect(mockSpriteRenderer.end).toHaveBeenCalled();
    expect(mockContext.device.queue.submit).toHaveBeenCalled();
  });

  it('should delegate drawing calls to SpriteRenderer', () => {
    const mockPic = { width: 100, height: 100, bind: vi.fn() } as any;

    renderer.drawPic(10, 20, mockPic);
    expect(mockSpriteRenderer.drawTexturedQuad).toHaveBeenCalledWith(10, 20, 100, 100, mockPic, 0, 0, 1, 1, undefined);

    renderer.drawfillRect(5, 5, 50, 50, [1, 0, 0, 1]);
    expect(mockSpriteRenderer.drawSolidRect).toHaveBeenCalledWith(5, 5, 50, 50, [1, 0, 0, 1]);
  });

  it('should resize context', () => {
    renderer.resize(1024, 768);
    expect(renderer.width).toBe(1024);
    expect(renderer.height).toBe(768);
  });
});
