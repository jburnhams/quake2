import { describe, expect, it, vi } from 'vitest';
import { parseMd2 } from '../../../src/assets/md2.js';
import {
  MD2_FRAGMENT_SHADER,
  MD2_VERTEX_SHADER,
  Md2MeshBuffers,
  Md2Pipeline,
  buildMd2Geometry,
  buildMd2VertexData,
} from '../../../src/render/md2Pipeline.js';
import { buildMd2 } from '@quake2ts/test-utils'; // md2Builder.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

const baseMd2 = parseMd2(
  buildMd2({
    texCoords: [
      { s: 0, t: 0 },
      { s: 32, t: 0 },
      { s: 32, t: 32 },
      { s: 0, t: 32 },
      { s: 48, t: 48 },
    ],
    triangles: [
      { vertexIndices: [0, 1, 2], texCoordIndices: [0, 1, 2] },
      { vertexIndices: [0, 2, 3], texCoordIndices: [0, 2, 3] },
    ],
    frames: [
      {
        name: 'idle0',
        vertices: [
          { position: { x: 0, y: 0, z: 0 }, normalIndex: 0 },
          { position: { x: 1, y: 0, z: 0 }, normalIndex: 1 },
          { position: { x: 1, y: 1, z: 0 }, normalIndex: 2 },
          { position: { x: 0, y: 1, z: 0 }, normalIndex: 3 },
        ],
      },
      {
        name: 'idle1',
        vertices: [
          { position: { x: 0, y: 0.5, z: 0 }, normalIndex: 0 },
          { position: { x: 1, y: 0.5, z: 0 }, normalIndex: 1 },
          { position: { x: 1, y: 1.5, z: 0 }, normalIndex: 2 },
          { position: { x: 0, y: 1.5, z: 0 }, normalIndex: 3 },
        ],
      },
    ],
    glCommands: [
      {
        mode: 'strip',
        vertices: [
          { s: 0, t: 0, vertexIndex: 0 },
          { s: 1, t: 0, vertexIndex: 1 },
          { s: 1, t: 1, vertexIndex: 2 },
          { s: 0, t: 1, vertexIndex: 3 },
        ],
      },
      {
        mode: 'fan',
        vertices: [
          { s: 0.5, t: 0.5, vertexIndex: 0 },
          { s: 0.75, t: 0.25, vertexIndex: 1 },
          { s: 0.75, t: 0.75, vertexIndex: 2 },
        ],
      },
    ],
  })
);

describe('MD2 geometry construction', () => {
  it('builds vertex and index data from GL commands', () => {
    const geometry = buildMd2Geometry(baseMd2);
    expect(geometry.vertices).toHaveLength(7);
    expect(Array.from(geometry.indices)).toEqual([0, 1, 2, 2, 1, 3, 4, 5, 6]);
    expect(geometry.vertices[0]).toEqual({ vertexIndex: 0, texCoord: [0, 1] });
    expect(geometry.vertices[2].texCoord[1]).toBeCloseTo(0);
  });

  it('falls back to triangle data when GL commands are absent', () => {
    const buffer = buildMd2({
      texCoords: [
        { s: 0, t: 0 },
        { s: 64, t: 0 },
        { s: 64, t: 64 },
      ],
      triangles: [{ vertexIndices: [0, 1, 2], texCoordIndices: [0, 1, 2] }],
      frames: [
        {
          name: 'only',
          vertices: [
            { position: { x: 0, y: 0, z: 0 }, normalIndex: 0 },
            { position: { x: 1, y: 0, z: 0 }, normalIndex: 1 },
            { position: { x: 0, y: 1, z: 0 }, normalIndex: 2 },
          ],
        },
        {
          name: 'only2',
          vertices: [
            { position: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
            { position: { x: 1, y: 0, z: 1 }, normalIndex: 1 },
            { position: { x: 0, y: 1, z: 1 }, normalIndex: 2 },
          ],
        },
      ],
      glCommands: [],
    });

    const geometry = buildMd2Geometry(parseMd2(buffer));
    expect(Array.from(geometry.indices)).toEqual([0, 1, 2]);
    expect(geometry.vertices[0].texCoord).toEqual([0, 1]);
    expect(geometry.vertices[2].texCoord[0]).toBeCloseTo(1);
  });
});

describe('MD2 frame interpolation', () => {
  it('lerps positions and renormalizes normals per vertex', () => {
    const geometry = buildMd2Geometry(baseMd2);
    const data = buildMd2VertexData(baseMd2, geometry, { frame0: 0, frame1: 1, lerp: 0.5 });

    const firstVertex = Array.from(data.slice(0, 8));
    expect(firstVertex[1]).toBeCloseTo(0.5);
    const normalLength = Math.hypot(firstVertex[3], firstVertex[4], firstVertex[5]);
    expect(normalLength).toBeCloseTo(1);
    expect(firstVertex[6]).toBe(0);
    expect(firstVertex[7]).toBe(1);
  });
});

describe('MD2 pipeline', () => {
  it('binds uniforms and draws the mesh', () => {
    const gl = createMockWebGL2Context();
    // Ensure uniform4f is mocked
    if (!gl.uniform4f) {
        (gl as any).uniform4f = vi.fn();
    }

    const uniformNames = ['u_modelViewProjection', 'u_lightDir', 'u_tint', 'u_diffuseMap', 'u_renderMode', 'u_solidColor', 'u_modelMatrix'];
    uniformNames.forEach((name) => gl.uniformLocations.set(name, {} as WebGLUniformLocation));

    const pipeline = new Md2Pipeline(gl as unknown as WebGL2RenderingContext);
    const blend = { frame0: 0, frame1: 1, lerp: 0.25 } as const;
    const mesh = new Md2MeshBuffers(gl as unknown as WebGL2RenderingContext, baseMd2, blend);
    const mvp = new Float32Array(16);
    mvp[0] = 1;

    pipeline.bind({ modelViewProjection: mvp, lightDirection: [1, 0, 0], tint: [1, 0.5, 0.5, 1], diffuseSampler: 2 });
    pipeline.draw(mesh);

    expect(gl.useProgram).toHaveBeenCalled();
    expect(gl.uniformMatrix4fv).toHaveBeenCalledWith(gl.uniformLocations.get('u_modelViewProjection'), false, mvp);
    expect(gl.uniform3fv).toHaveBeenCalledWith(gl.uniformLocations.get('u_lightDir'), new Float32Array([1, 0, 0]));
    expect(gl.uniform4fv).toHaveBeenCalledWith(gl.uniformLocations.get('u_tint'), new Float32Array([1, 0.5, 0.5, 1]));
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_diffuseMap'), 2);
    expect(gl.drawElements).toHaveBeenCalledWith(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);

    mesh.dispose();
    pipeline.dispose();
  });
});

describe('MD2 shader exports', () => {
  it('exposes shader source strings for validation', () => {
    expect(MD2_VERTEX_SHADER).toContain('a_position');
    expect(MD2_FRAGMENT_SHADER).toContain('u_diffuseMap');
  });
});
