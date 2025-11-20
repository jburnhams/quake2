import { describe, expect, it } from 'vitest';
import { parseMd3 } from '../src/assets/md3.js';
import {
  MD3_FRAGMENT_SHADER,
  MD3_VERTEX_SHADER,
  Md3ModelMesh,
  Md3Pipeline,
  Md3SurfaceMesh,
  buildMd3SurfaceGeometry,
  buildMd3VertexData,
  interpolateMd3Tag,
} from '../src/render/md3Pipeline.js';
import { buildMd3 } from './helpers/md3Builder.js';
import { createMockGL } from './helpers/mockWebGL.js';
import { mat4FromBasis } from '@quake2ts/shared';

const baseMd3 = parseMd3(
  buildMd3({
    frames: [
      { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 }, origin: { x: 0, y: 0, z: 0 }, radius: 2, name: 'idle0' },
      { min: { x: -2, y: -2, z: -2 }, max: { x: 2, y: 2, z: 2 }, origin: { x: 0, y: 0, z: 0 }, radius: 3, name: 'idle1' },
    ],
    tags: [
      { name: 'tag_barrel', origin: { x: 1, y: 2, z: 3 }, axis: [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
      ] },
    ],
    surfaces: [
      {
        name: 'head',
        triangles: [
          [0, 1, 2],
          [0, 2, 3],
        ],
        texCoords: [
          { s: 0, t: 0 },
          { s: 1, t: 0 },
          { s: 1, t: 1 },
          { s: 0, t: 1 },
        ],
        shaders: [{ name: 'skin0', index: 0 }],
        vertices: [
          [
            { position: { x: 0, y: 0, z: 0 }, latLng: 0 },
            { position: { x: 1, y: 0, z: 0 }, latLng: 0 },
            { position: { x: 1, y: 1, z: 0 }, latLng: 0x3f00 },
            { position: { x: 0, y: 1, z: 0 }, latLng: 0x3f00 },
          ],
          [
            { position: { x: 0, y: 0, z: 0 }, latLng: 0 },
            { position: { x: 2, y: 0, z: 0 }, latLng: 0 },
            { position: { x: 2, y: 2, z: 0 }, latLng: 0x3f00 },
            { position: { x: 0, y: 2, z: 0 }, latLng: 0x3f00 },
          ],
        ],
      },
      {
        name: 'eyes',
        triangles: [[0, 2, 1]],
        texCoords: [
          { s: 0.5, t: 0.5 },
          { s: 0.25, t: 0.25 },
          { s: 0.75, t: 0.25 },
        ],
        shaders: [{ name: 'skin1', index: 1 }],
        vertices: [
          [
            { position: { x: 0.2, y: 0.2, z: 0.1 }, latLng: 0x7f00 },
            { position: { x: 0.4, y: 0.2, z: 0.1 }, latLng: 0x7f00 },
            { position: { x: 0.3, y: 0.3, z: 0.1 }, latLng: 0x7f00 },
          ],
          [
            { position: { x: 0.3, y: 0.3, z: 0.1 }, latLng: 0x7f00 },
            { position: { x: 0.5, y: 0.3, z: 0.1 }, latLng: 0x7f00 },
            { position: { x: 0.4, y: 0.4, z: 0.1 }, latLng: 0x7f00 },
          ],
        ],
      },
    ],
  })
);

const blend = { currentFrame: 0, nextFrame: 1, lerp: 0.5 } as const;

describe('MD3 geometry', () => {
  it('builds indexed geometry per-surface with flipped v coordinates', () => {
    const geometry = buildMd3SurfaceGeometry(baseMd3.surfaces[0]!);
    expect(geometry.vertices).toHaveLength(6);
    expect(geometry.vertices[2]?.texCoord[1]).toBeCloseTo(0);
    expect(Array.from(geometry.indices)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('interpolates frames with per-vertex colors and normals', () => {
    const geometry = buildMd3SurfaceGeometry(baseMd3.surfaces[0]!);
    const data = buildMd3VertexData(baseMd3.surfaces[0]!, geometry, blend, {
      ambient: [0.1, 0.2, 0.3],
      directional: { direction: { x: 0, y: 0, z: 1 }, color: [0.5, 0.5, 0.5] },
    });

    const first = Array.from(data.slice(0, 12));
    expect(first[0]).toBeCloseTo(0);
    expect(first[1]).toBeCloseTo(0);
    expect(first[2]).toBeCloseTo(0);
    expect(first[3]).toBeCloseTo(0);
    expect(first[4]).toBeCloseTo(0);
    expect(first[5]).toBeCloseTo(1);
    expect(first[6]).toBe(0);
    expect(first[7]).toBe(1);
    expect(first[8]).toBeGreaterThan(0.5); // includes ambient + directional
    expect(first[11]).toBe(1);
  });

  it('applies dynamic lights in world space using the model matrix when provided', () => {
    const geometry = buildMd3SurfaceGeometry(baseMd3.surfaces[1]!);
    const modelMatrix = mat4FromBasis({ x: 10, y: 0, z: 0 }, [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ]);
    const light = { origin: { x: 10.25, y: 0.25, z: 0.1 }, color: [1, 0, 0], radius: 1 } as const;
    const nearData = buildMd3VertexData(baseMd3.surfaces[1]!, geometry, blend, {
      ambient: [0, 0, 0],
      directional: { direction: { x: 0, y: 0, z: 1 }, color: [0, 0, 0] },
      dynamicLights: [light],
      modelMatrix,
    });

    const farData = buildMd3VertexData(baseMd3.surfaces[1]!, geometry, blend, {
      ambient: [0, 0, 0],
      directional: { direction: { x: 0, y: 0, z: 1 }, color: [0, 0, 0] },
      dynamicLights: [light],
    });

    const colorStart = 8;
    const litColor = Array.from(nearData.slice(colorStart, colorStart + 3));
    const unlitColor = Array.from(farData.slice(colorStart, colorStart + 3));
    expect(litColor[0]).toBeGreaterThan(0.5);
    expect(litColor[1]).toBeCloseTo(0);
    expect(unlitColor[0]).toBeLessThan(0.1);
  });

  it('clamps lighting accumulation to fullbright limits', () => {
    const geometry = buildMd3SurfaceGeometry(baseMd3.surfaces[0]!);
    const data = buildMd3VertexData(baseMd3.surfaces[0]!, geometry, blend, {
      ambient: [0.9, 0.9, 0.9],
      directional: { direction: { x: 0, y: 0, z: 1 }, color: [0.8, 0.8, 0.8] },
      dynamicLights: [{ origin: { x: 0, y: 0, z: 0 }, color: [2, 2, 2], radius: 10 }],
    });

    const firstColor = data.slice(8, 11);
    expect(firstColor[0]).toBeCloseTo(1);
    expect(firstColor[1]).toBeCloseTo(1);
    expect(firstColor[2]).toBeCloseTo(1);
  });
});

describe('MD3 tags', () => {
  it('interpolates tag transforms with orthogonalized basis', () => {
    const tag = interpolateMd3Tag(baseMd3, blend, 'tag_barrel');
    expect(tag).not.toBeNull();
    if (!tag) return;
    expect(tag.origin.x).toBeCloseTo(1);
    expect(tag.axis[0].x).toBeCloseTo(1);
    const dot = tag.axis[0].x * tag.axis[1].x + tag.axis[0].y * tag.axis[1].y + tag.axis[0].z * tag.axis[1].z;
    expect(Math.abs(dot)).toBeLessThan(1e-3);
    expect(tag.matrix[12]).toBeCloseTo(1);
  });
});

describe('MD3 pipeline', () => {
  it('binds MVP and draws each surface with materials', () => {
    const gl = createMockGL();
    const uniformNames = ['u_modelViewProjection', 'u_tint', 'u_diffuseMap'];
    uniformNames.forEach((name) => gl.uniformLocations.set(name, {} as WebGLUniformLocation));

    const pipeline = new Md3Pipeline(gl as unknown as WebGL2RenderingContext);
    const mesh = new Md3SurfaceMesh(gl as unknown as WebGL2RenderingContext, baseMd3.surfaces[0]!, blend);
    const mvp = new Float32Array(16);
    mvp[0] = 1;

    pipeline.bind(mvp, [1, 1, 1, 1], 0);
    pipeline.drawSurface(mesh, { diffuseSampler: 3, tint: [0.5, 0.5, 0.5, 1] });

    expect(gl.useProgram).toHaveBeenCalled();
    expect(gl.uniformMatrix4fv).toHaveBeenCalledWith(gl.uniformLocations.get('u_modelViewProjection'), false, mvp);
    expect(gl.uniform4fv).toHaveBeenCalledWith(gl.uniformLocations.get('u_tint'), new Float32Array([0.5, 0.5, 0.5, 1]));
    expect(gl.uniform1i).toHaveBeenCalledWith(gl.uniformLocations.get('u_diffuseMap'), 3);
    expect(gl.drawElements).toHaveBeenCalledWith(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);

    mesh.dispose();
    pipeline.dispose();
  });

  it('updates every surface when the model mesh blend changes', () => {
    const gl = createMockGL();
    const modelMesh = new Md3ModelMesh(gl as unknown as WebGL2RenderingContext, baseMd3, blend);
    modelMesh.update({ currentFrame: 1, nextFrame: 1, lerp: 0 }, { ambient: [1, 0, 0] });
    expect(modelMesh.surfaces.get('head')).toBeDefined();
    expect(modelMesh.surfaces.get('eyes')).toBeDefined();
    modelMesh.dispose();
  });
});

describe('MD3 shader exports', () => {
  it('exposes shader source strings for validation', () => {
    expect(MD3_VERTEX_SHADER).toContain('a_position');
    expect(MD3_FRAGMENT_SHADER).toContain('u_diffuseMap');
  });
});
