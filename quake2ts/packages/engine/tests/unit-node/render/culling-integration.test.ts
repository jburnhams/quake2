
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRenderer, Renderer } from '@quake2ts/engine/render/renderer.js';
import { BspMap, BspLeaf, BspNode, BspVisibility } from '@quake2ts/engine/assets/bsp.js';
import { Camera } from '@quake2ts/engine/render/camera.js';
import { FrameRenderOptions } from '@quake2ts/engine/render/frame.js';
import { RenderableEntity } from '@quake2ts/engine/render/scene.js';
import { Md2Model } from '@quake2ts/engine/assets/md2.js';

// Mock WebGL2 Context (Simplified for this test)
function createMockWebGL2Context() {
  const context = {
    // ... basic mocks ...
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

function createPvs(numClusters: number, visibleMap: Record<number, number[]>): BspVisibility {
  const clusters = [];
  const bytesPerCluster = Math.ceil(numClusters / 8);

  for (let i = 0; i < numClusters; i++) {
    const pvs = new Uint8Array(bytesPerCluster);
    const visible = visibleMap[i] || [];
    // Always visible to self
    visible.push(i);

    for (const target of visible) {
      const byteIndex = Math.floor(target / 8);
      const bitIndex = target % 8;
      pvs[byteIndex] |= (1 << bitIndex);
    }
    clusters.push({ pvs, phs: new Uint8Array(0) });
  }

  return { numClusters, clusters };
}

describe('PVS Culling Integration', () => {
  let gl: WebGL2RenderingContext;
  let renderer: Renderer;
  let bsp: BspMap;

  beforeEach(() => {
    gl = createMockWebGL2Context();
    renderer = createRenderer(gl);

    // Create a BSP with 2 clusters (0 and 1)
    // Cluster 0 sees only Cluster 0
    // Cluster 1 sees only Cluster 1
    const visibility = createPvs(2, {
      0: [0],
      1: [1]
    });

    // Mock Leafs
    // Leaf 0: Cluster 0, Mins/Maxs cover origin
    // Leaf 1: Cluster 1, Mins/Maxs cover (1000, 0, 0)
    const leafs: BspLeaf[] = [
      {
        contents: 0, cluster: 0, area: 0,
        mins: [-100, -100, -100], maxs: [100, 100, 100],
        firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0
      },
      {
        contents: 0, cluster: 1, area: 0,
        mins: [900, -100, -100], maxs: [1100, 100, 100],
        firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0
      }
    ];

    const nodes: BspNode[] = [
      {
        planeIndex: 0, // x=500 plane
        children: [-(0 + 1), -(1 + 1)], // Leaf 0, Leaf 1
        mins: [-1000, -1000, -1000], maxs: [2000, 1000, 1000],
        firstFace: 0, numFaces: 0
      }
    ];

    const planes = [
      { normal: [1, 0, 0] as [number, number, number], dist: 500, type: 0 } // x = 500
    ];

    bsp = {
      header: { version: 38, lumps: new Map() },
      entities: { raw: '', entities: [], worldspawn: undefined },
      planes,
      vertices: [],
      nodes,
      texInfo: [],
      faces: [],
      lightMaps: new Uint8Array(0),
      lightMapInfo: [],
      leafs,
      leafLists: { leafFaces: [], leafBrushes: [] },
      edges: [],
      surfEdges: new Int32Array(0),
      models: [{ headNode: 0 }],
      brushes: [],
      brushSides: [],
      visibility,
      areas: [],
      areaPortals: [],
    } as unknown as BspMap;
  });

  it('culls entities in invisible clusters', () => {
    // Camera at (0,0,0) -> Leaf 1 -> Cluster 1
    // Entity at (1000, 0, 0) -> Leaf 0 -> Cluster 0
    // Cluster 1 does not see Cluster 0.
    const camera = new Camera();
    camera.aspect = 1.0;
    camera.position = [0, 0, 0];
    const _ = camera.viewMatrix;

    // Entity at (1000, 0, 0) -> Leaf 1 -> Cluster 1
    // Cluster 0 cannot see Cluster 1 in our mock PVS
    const model = {
      header: {},
      skins: [],
      texCoords: [],
      triangles: [],
      frames: [{
          name: 'frame1',
          translate: [0,0,0],
          scale: [1,1,1],
          vertices: [
            { x: 0, y: 0, z: 0, normalIndex: 0 },
            { x: 10, y: 0, z: 0, normalIndex: 0 },
            { x: 0, y: 10, z: 0, normalIndex: 0 }
          ],
          minBounds: { x: -10, y: -10, z: -10 },
          maxBounds: { x: 10, y: 10, z: 10 }
      }],
      glCommands: new Int32Array(0)
    } as unknown as Md2Model;

    const entity: RenderableEntity = {
      type: 'md2',
      model,
      skin: 'test',
      transform: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        1000, 0, 0, 1 // Position 1000, 0, 0
      ]),
      blend: { frame0: 0, frame1: 0, lerp: 0 },
      lighting: { ambient: 1, dynamicLights: [] }
    };

    const options: FrameRenderOptions = {
        camera,
        timeSeconds: 0,
        world: { map: bsp, surfaces: [], geometry: {} as any, textures: new Map() },
        sky: undefined
    };

    renderer.renderFrame(options, [entity]);

    // Expect drawArrays/drawElements NOT to be called (entity should be culled)
    expect(gl.drawArrays).not.toHaveBeenCalled();
    expect(gl.drawElements).not.toHaveBeenCalled();
  });

  it('renders entities in visible clusters', () => {
    // Camera at (0,0,0) -> Leaf 0 -> Cluster 0
    const camera = new Camera();
    camera.aspect = 1.0;
    camera.position = [0, 0, 0];
    const _ = camera.viewMatrix;

    // Entity at (0, 0, 50) -> Leaf 0 -> Cluster 0
    // Cluster 0 sees Cluster 0
    const model = {
        header: {},
        skins: [],
        texCoords: [],
        triangles: [],
        frames: [
            {
                name: 'frame1',
                translate: [0,0,0],
                scale: [1,1,1],
                vertices: [
                    { position: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
                    { position: { x: 10, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
                    { position: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 }
                ],
                minBounds: { x: -10, y: -10, z: -10 },
                maxBounds: { x: 10, y: 10, z: 10 }
            },
            {
                name: 'frame2',
                translate: [0,0,0],
                scale: [1,1,1],
                vertices: [
                    { x: 0, y: 0, z: 0, normalIndex: 0 },
                    { x: 10, y: 0, z: 0, normalIndex: 0 },
                    { x: 0, y: 10, z: 0, normalIndex: 0 }
                ],
                minBounds: { x: -10, y: -10, z: -10 },
                maxBounds: { x: 10, y: 10, z: 10 }
            }
        ],
        glCommands: new Int32Array(0)
      } as unknown as Md2Model;

      const entity: RenderableEntity = {
        type: 'md2',
        model,
        skin: 'test',
        transform: new Float32Array([
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          50, 0, 0, 1 // Position 50, 0, 0 (Same leaf as camera, in front)
        ]),
        blend: { frame0: 0, frame1: 0, lerp: 0 },
        lighting: { ambient: 1, dynamicLights: [] }
      };

      const options: FrameRenderOptions = {
        camera,
        timeSeconds: 0,
        world: { map: bsp, surfaces: [], geometry: {} as any, textures: new Map() },
        sky: undefined
    };

    renderer.renderFrame(options, [entity]);

    // Expect drawElements TO be called (MD2 uses indexed drawing)
    expect(gl.drawElements).toHaveBeenCalled();
  });
});
