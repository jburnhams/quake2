import { describe, it, expect, vi } from 'vitest';
import { buildBspGeometry, BspSurfaceInput } from '../../../src/render/bsp/geometry.js';
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
     const createSurf = (faceIndex: number, vertexCount: number, textureName: string): BspSurfaceInput => ({
       faceIndex,
       textureName,
       flags: 0,
       vertices: new Float32Array(vertexCount * 7),
       vertexCount,
       styles: [0,0,0,0]
     });

    const surfaces: BspSurfaceInput[] = [
      createSurf(0, 3, 'tex1'),
      createSurf(1, 3, 'tex2')
    ];

    const result = buildBspGeometry(gl, surfaces);
    // 2 batches assuming sorting by texture
    expect(result.batches.length).toBe(2);
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

     const createSurf = (faceIndex: number, vertexCount: number, textureName: string): BspSurfaceInput => ({
       faceIndex,
       textureName,
       flags: 0,
       vertices: new Float32Array(vertexCount * 7),
       vertexCount,
       styles: [0,0,0,0]
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

    // Should contain World (face 0) and func_show_me (face 2, 3)
    // func_hide_me (face 1) should be filtered out.
    // Total indices: 3 + 3 + 3 = 9.

    expect(result.indexCount).toBe(9);
    // Batch count depends on texture sorting.
    // tex1 (1), tex2 (hidden), tex3 (2).
    // tex1 (count 3), tex3 (count 6).
    expect(result.batches.length).toBe(2);
    expect(result.batches[0].textureName).toBe('tex1');
    expect(result.batches[1].textureName).toBe('tex3');
  });
});
