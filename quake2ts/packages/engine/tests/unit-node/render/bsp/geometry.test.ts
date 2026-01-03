import { describe, it, expect, vi } from 'vitest';
import { buildBspGeometry } from '../../../../src/render/bsp/geometry.js';
import { BspSurfaceInput } from '../../../../src/render/bsp/geometry.js';

describe('buildBspGeometry', () => {
  it('should calculate styleLayers and pack lightmaps correctly', () => {
    // Mock GL context
    const gl = {
      createVertexArray: vi.fn().mockReturnValue({}),
      bindVertexArray: vi.fn(),
      createBuffer: vi.fn().mockReturnValue({}),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      vertexAttribPointer: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribDivisor: vi.fn(),
      createTexture: vi.fn().mockReturnValue({}),
      bindTexture: vi.fn(),
      texImage2D: vi.fn(),
      texParameteri: vi.fn(),
      activeTexture: vi.fn(),
      FLOAT: 0x1406,
      STATIC_DRAW: 0x88E4,
      LINEAR: 0x2601,
      CLAMP_TO_EDGE: 0x812F,
      TEXTURE0: 0x84C0,
    } as unknown as WebGL2RenderingContext;

    // Create a surface with 2 styles
    // Lightmap data: 3x3x3 * 2 = 54 bytes
    const lmData = new Uint8Array(54);
    lmData.fill(1); // fill with data

    const surface: BspSurfaceInput = {
      faceIndex: 0,
      textureName: 'tex1',
      flags: 0,
      vertices: new Float32Array([
          0,0,0, 0,0, 0,0,
          1,0,0, 0,0, 0,0,
          0,1,0, 0,0, 0,0
      ]), // 3 vertices
      vertexCount: 3,
      styles: [0, 255, 2, 255], // Slot 0 has map 0. Slot 2 has map 1.
      lightmap: {
        width: 3,
        height: 3,
        data: lmData
      }
    };

    const geometry = buildBspGeometry(gl, [surface]);

    expect(geometry.batches).toHaveLength(1);
    const batch = geometry.batches[0];

    // Verify styles
    expect(batch.styleIndices).toEqual([0, 255, 2, 255]);

    // Verify styleLayers
    // Slot 0 -> Layer 0
    // Slot 1 -> -1
    // Slot 2 -> Layer 1
    // Slot 3 -> -1
    expect(batch.styleLayers).toEqual([0, -1, 1, -1]);

    // Verify vertex attributes
    // Stride should be 32 (8 floats).
    // The last float (index 7) should be lightmapStep.
    // Total height packed = 3 * 2 = 6.
    // ATLAS_SIZE = 2048.
    // Step = 3 / 2048 (height of ONE style).

    // Check call to bufferData for VBO
    const bufferCalls = (gl.bufferData as any).mock.calls;
    // Find the Float32Array
    const vertexData = bufferCalls.find((call: any) => call[1] instanceof Float32Array)[1] as Float32Array;

    expect(vertexData).toBeDefined();
    // 3 vertices, 8 floats each = 24 floats
    expect(vertexData.length).toBe(24);

    const step = vertexData[7]; // First vertex step
    const expectedStep = 3 / 2048;
    expect(step).toBeCloseTo(expectedStep);
  });
});
