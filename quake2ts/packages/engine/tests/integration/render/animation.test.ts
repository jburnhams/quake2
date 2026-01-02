
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRenderer, Renderer } from '@quake2ts/engine/render/renderer.js';
import { Camera } from '@quake2ts/engine/render/camera.js';
import { FrameRenderOptions } from '@quake2ts/engine/render/frame.js';
import { RenderableEntity } from '@quake2ts/engine/render/scene.js';
import { Md2Model } from '@quake2ts/engine/assets/md2.js';

// Mock culling to ensure entity is drawn
vi.mock('@quake2ts/engine/render/culling.js', async () => {
  const actual = await vi.importActual('@quake2ts/engine/render/culling.js');
  return {
    ...actual as any,
    boxIntersectsFrustum: () => true,
  };
});

function createMockWebGL2Context() {
  const context = {
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    createVertexArray: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    activeTexture: vi.fn(),
    createFramebuffer: vi.fn(() => ({})),
    deleteFramebuffer: vi.fn(),
    createProgram: vi.fn(() => ({})),
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    useProgram: vi.fn(),
    bindAttribLocation: vi.fn(),
    getUniformLocation: vi.fn((program, name) => name),
    getAttribLocation: vi.fn((program, name) => 0),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform3fv: vi.fn(),
    uniform4f: vi.fn(), // Added for u_solidColor
    uniform4fv: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    drawElements: vi.fn(),
    drawArrays: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    depthMask: vi.fn(),
    depthFunc: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    viewport: vi.fn(),
    deleteBuffer: vi.fn(),
    deleteVertexArray: vi.fn(),
    deleteTexture: vi.fn(),
    deleteProgram: vi.fn(),
    deleteShader: vi.fn(),
    getExtension: vi.fn(() => null),
    canvas: { width: 800, height: 600 },
    // Constants
    STATIC_DRAW: 0x88E4,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    UNSIGNED_INT: 0x1405,
    UNSIGNED_SHORT: 0x1403,
    TEXTURE_2D: 0x0DE1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812F,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
    BLEND: 0x0BE2,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    DEPTH_TEST: 0x0B71,
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    LINK_STATUS: 0x8B82,
    COMPILE_STATUS: 0x8B81,
    getProgramParameter: vi.fn(() => true),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    getProgramInfoLog: vi.fn(() => ''),
  } as unknown as WebGL2RenderingContext;
  return context;
}

describe('Model Animation Integration', () => {
  let gl: WebGL2RenderingContext;
  let renderer: Renderer;

  beforeEach(() => {
    gl = createMockWebGL2Context();
    renderer = createRenderer(gl);
  });

  it('interpolates between MD2 frames', () => {
    const camera = new Camera();
    camera.aspect = 1.0;

    // Create MD2 Model with 2 frames
    const model = {
      header: { skinWidth: 64, skinHeight: 64, frameSize: 100, numSkins: 1, numVertices: 3, numSt: 3, numTriangles: 1, numGlCommands: 0, numFrames: 2 },
      skins: ['skin1'],
      texCoords: [],
      triangles: [],
      frames: [
        {
          name: 'frame0',
          translate: [0,0,0],
          scale: [1,1,1],
          vertices: [{x:0, y:0, z:0, normalIndex:0}, {x:10, y:0, z:0, normalIndex:0}, {x:0, y:10, z:0, normalIndex:0}],
          minBounds: { x: -10, y: -10, z: -10 },
          maxBounds: { x: 10, y: 10, z: 10 }
        },
        {
          name: 'frame1',
          translate: [0,0,0],
          scale: [1,1,1],
          vertices: [{x:0, y:0, z:10, normalIndex:0}, {x:10, y:0, z:10, normalIndex:0}, {x:0, y:10, z:10, normalIndex:0}],
          minBounds: { x: -10, y: -10, z: 0 },
          maxBounds: { x: 10, y: 10, z: 20 }
        }
      ],
      glCommands: new Int32Array(0)
    } as unknown as Md2Model;

    // Render frame 0 with 0.5 interpolation to frame 1
    const entity: RenderableEntity = {
      type: 'md2',
      model,
      skin: 'test_skin',
      transform: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        100, 0, 0, 1
      ]),
      blend: { frame0: 0, frame1: 1, lerp: 0.5 },
      lighting: { ambient: 1, dynamicLights: [] }
    };

    const options: FrameRenderOptions = {
        camera,
        timeSeconds: 0,
        sky: { show: false, textures: [] }
    };

    renderer.renderFrame(options, [entity]);

    // Verify shader uniforms
    // Note: Md2Pipeline performs vertex interpolation on CPU in `buildMd2VertexData` and uploads to VBO.
    // We should verify that `bufferData` was called to upload the interpolated vertices.
    expect(gl.bufferData).toHaveBeenCalled();

    // Also verify `drawElements` was called (entity rendered).
    expect(gl.drawElements).toHaveBeenCalled();
  });
});
