import { vi, type Mocked } from 'vitest';
import type { Camera } from '@quake2ts/engine';

export interface MockRenderingContext {
  gl: WebGL2RenderingContext;
  camera: Mocked<Camera>;
  pipelines: {
    md2: any;
    bsp: any;
    // Add other pipelines as needed
  };
}

export function createMockRenderingContext(): MockRenderingContext {
  const gl = {
    getExtension: vi.fn(),
    getParameter: vi.fn(),
    createTexture: vi.fn(),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    createBuffer: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    createVertexArray: vi.fn(),
    bindVertexArray: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    createShader: vi.fn(),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    createProgram: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform3fv: vi.fn(),
    drawArrays: vi.fn(),
    drawElements: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    depthFunc: vi.fn(),
    blendFunc: vi.fn(),
    viewport: vi.fn(),
    cullFace: vi.fn(),
    activeTexture: vi.fn(),
    deleteTexture: vi.fn(),
    deleteBuffer: vi.fn(),
    deleteVertexArray: vi.fn(),
    deleteProgram: vi.fn(),
    deleteShader: vi.fn(),
  } as unknown as WebGL2RenderingContext;

  const camera = {
    update: vi.fn(),
    viewMatrix: new Float32Array(16),
    projectionMatrix: new Float32Array(16),
    viewProjectionMatrix: new Float32Array(16),
    origin: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    // Add missing properties if necessary based on the Camera interface
    initialize: vi.fn(),
    resize: vi.fn(),
    computeMatrices: vi.fn(),
    extractFrustumPlanes: vi.fn(),
    setFov: vi.fn(),
    setPosition: vi.fn(),
    setAngles: vi.fn(),
    frustumPlanes: [],
    fov: 90,
    aspectRatio: 1,
    near: 0.1,
    far: 1000,
    angles: { x: 0, y: 0, z: 0 },
    // Ensure it matches Mocked<Camera>
  } as unknown as Mocked<Camera>;

  const pipelines = {
    md2: {
      render: vi.fn(),
      update: vi.fn(),
    },
    bsp: {
      render: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    gl,
    camera,
    pipelines,
  };
}
