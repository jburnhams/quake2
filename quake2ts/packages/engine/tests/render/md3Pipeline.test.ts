import { buildMd3SurfaceGeometry, buildMd3VertexData } from '../../src/render/md3Pipeline.js';
import { Md3Surface } from '../../src/assets/md3.js';
import { describe, it, expect } from 'vitest';

describe('MD3 Pipeline', () => {
    describe('buildMd3SurfaceGeometry', () => {
        it('should convert a simple triangle', () => {
            const surface: Md3Surface = {
                name: 'test',
                flags: 0,
                vertices: [],
                shaders: [],
                triangles: [{ indices: [0, 1, 2] }],
                texCoords: [
                    { s: 0, t: 0 },
                    { s: 1, t: 0 },
                    { s: 0, t: 1 },
                ],
            };

            const geometry = buildMd3SurfaceGeometry(surface);

            expect(geometry.vertices).toEqual([
                { vertexIndex: 0, texCoord: [0, 1] },
                { vertexIndex: 1, texCoord: [1, 1] },
                { vertexIndex: 2, texCoord: [0, 0] },
            ]);
            expect(geometry.indices).toEqual(new Uint16Array([0, 1, 2]));
        });
    });

    describe('buildMd3VertexData', () => {
        it('should interpolate vertex data', () => {
            const surface: Md3Surface = {
                name: 'test',
                flags: 0,
                vertices: [
                    // Frame 0
                    [{
                        position: { x: 0, y: 0, z: 0 },
                        normal: { x: 0, y: 0, z: 1 },
                    }],
                    // Frame 1
                    [{
                        position: { x: 10, y: 0, z: 0 },
                        normal: { x: 0, y: 1, z: 0 },
                    }],
                ],
                shaders: [],
                triangles: [{ indices: [0, 0, 0] }],
                texCoords: [{ s: 0, t: 0 }],
            };
            const geometry = {
                vertices: [{ vertexIndex: 0, texCoord: [0.5, 0.5] }],
                indices: new Uint16Array([0]),
            };
            const blend = { frame0: 0, frame1: 1, lerp: 0.5 };
            const lighting = {
                ambient: [0.1, 0.1, 0.1],
                directional: {
                    direction: { x: 0, y: 0, z: 1 },
                    color: [1, 1, 1],
                },
            };

            const data = buildMd3VertexData(surface, geometry, blend, lighting);

            // 12 floats per vertex: 3 pos, 3 normal, 2 uv, 4 color
            expect(data.length).toBe(12);

            // Position
            expect(data[0]).toBeCloseTo(5); // x
            expect(data[1]).toBeCloseTo(0); // y
            expect(data[2]).toBeCloseTo(0); // z

            // Normal
            expect(data[3]).toBeCloseTo(0); // x
            expect(data[4]).toBeCloseTo(0.707); // y
            expect(data[5]).toBeCloseTo(0.707); // z

            // UV
            expect(data[6]).toBeCloseTo(0.5);
            expect(data[7]).toBeCloseTo(0.5);

            // Color (ambient + directional)
            // interpolated normal is (0, 0.707, 0.707)
            // dot product with light direction (0, 0, 1) is 0.707
            // color = ambient + directional * dot_product
            // color = 0.1 + 1.0 * 0.707 = 0.807
            expect(data[8]).toBeCloseTo(0.807); // r
            expect(data[9]).toBeCloseTo(0.807); // g
            expect(data[10]).toBeCloseTo(0.807); // b
        });
    });
});
