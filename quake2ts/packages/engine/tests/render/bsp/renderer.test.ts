import { describe, it, expect, vi } from 'vitest';
import { BspRenderer } from '../../../src/render/bsp/renderer.js';
import { BspGeometry, BspBatch } from '../../../src/render/bsp/geometry.js';
import { VertexArray, Texture2D } from '../../../src/render/resources.js';

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
  createProgram: vi.fn(() => ({})),
  createShader: vi.fn(() => ({})),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn(() => true),
  useProgram: vi.fn(),
  getUniformLocation: vi.fn(() => ({})),
  uniformMatrix4fv: vi.fn(),
  uniform2f: vi.fn(),
  uniform3f: vi.fn(),
  uniform4fv: vi.fn(),
  uniform4f: vi.fn(), // Added
  uniform1f: vi.fn(),
  uniform1i: vi.fn(),
  drawElements: vi.fn(),
  deleteProgram: vi.fn(),
  deleteShader: vi.fn(),
  depthMask: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  blendFunc: vi.fn(),
  bindAttribLocation: vi.fn(), // Added this missing function

  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  STATIC_DRAW: 0x88E4,
  FLOAT: 0x1406,
  TEXTURE_2D: 0x0DE1,
  TEXTURE0: 0x84C0,
  RGBA: 0x1908,
  UNSIGNED_BYTE: 0x1401,
  LINEAR: 0x2601,
  CLAMP_TO_EDGE: 0x812F,
  TRIANGLES: 0x0004,
  UNSIGNED_INT: 0x1405,
  VERTEX_SHADER: 0x8B31,
  FRAGMENT_SHADER: 0x8B30,
  COMPILE_STATUS: 0x8B81,
  LINK_STATUS: 0x8B82,
  BLEND: 0x0BE2,
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303
} as unknown as WebGL2RenderingContext;

describe('BspRenderer', () => {
  it('should render geometry batches', () => {
    const renderer = new BspRenderer(mockGL);

    const mockVao = {
      bind: vi.fn()
    } as unknown as VertexArray;

    const mockAtlas = {
      bind: vi.fn()
    } as unknown as Texture2D;

    const geometry: BspGeometry = {
      vao: mockVao,
      vbo: {} as any,
      ibo: {} as any,
      indexCount: 12,
      batches: [
        {
          textureName: 'tex1',
          offset: 0,
          count: 6,
          flags: 0
        },
        {
          textureName: 'tex2',
          offset: 6,
          count: 6,
          flags: 0
        }
      ],
      lightmapAtlas: mockAtlas
    };

    const mvp = new Float32Array(16);

    renderer.render(geometry, mvp, 1.0);

    expect(mockVao.bind).toHaveBeenCalled();
    expect(mockAtlas.bind).toHaveBeenCalledWith(1);
    expect(mockGL.useProgram).toHaveBeenCalled();
    expect(mockGL.uniformMatrix4fv).toHaveBeenCalled();
    expect(mockGL.drawElements).toHaveBeenCalledTimes(2);

    // Check draw calls
    // First batch: offset 0
    expect(mockGL.drawElements).toHaveBeenNthCalledWith(1, mockGL.TRIANGLES, 6, mockGL.UNSIGNED_INT, 0);
    // Second batch: offset 6 * 4 = 24 bytes
    expect(mockGL.drawElements).toHaveBeenNthCalledWith(2, mockGL.TRIANGLES, 6, mockGL.UNSIGNED_INT, 24);
  });
});
