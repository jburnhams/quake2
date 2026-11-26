import { describe, it, expect } from 'vitest';

/**
 * Unit tests for verifying worldPos coordinate system in WebGPU BSP rendering.
 *
 * The bug: Light at (180, 0, 100) appears at bottom-right instead of center.
 * Hypothesis: worldPos in shader = (actual_position - surface.mins)
 *
 * This test file verifies the expected behavior and documents the fix.
 */

describe('WebGPU worldPos Coordinate System', () => {
    // Test geometry: Wall at X=200, Y∈[-200,200], Z∈[-100,300]
    const wallMins = { x: 200, y: -200, z: -100 };
    const wallMaxs = { x: 200, y: 200, z: 300 };
    const wallCenter = {
        x: (wallMins.x + wallMaxs.x) / 2,  // 200
        y: (wallMins.y + wallMaxs.y) / 2,  // 0
        z: (wallMins.z + wallMaxs.z) / 2   // 100
    };

    // Camera at (0, 0, 100) looking +X
    const cameraPos = { x: 0, y: 0, z: 100 };

    /**
     * Helper to create test vertex positions for a flat-in-X wall
     */
    function createWallVertices(min: number[], max: number[]) {
        return [
            { x: min[0], y: min[1], z: min[2] },  // (200, -200, -100) - bottom-right on screen
            { x: max[0], y: min[1], z: max[2] },  // (200, -200, 300) - top-right on screen
            { x: min[0], y: max[1], z: min[2] },  // (200, 200, -100) - bottom-left on screen
            { x: max[0], y: max[1], z: max[2] },  // (200, 200, 300) - top-left on screen
        ];
    }

    /**
     * Simulates the CORRECT worldPos calculation (absolute position)
     */
    function correctWorldPos(vertexPos: { x: number, y: number, z: number }) {
        return { ...vertexPos };  // worldPos = absolute position
    }

    /**
     * Simulates the BUGGY worldPos calculation (position - mins)
     */
    function buggyWorldPos(vertexPos: { x: number, y: number, z: number }, mins: { x: number, y: number, z: number }) {
        return {
            x: vertexPos.x - mins.x,
            y: vertexPos.y - mins.y,
            z: vertexPos.z - mins.z
        };
    }

    /**
     * Calculate distance between two points
     */
    function distance(a: { x: number, y: number, z: number }, b: { x: number, y: number, z: number }) {
        return Math.sqrt(
            Math.pow(a.x - b.x, 2) +
            Math.pow(a.y - b.y, 2) +
            Math.pow(a.z - b.z, 2)
        );
    }

    describe('Expected Behavior (correct worldPos)', () => {
        const vertices = createWallVertices([200, -200, -100], [200, 200, 300]);
        const lightPos = { x: 180, y: 0, z: 100 };  // 20 units in front of center

        it('should have wall center closest to light', () => {
            const centerWorldPos = correctWorldPos(wallCenter);
            const cornerWorldPos = correctWorldPos(vertices[0]);  // bottom-right

            const distToCenter = distance(lightPos, centerWorldPos);
            const distToCorner = distance(lightPos, cornerWorldPos);

            expect(distToCenter).toBe(20);  // Light is 20 units from center
            expect(distToCorner).toBeCloseTo(283.5, 0);  // Much farther from corner
            expect(distToCenter).toBeLessThan(distToCorner);
        });

        it('should illuminate center with light at (180, 0, 100)', () => {
            const lightIntensity = 150;

            // With correct worldPos, center is closest
            const centerWorldPos = correctWorldPos(wallCenter);
            const distToCenter = distance(lightPos, centerWorldPos);

            expect(distToCenter).toBeLessThan(lightIntensity);  // Within light radius

            // Contribution at center should be significant
            const contribution = (lightIntensity - distToCenter) / 255;
            expect(contribution).toBeGreaterThan(0.5);  // Strong illumination at center
        });
    });

    describe('Buggy Behavior (worldPos = position - mins)', () => {
        const vertices = createWallVertices([200, -200, -100], [200, 200, 300]);
        const lightPos = { x: 180, y: 0, z: 100 };  // Same light position

        it('should have bottom-right corner closest to light (BUG)', () => {
            const mins = wallMins;

            // With buggy worldPos, positions are offset by -mins
            const centerWorldPos = buggyWorldPos(wallCenter, mins);  // (0, 200, 200)
            const bottomRightWorldPos = buggyWorldPos(vertices[0], mins);  // (0, 0, 0)

            const distToCenter = distance(lightPos, centerWorldPos);
            const distToBottomRight = distance(lightPos, bottomRightWorldPos);

            // Bug: bottom-right is CLOSER than center!
            expect(distToBottomRight).toBeLessThan(distToCenter);
            expect(distToBottomRight).toBeCloseTo(206, 0);  // ~206 units
            expect(distToCenter).toBeCloseTo(287, 0);  // ~287 units
        });

        it('should demonstrate why light appears at wrong position', () => {
            const mins = wallMins;
            const lightIntensity = 150;

            // With buggy worldPos
            const bottomRightWorldPos = buggyWorldPos(vertices[0], mins);  // (0, 0, 0)
            const distToBottomRight = distance(lightPos, bottomRightWorldPos);

            // But this is outside the light radius!
            expect(distToBottomRight).toBeGreaterThan(lightIntensity);

            // So even the "closest" point (with buggy coords) is outside light radius
            // This explains why the visible test shows light at bottom-right edge
        });
    });

    describe('Vertex Data Verification', () => {
        it('should create vertices at absolute world coordinates', () => {
            const min = [200, -200, -100];
            const max = [200, 200, 300];

            // Flat in X (wall)
            const vertices = new Float32Array([
                min[0], min[1], min[2], 0, 1, 0, 0, 0,  // vertex 0
                max[0], min[1], max[2], 0, 0, 0, 0, 0,  // vertex 1
                min[0], max[1], min[2], 1, 1, 0, 0, 0,  // vertex 2
            ]);

            // Verify vertex positions are ABSOLUTE coordinates
            expect(vertices[0]).toBe(200);   // x
            expect(vertices[1]).toBe(-200);  // y
            expect(vertices[2]).toBe(-100);  // z

            expect(vertices[8]).toBe(200);   // x
            expect(vertices[9]).toBe(-200);  // y
            expect(vertices[10]).toBe(300);  // z

            expect(vertices[16]).toBe(200);  // x
            expect(vertices[17]).toBe(200);  // y
            expect(vertices[18]).toBe(-100); // z
        });

        it('should have 8 floats per vertex for WebGPU BSP pipeline', () => {
            const FLOATS_PER_VERTEX = 8;  // x,y,z, u,v, lm_u,lm_v, lm_step
            const BYTES_PER_VERTEX = FLOATS_PER_VERTEX * 4;  // 32 bytes

            expect(BYTES_PER_VERTEX).toBe(32);
        });
    });

    describe('Screen Position to Quake Coordinate Mapping', () => {
        // Camera at (0, 0, 100) looking +X (yaw=0)
        // Screen coordinates:
        // - Right on screen = Quake -Y (since +Y is left)
        // - Down on screen = Quake -Z (below camera)

        it('should map screen positions correctly', () => {
            // Wall corners in Quake coordinates
            const corners = {
                topLeft: { x: 200, y: 200, z: 300 },      // max.y, max.z
                topRight: { x: 200, y: -200, z: 300 },    // min.y, max.z
                bottomLeft: { x: 200, y: 200, z: -100 },  // max.y, min.z
                bottomRight: { x: 200, y: -200, z: -100 } // min.y, min.z
            };

            // Verify corner positions
            expect(corners.bottomRight.y).toBe(wallMins.y);
            expect(corners.bottomRight.z).toBe(wallMins.z);
            expect(corners.topLeft.y).toBe(wallMaxs.y);
            expect(corners.topLeft.z).toBe(wallMaxs.z);
        });
    });

    describe('Light Distance Calculations', () => {
        it('should calculate correct distances for centered light', () => {
            const light = { x: 180, y: 0, z: 100 };

            const points = [
                { name: 'center', pos: { x: 200, y: 0, z: 100 }, expectedDist: 20 },
                { name: 'top-center', pos: { x: 200, y: 0, z: 300 }, expectedDist: Math.sqrt(20*20 + 200*200) },
                { name: 'bottom-right', pos: { x: 200, y: -200, z: -100 }, expectedDist: Math.sqrt(20*20 + 200*200 + 200*200) },
            ];

            for (const point of points) {
                const dist = distance(light, point.pos);
                expect(dist).toBeCloseTo(point.expectedDist, 0);
            }
        });

        it('should find minimum distance at center (correct behavior)', () => {
            const light = { x: 180, y: 0, z: 100 };
            const vertices = createWallVertices([200, -200, -100], [200, 200, 300]);

            // For interpolated center position
            const center = wallCenter;

            let minDist = Infinity;
            let closestName = '';

            const allPoints = [
                { name: 'center', pos: center },
                ...vertices.map((v, i) => ({ name: `vertex${i}`, pos: v }))
            ];

            for (const point of allPoints) {
                const dist = distance(light, correctWorldPos(point.pos));
                if (dist < minDist) {
                    minDist = dist;
                    closestName = point.name;
                }
            }

            expect(closestName).toBe('center');
            expect(minDist).toBe(20);
        });
    });
});
