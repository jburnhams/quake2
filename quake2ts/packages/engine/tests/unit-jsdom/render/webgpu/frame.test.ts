import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrameRenderer, WebGPUContextState } from '../../../../src/render/webgpu/frame.js';
import { SpriteRenderer } from '../../../../src/render/webgpu/pipelines/sprite.js';
import { Camera } from '../../../../src/render/camera.js';
import { mat4 } from 'gl-matrix';

// Mock WebGPU globals if not present
if (typeof GPUTextureUsage === 'undefined') {
  (global as any).GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
}
if (typeof GPUBufferUsage === 'undefined') {
    (global as any).GPUBufferUsage = {
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
    };
  }

// Mock everything
const mockDevice = {
  createCommandEncoder: vi.fn(() => ({
    beginRenderPass: vi.fn(() => ({
      end: vi.fn(),
      setBindGroup: vi.fn(),
      setPipeline: vi.fn(),
      setVertexBuffer: vi.fn(),
      setIndexBuffer: vi.fn(),
      drawIndexed: vi.fn(),
    })),
    finish: vi.fn(),
  })),
  createTexture: vi.fn(() => ({
    createView: vi.fn(() => ({})),
    destroy: vi.fn(),
  })),
  queue: {
    submit: vi.fn(),
  },
} as unknown as GPUDevice;

const mockContext = {
  getCurrentTexture: vi.fn(() => ({
    createView: vi.fn(() => ({})),
  })),
} as unknown as GPUCanvasContext;

const mockSpriteRenderer = {
  setProjection: vi.fn(),
  begin: vi.fn(),
  drawSolidRect: vi.fn(),
  end: vi.fn(),
} as unknown as SpriteRenderer;

describe('FrameRenderer', () => {
  let frameRenderer: FrameRenderer;
  let contextState: WebGPUContextState;

  beforeEach(() => {
    contextState = {
      device: mockDevice,
      format: 'bgra8unorm',
      context: mockContext,
      width: 800,
      height: 600,
    };
    frameRenderer = new FrameRenderer(contextState, { sprite: mockSpriteRenderer });
    vi.clearAllMocks();
  });

  it('initializes correctly', () => {
    expect(frameRenderer).toBeDefined();
  });

  it('renders a basic frame', () => {
    const camera = new Camera(mat4.create());
    const stats = frameRenderer.renderFrame({
      camera,
      timeSeconds: 0,
      clearColor: [0.1, 0.1, 0.1, 1],
    });

    // Check command encoding flow
    expect(mockDevice.createCommandEncoder).toHaveBeenCalled();
    // Depth texture creation
    expect(mockDevice.createTexture).toHaveBeenCalledWith(expect.objectContaining({
      format: 'depth24plus',
      size: [800, 600]
    }));

    // Main pass (clearing)
    const encoder = (mockDevice.createCommandEncoder as any).mock.results[0].value;
    expect(encoder.beginRenderPass).toHaveBeenCalledWith(expect.objectContaining({
      colorAttachments: [expect.objectContaining({
        loadOp: 'clear',
        clearValue: [0.1, 0.1, 0.1, 1]
      })]
    }));

    // Sprite pass is no longer called directly by FrameRenderer
    // It's now called through begin2DPass/end2DPass which are invoked by the renderer's begin2D/end2D
    // The onDraw2D callback is where user code would call renderer.begin2D()
    expect(mockSpriteRenderer.setProjection).not.toHaveBeenCalled();
    expect(mockSpriteRenderer.begin).not.toHaveBeenCalled();
    expect(mockSpriteRenderer.end).not.toHaveBeenCalled();

    // Submission
    expect(mockDevice.queue.submit).toHaveBeenCalled();

    expect(stats.fps).toBeDefined();
  });

  it('reuses depth texture if dimensions do not change', () => {
    const camera = new Camera(mat4.create());
    frameRenderer.renderFrame({ camera });
    expect(mockDevice.createTexture).toHaveBeenCalledTimes(1);

    frameRenderer.renderFrame({ camera });
    expect(mockDevice.createTexture).toHaveBeenCalledTimes(1);
  });

  it('recreates depth texture if dimensions change', () => {
    const camera = new Camera(mat4.create());
    frameRenderer.renderFrame({ camera });
    expect(mockDevice.createTexture).toHaveBeenCalledTimes(1);

    // Simulate resize
    contextState.width = 1024;
    contextState.height = 768;
    // Note: FrameRenderer references the contextState object, so it sees the change.
    // However, ensureDepthTexture is called inside beginFrame/renderFrame logic using current width/height.

    frameRenderer.renderFrame({ camera });
    expect(mockDevice.createTexture).toHaveBeenCalledTimes(2);
  });
});
