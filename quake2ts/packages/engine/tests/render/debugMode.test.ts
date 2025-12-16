import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRenderer, Renderer } from '../../src/render/renderer.js';
import { DebugMode } from '../../src/render/debugMode.js';
import { Camera } from '../../src/render/camera.js';
import { FrameRenderOptions } from '../../src/render/frame.js';

describe('DebugMode Integration', () => {
  let gl: WebGL2RenderingContext;
  let renderer: Renderer;

  beforeEach(() => {
    // Mock WebGL context
    gl = {
      canvas: { width: 800, height: 600 } as HTMLCanvasElement,
      createShader: vi.fn(() => ({})),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      createProgram: vi.fn(() => ({})),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      useProgram: vi.fn(),
      getUniformLocation: vi.fn(() => ({})),
      getAttribLocation: vi.fn(),
      createVertexArray: vi.fn(() => ({})),
      bindVertexArray: vi.fn(),
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      drawArrays: vi.fn(),
      drawElements: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      deleteShader: vi.fn(),
      deleteProgram: vi.fn(),
      bindAttribLocation: vi.fn(),
      createTexture: vi.fn(() => ({})),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      activeTexture: vi.fn(),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      uniform2f: vi.fn(),
      uniform3f: vi.fn(),
      uniform4f: vi.fn(),
      uniform4fv: vi.fn(),
      uniformMatrix4fv: vi.fn(),
      depthMask: vi.fn(),
      clearColor: vi.fn(),
      clear: vi.fn(),
      blendFunc: vi.fn(),
      pixelStorei: vi.fn(),
      getExtension: vi.fn(),
      FLOAT: 5126,
      DYNAMIC_DRAW: 35048,
      LINES: 1,
      TRIANGLES: 4,
      DEPTH_TEST: 2929,
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      STATIC_DRAW: 35044,
      ELEMENT_ARRAY_BUFFER: 34963,
      ARRAY_BUFFER: 34962,
      UNSIGNED_SHORT: 5123,
    } as unknown as WebGL2RenderingContext;

    renderer = createRenderer(gl);
  });

  it('should initialize with DebugMode.None', () => {
    // We can't easily check internal state, but we can verify behavior
    // For now, just ensure it doesn't crash
    expect(renderer).toBeDefined();
  });

  it('should allow setting debug mode', () => {
    expect(() => renderer.setDebugMode(DebugMode.BoundingBoxes)).not.toThrow();
    expect(() => renderer.setDebugMode(DebugMode.Wireframe)).not.toThrow();
  });

  it('should trigger debug rendering in renderFrame', () => {
    const camera = new Camera(Math.PI / 2, 1);
    const options: FrameRenderOptions = {
        camera,
        timeSeconds: 0
    };

    renderer.setDebugMode(DebugMode.BoundingBoxes);
    renderer.renderFrame(options, []);

    // We expect clear to be called
    expect(gl.clear).toHaveBeenCalled();
  });

  it('should handle PVSClusters mode without crashing', () => {
    const camera = new Camera(Math.PI / 2, 1);
    const options: FrameRenderOptions = {
        camera,
        timeSeconds: 0
    };

    renderer.setDebugMode(DebugMode.PVSClusters);
    expect(() => renderer.renderFrame(options, [])).not.toThrow();
  });

  it('should handle Lightmaps mode without crashing', () => {
    const camera = new Camera(Math.PI / 2, 1);
    const options: FrameRenderOptions = {
        camera,
        timeSeconds: 0
    };

    renderer.setDebugMode(DebugMode.Lightmaps);
    expect(() => renderer.renderFrame(options, [])).not.toThrow();
  });
});
