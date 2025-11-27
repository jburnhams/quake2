import { describe, it, expect, vi } from 'vitest';
import { buildBspGeometry, BspSurfaceInput } from '../../../src/render/bsp.js';
import { BspMap } from '../../../src/assets/bsp.js';

// Mock WebGL context
const gl = {
  createVertexArray: vi.fn(() => ({})),
  createBuffer: vi.fn(() => ({})),
  bindVertexArray: vi.fn(),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  vertexAttribPointer: vi.fn(),
  enableVertexAttribArray: vi.fn(),
  createTexture: vi.fn(() => ({})),
  bindTexture: vi.fn(),
  texParameteri: vi.fn(),
  texImage2D: vi.fn(),
  STATIC_DRAW: 0x88e4,
  FLOAT: 0x1406,
  LINEAR: 0x2601,
  CLAMP_TO_EDGE: 0x812f
} as unknown as WebGL2RenderingContext;

describe('buildBspGeometry', () => {
  it('should include all surfaces by default', () => {
     const createSurf = (faceIndex: number, vertexCount: number, texture: string): BspSurfaceInput => ({
       faceIndex,
       texture,
       surfaceFlags: 0,
       vertices: new Float32Array(vertexCount * 3), // Just positions? No, bsp.ts buildVertexData expects interleaved?
       // Wait, bsp.ts BspSurfaceInput has `vertices`, `textureCoords`, etc. separate.
       // buildVertexData interleaves them.
       // I need to provide separate arrays.
       textureCoords: new Float32Array(vertexCount * 2),
       indices: new Uint16Array([0, 1, 2]),
     });

    const surfaces: BspSurfaceInput[] = [
      createSurf(0, 3, 'tex1'),
      createSurf(1, 3, 'tex2')
    ];

    const result = buildBspGeometry(gl, surfaces);
    // result.surfaces is array of BspSurfaceGeometry
    expect(result.surfaces.length).toBe(2);
  });

  it('should filter surfaces based on hidden classnames', () => {
    // Mock map
    // Model 0: World
    // Model 1: func_hide_me (face 1)
    // Model 2: func_show_me (face 2, 3)
    const map = {
      entities: {
        entities: [
          { classname: 'worldspawn', properties: {} },
          { classname: 'func_hide_me', properties: { model: '*1' } },
          { classname: 'func_show_me', properties: { model: '*2' } }
        ]
      },
      models: [
        { firstFace: 0, numFaces: 1 }, // *0 (world)
        { firstFace: 1, numFaces: 1 }, // *1 (func_hide_me)
        { firstFace: 2, numFaces: 2 }  // *2 (func_show_me)
      ]
    } as unknown as BspMap;

     const createSurf = (faceIndex: number, vertexCount: number, texture: string): BspSurfaceInput => ({
       faceIndex,
       texture,
       surfaceFlags: 0,
       vertices: new Float32Array(vertexCount * 3),
       textureCoords: new Float32Array(vertexCount * 2),
       indices: new Uint16Array([0, 1, 2]),
     });

    const surfaces: BspSurfaceInput[] = [
      createSurf(0, 3, 'tex1'), // World
      createSurf(1, 3, 'tex2'), // Hidden
      createSurf(2, 3, 'tex3'), // Visible
      createSurf(3, 3, 'tex3')  // Visible
    ];

    const result = buildBspGeometry(gl, surfaces, map, {
      hiddenClassnames: new Set(['func_hide_me'])
    });

    // Expecting 3 surfaces to remain (0, 2, 3)
    expect(result.surfaces.length).toBe(3);

    expect(result.surfaces[0].texture).toBe('tex1');
    expect(result.surfaces[1].texture).toBe('tex3');
    expect(result.surfaces[2].texture).toBe('tex3');
  });
});
