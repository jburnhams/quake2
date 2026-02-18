import { vi } from 'vitest';
import { VertexBuffer, IndexBuffer, BufferUsage } from '@quake2ts/engine';
import { ShaderProgram, ShaderSources } from '@quake2ts/engine';
import { createMockWebGL2Context } from './webgl.js';

// Export these for use in other mocks
export { VertexBuffer, IndexBuffer, ShaderProgram };

/**
 * Creates a mock VertexBuffer with an optional data array.
 */
export function createMockVertexBuffer(data?: Float32Array, usage?: BufferUsage): VertexBuffer {
  const gl = createMockWebGL2Context() as unknown as WebGL2RenderingContext;
  const vb = new VertexBuffer(gl, usage ?? gl.STATIC_DRAW);

  // Spy on methods to track calls
  vi.spyOn(vb, 'bind');
  vi.spyOn(vb, 'upload');
  vi.spyOn(vb, 'update');
  vi.spyOn(vb, 'dispose');

  if (data) {
    vb.upload(data as unknown as BufferSource, usage ?? gl.STATIC_DRAW);
  }

  return vb;
}

/**
 * Creates a mock IndexBuffer with an optional data array.
 */
export function createMockIndexBuffer(data?: Uint16Array, usage?: BufferUsage): IndexBuffer {
  const gl = createMockWebGL2Context() as unknown as WebGL2RenderingContext;
  const ib = new IndexBuffer(gl, usage ?? gl.STATIC_DRAW);

  // Spy on methods
  vi.spyOn(ib, 'bind');
  vi.spyOn(ib, 'upload');
  vi.spyOn(ib, 'update');
  vi.spyOn(ib, 'dispose');

  if (data) {
    ib.upload(data as unknown as BufferSource, usage ?? gl.STATIC_DRAW);
  }

  return ib;
}


/**
 * Helper to create a mock ShaderProgram with custom source code.
 */
export function createMockShader(vertSource?: string, fragSource?: string): ShaderProgram {
  const gl = createMockWebGL2Context() as unknown as WebGL2RenderingContext;
  const sources: ShaderSources = {
    vertex: vertSource ?? '#version 300 es\nvoid main() {}',
    fragment: fragSource ?? '#version 300 es\nvoid main() {}'
  };

  return ShaderProgram.create(gl, sources);
}
