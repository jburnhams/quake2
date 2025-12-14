
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRenderer, Renderer } from '../../src/render/renderer.js';
import { BspMap } from '../../src/assets/bsp.js';
import { Camera } from '../../src/render/camera.js';
import { FrameRenderOptions } from '../../src/render/frame.js';
import { createBspSurfaces } from '../../src/render/bsp/surface.js';
import { buildBspGeometry } from '../../src/render/bsp/geometry.js';

// Mock WebGL2 Context
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
    uniform4f: vi.fn(),
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

describe('Lightmap Styles Integration', () => {
  let gl: WebGL2RenderingContext;
  let renderer: Renderer;
  let bsp: BspMap;

  beforeEach(() => {
    gl = createMockWebGL2Context();
    renderer = createRenderer(gl);

    // Minimal BSP
    bsp = {
      header: { version: 38, lumps: new Map() },
      entities: { raw: '', entities: [], worldspawn: undefined },
      planes: [{ normal: [0, 0, 1], dist: 0, type: 0 }],
      vertices: [[0,0,0], [10,0,0], [10,10,0], [0,10,0]],
      nodes: [{ planeIndex: 0, children: [-1, -1], mins: [-10, -10, -10], maxs: [20, 20, 20], firstFace: 0, numFaces: 1 }],
      texInfo: [{ s: [1,0,0], sOffset: 0, t: [0,1,0], tOffset: 0, flags: 0, value: 0, texture: 'w', nextTexInfo: -1 }],
      faces: [{
        planeIndex: 0, side: 0, firstEdge: 0, numEdges: 4, texInfo: 0,
        styles: [0, 1, 255, 255], // Styles 0 and 1 active
        lightOffset: 0
      }],
      lightMaps: new Uint8Array(100),
      lightMapInfo: [{ offset: 0, length: 100 }],
      leafs: [{ contents: 0, cluster: -1, area: 0, mins: [-1000,-1000,-1000], maxs: [1000,1000,1000], firstLeafFace: 0, numLeafFaces: 1, firstLeafBrush: 0, numLeafBrushes: 0 }],
      leafLists: { leafFaces: [[0]], leafBrushes: [] },
      edges: [{vertices:[0,1]}, {vertices:[1,2]}, {vertices:[2,3]}, {vertices:[3,0]}],
      surfEdges: new Int32Array([0,1,2,3]),
      models: [],
      brushes: [],
      brushSides: [],
      visibility: undefined,
    } as unknown as BspMap;
  });

  it('updates light style uniforms based on time', () => {
    const surfaces = createBspSurfaces(bsp);
    const geometry = buildBspGeometry(gl, surfaces);
    // Populate geometry cache manually as `buildBspGeometry` doesn't return surfaces for FrameRenderer
    // Wait, integration test workaround:
    const mockSurfaceGeometry = {
      texture: 'w',
      surfaceFlags: 0,
      vertexCount: 4,
      indexCount: 6,
      vao: geometry.vao,
      indexBuffer: geometry.ibo,
      lightmap: { atlasIndex: 0, texture: undefined } // Needs a lightmap to trigger lightmap code path
    };

    const camera = new Camera();
    camera.aspect = 1.0;
    // Position camera to face the geometry
    camera.position = [-50, 5, 5];
    camera.angles = [0, 0, 0];
    const _ = camera.viewMatrix;

    // Setup styles: Style 0 is always 1.0. Style 1 varies.
    // We pass lightStyles array.
    const lightStyles = new Float32Array(256);
    lightStyles[0] = 1.0;
    lightStyles[1] = 0.5;

    const options: FrameRenderOptions = {
      camera,
      timeSeconds: 1.0,
      world: {
        map: bsp,
        geometry,
        textures: new Map(),
        surfaces: [mockSurfaceGeometry], // Mocked surfaces
        lightStyles: lightStyles as unknown as number[] // Type cast for simplicity
      },
      sky: { show: false, textures: [] }
    };

    renderer.renderFrame(options, []);

    // Check uniform4fv call for 'u_lightStyleFactors'
    // Expected factors: [1.0, 0.5, 0, 0]
    // styles indices are [0, 1, 255, 255]. 255 -> 0.
    const expectedStyles = new Float32Array([1.0, 0.5, 0, 0]);

    expect(gl.uniform4fv).toHaveBeenCalledWith('u_lightStyleFactors', expectedStyles);
  });
});
