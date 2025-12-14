import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebugRenderer } from '../../src/render/debug.js';
import { Vec3 } from '@quake2ts/shared';

describe('DebugRenderer', () => {
  let gl: WebGL2RenderingContext;
  let renderer: DebugRenderer;

  beforeEach(() => {
    // Mock WebGL context
    gl = {
      createShader: vi.fn(() => ({})), // Mock shader object
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      createProgram: vi.fn(() => ({})), // Mock program object
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      useProgram: vi.fn(),
      getUniformLocation: vi.fn(),
      getAttribLocation: vi.fn(),
      createVertexArray: vi.fn(() => ({})), // Mock VAO
      bindVertexArray: vi.fn(),
      createBuffer: vi.fn(() => ({})), // Mock Buffer
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      drawArrays: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      deleteShader: vi.fn(),
      deleteProgram: vi.fn(),
      FLOAT: 5126,
      DYNAMIC_DRAW: 35048,
      LINES: 1,
      TRIANGLES: 4,
      DEPTH_TEST: 2929,
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
    } as unknown as WebGL2RenderingContext;

    renderer = new DebugRenderer(gl);
  });

  it('should initialize correctly', () => {
    expect(renderer).toBeDefined();
  });

  it('should have method addCone', () => {
      // @ts-ignore
    expect(renderer.addCone).toBeDefined();
  });

  it('should have method addTorus', () => {
      // @ts-ignore
    expect(renderer.addTorus).toBeDefined();
  });
});
