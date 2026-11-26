import { vi } from 'vitest';
import { createMockWebGL2Context, MockWebGL2RenderingContext } from './mocks/webgl.js';

// Define minimal mock interfaces for internal engine components not publicly exported.
interface MockPipeline {
  render: ReturnType<typeof vi.fn>;
  init: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
}

interface MockCamera {
  update: ReturnType<typeof vi.fn>;
  getViewMatrix: ReturnType<typeof vi.fn>;
  getProjectionMatrix: ReturnType<typeof vi.fn>;
  getViewProjectionMatrix: ReturnType<typeof vi.fn>;
  getPosition: ReturnType<typeof vi.fn>;
  getForward: ReturnType<typeof vi.fn>;
  getRight: ReturnType<typeof vi.fn>;
  getUp: ReturnType<typeof vi.fn>;
  extractFrustumPlanes: ReturnType<typeof vi.fn>;
  transform: {
    origin: number[];
    angles: number[];
    fov: number;
  };
}

export interface MockRenderingContext {
  gl: MockWebGL2RenderingContext;
  camera: MockCamera;
  pipelines: {
    md2: MockPipeline;
    bsp: MockPipeline;
    sprite: MockPipeline;
    poly: MockPipeline;
    particle: MockPipeline;
  };
}

export function createMockRenderingContext(): MockRenderingContext {
  const gl = createMockWebGL2Context();

  // Mock Camera
  const camera: MockCamera = {
    update: vi.fn(),
    getViewMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
    getProjectionMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
    getViewProjectionMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
    getPosition: vi.fn().mockReturnValue([0, 0, 0]),
    getForward: vi.fn().mockReturnValue([0, 0, -1]),
    getRight: vi.fn().mockReturnValue([1, 0, 0]),
    getUp: vi.fn().mockReturnValue([0, 1, 0]),
    extractFrustumPlanes: vi.fn(),
    transform: {
      origin: [0, 0, 0],
      angles: [0, 0, 0],
      fov: 90
    }
  };

  // Mock Pipelines
  const md2: MockPipeline = {
    render: vi.fn(),
    init: vi.fn(),
    resize: vi.fn(),
  };

  const bsp: MockPipeline = {
    render: vi.fn(),
    init: vi.fn(),
    resize: vi.fn(),
  };

  const sprite: MockPipeline = {
    render: vi.fn(),
    init: vi.fn(),
    resize: vi.fn(),
  };

  const poly: MockPipeline = {
    render: vi.fn(),
    init: vi.fn(),
    resize: vi.fn(),
  };

  const particle: MockPipeline = {
    render: vi.fn(),
    init: vi.fn(),
    resize: vi.fn(),
  };

  return {
    gl,
    camera,
    pipelines: {
      md2,
      bsp,
      sprite,
      poly,
      particle
    }
  };
}
