import { describe, it, expect } from 'vitest';

/**
 * This test directly examines the vertex data being created by the test geometry helper
 * to confirm that vertex positions are absolute (not relative to mins).
 */

describe('Test Geometry Vertex Data Verification', () => {
    // Recreate the exact geometry creation logic from the visual tests
    function createTestBspGeometry(options: { min: [number, number, number], max: [number, number, number], texture: string }) {
        const min = options.min;
        const max = options.max;
        const dx = max[0] - min[0];

        let vertices: Float32Array;

        if (dx < 0.001) {
            // Flat in X (YZ plane) - Wall
            vertices = new Float32Array([
                min[0], min[1], min[2], 0, 1, 0, 0, 0,  // V0
                max[0], min[1], max[2], 0, 0, 0, 0, 0,  // V1
                min[0], max[1], min[2], 1, 1, 0, 0, 0,  // V2
                max[0], min[1], max[2], 0, 0, 0, 0, 0,  // V3
                max[0], max[1], max[2], 1, 0, 0, 0, 0,  // V4
                min[0], max[1], min[2], 1, 1, 0, 0, 0,  // V5
            ]);
        } else {
            vertices = new Float32Array([]); // Not relevant for this test
        }

        return {
            texture: options.texture,
            vertexData: vertices,
            vertexCount: 6,
            mins: { x: options.min[0], y: options.min[1], z: options.min[2] },
            maxs: { x: options.max[0], y: options.max[1], z: options.max[2] },
        };
    }

    it('should create vertex data with ABSOLUTE positions', () => {
        // Same wall as used in visual tests
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });

        const vd = wall.vertexData;
        const STRIDE = 8;

        // Extract vertex positions from the Float32Array
        const vertices = [];
        for (let i = 0; i < 6; i++) {
            vertices.push({
                x: vd[i * STRIDE + 0],
                y: vd[i * STRIDE + 1],
                z: vd[i * STRIDE + 2]
            });
        }

        console.log('Vertex positions:', vertices);
        console.log('mins:', wall.mins);
        console.log('maxs:', wall.maxs);

        // V0 should be at (200, -200, -100) - the min corner
        expect(vertices[0]).toEqual({ x: 200, y: -200, z: -100 });

        // V1 should be at (200, -200, 300) - min Y, max Z
        expect(vertices[1]).toEqual({ x: 200, y: -200, z: 300 });

        // V2 should be at (200, 200, -100) - max Y, min Z
        expect(vertices[2]).toEqual({ x: 200, y: 200, z: -100 });

        // V4 should be at (200, 200, 300) - the max corner
        expect(vertices[4]).toEqual({ x: 200, y: 200, z: 300 });

        // Verify these are ABSOLUTE coordinates, not relative to mins
        expect(vertices[0].x).toBe(wall.mins.x);  // 200, not 0
        expect(vertices[0].y).toBe(wall.mins.y);  // -200, not 0
        expect(vertices[0].z).toBe(wall.mins.z);  // -100, not 0

        // If they were relative, V0 would be (0, 0, 0) - but they're not!
        expect(vertices[0]).not.toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should NOT subtract mins from vertex positions', () => {
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });

        const vd = wall.vertexData;

        // Check that vertex 0 is at absolute (200, -200, -100)
        // NOT at (0, 0, 0) which would be (position - mins)
        const v0 = {
            x: vd[0],
            y: vd[1],
            z: vd[2]
        };

        // What the buggy behavior suggests the data should be:
        const buggyV0 = {
            x: wall.mins.x - wall.mins.x,  // 0
            y: wall.mins.y - wall.mins.y,  // 0
            z: wall.mins.z - wall.mins.z   // 0
        };

        console.log('Actual V0:', v0);
        console.log('Buggy V0 (if data was relative):', buggyV0);

        // The actual data should have absolute positions
        expect(v0).not.toEqual(buggyV0);
        expect(v0).toEqual({ x: 200, y: -200, z: -100 });
    });

    it('byte layout should match WebGPU expectations', () => {
        const wall = createTestBspGeometry({
            min: [200, -200, -100],
            max: [200, 200, 300],
            texture: 'wall'
        });

        // WebGPU expects: position(3), texCoord(2), lightmapCoord(2), lightmapStep(1)
        // = 8 floats = 32 bytes per vertex

        const vd = wall.vertexData;
        expect(vd.length).toBe(6 * 8);  // 6 vertices * 8 floats each
        expect(vd.byteLength).toBe(6 * 8 * 4);  // 192 bytes total

        // Verify byte offsets for first vertex
        // Position at offset 0: (200, -200, -100)
        expect(vd[0]).toBe(200);
        expect(vd[1]).toBe(-200);
        expect(vd[2]).toBe(-100);

        // TexCoord at offset 12 (3 floats): (0, 1)
        expect(vd[3]).toBe(0);
        expect(vd[4]).toBe(1);

        // LightmapCoord at offset 20 (5 floats): (0, 0)
        expect(vd[5]).toBe(0);
        expect(vd[6]).toBe(0);

        // LightmapStep at offset 28 (7 floats): 0
        expect(vd[7]).toBe(0);
    });
});
