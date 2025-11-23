import { describe, it, expect, vi } from 'vitest';
import { buildBspGeometry, BspSurfaceInput } from '../../../src/render/bsp/geometry.js';

// Mock WebGL classes
const mockGL = {
  createBuffer: vi.fn(() => ({})),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  deleteBuffer: vi.fn(),
  createVertexArray: vi.fn(() => ({})),
  bindVertexArray: vi.fn(),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  vertexAttribDivisor: vi.fn(),
  deleteVertexArray: vi.fn(),
  createTexture: vi.fn(() => ({})),
  activeTexture: vi.fn(),
  bindTexture: vi.fn(),
  texParameteri: vi.fn(),
  texImage2D: vi.fn(),
  deleteTexture: vi.fn(),
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  STATIC_DRAW: 0x88E4,
  FLOAT: 0x1406,
  TEXTURE_2D: 0x0DE1,
  TEXTURE0: 0x84C0,
  RGBA: 0x1908,
  UNSIGNED_BYTE: 0x1401,
  LINEAR: 0x2601,
  CLAMP_TO_EDGE: 0x812F
} as unknown as WebGL2RenderingContext;

describe('buildBspGeometry', () => {
  it('should create geometry and batches correctly', () => {
    const surfaces: BspSurfaceInput[] = [
      {
        faceIndex: 0,
        textureName: 'tex1',
        flags: 0,
        vertexCount: 4,
        vertices: new Float32Array([
            // x, y, z, u, v, lu, lv
            0, 0, 0, 0, 0, 0, 0,
            10, 0, 0, 1, 0, 10, 0,
            10, 10, 0, 1, 1, 10, 10,
            0, 10, 0, 0, 1, 0, 10
        ]),
        styles: [0, 255, 255, 255],
        lightmap: {
            width: 16,
            height: 16,
            data: new Uint8Array(16*16*3)
        }
      },
      {
        faceIndex: 1,
        textureName: 'tex1', // Same texture, should be batched
        flags: 0,
        vertexCount: 3,
        vertices: new Float32Array([
            20, 0, 0, 0, 0, 0, 0,
            30, 0, 0, 1, 0, 10, 0,
            20, 10, 0, 0, 1, 0, 10
        ]),
        styles: [0, 255, 255, 255],
         lightmap: {
            width: 16,
            height: 16,
            data: new Uint8Array(16*16*3)
        }
      },
       {
        faceIndex: 2,
        textureName: 'tex2', // Different texture, new batch
        flags: 0,
        vertexCount: 3,
        vertices: new Float32Array([
            40, 0, 0, 0, 0, 0, 0,
            50, 0, 0, 1, 0, 10, 0,
            40, 10, 0, 0, 1, 0, 10
        ]),
        styles: [0, 255, 255, 255]
        // No lightmap
      }
    ];

    const result = buildBspGeometry(mockGL, surfaces);

    expect(result.batches).toHaveLength(2);

    // Batch 1: tex1
    expect(result.batches[0].textureName).toBe('tex1');
    expect(result.batches[0].offset).toBe(0);
    // Face 1 (quad) -> 2 triangles = 6 indices
    // Face 2 (tri) -> 1 triangle = 3 indices
    // Total 9 indices
    expect(result.batches[0].count).toBe(9);

    // Batch 2: tex2
    expect(result.batches[1].textureName).toBe('tex2');
    expect(result.batches[1].offset).toBe(9);
    expect(result.batches[1].count).toBe(3);

    expect(result.lightmapAtlas).not.toBeNull();
    expect(mockGL.texImage2D).toHaveBeenCalled(); // Should have uploaded atlas

    // Check buffer uploads. VertexBuffer and IndexBuffer both call bufferData once in constructor.
    // VertexBuffer calls it with 0 initially to init buffer?
    // Let's check the code for VertexBuffer.
    // It calls bufferData(..., 0, usage) in constructor.
    // Then upload() calls bufferData(..., data, usage).
    // So 2 calls per buffer -> 4 calls total.
    expect(mockGL.bufferData).toHaveBeenCalledTimes(4);
  });
});
