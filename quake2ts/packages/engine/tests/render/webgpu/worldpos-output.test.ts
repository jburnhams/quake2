import { describe, it, expect } from 'vitest';

/**
 * This test documents a test approach: create a debug shader that outputs
 * worldPos as fragment color to visualize the actual coordinates.
 *
 * Based on visual tests, the hypothesis is:
 * worldPos = position - mins (buggy)
 *
 * Expected behavior:
 * worldPos = position (absolute coordinates)
 *
 * To verify, we can check pixel colors:
 * - If worldPos at center = (200, 0, 100), color would be ~(0.78, 0, 0.39) normalized
 * - If worldPos at center = (0, 200, 200) (buggy), color would be ~(0, 0.78, 0.78)
 */

describe('WorldPos Output Analysis', () => {
    // Wall geometry
    const wallMin = { x: 200, y: -200, z: -100 };
    const wallMax = { x: 200, y: 200, z: 300 };
    const wallCenter = {
        x: 200,
        y: (wallMin.y + wallMax.y) / 2,  // 0
        z: (wallMin.z + wallMax.z) / 2   // 100
    };

    /**
     * Normalize position to [0,1] range for color output
     * Uses a scale factor to keep values in displayable range
     */
    function normalizeForColor(pos: { x: number, y: number, z: number }, scale = 256) {
        return {
            r: Math.abs(pos.x) / scale,
            g: Math.abs(pos.y) / scale,
            b: Math.abs(pos.z) / scale
        };
    }

    describe('Expected WorldPos Colors (if correct)', () => {
        it('should have specific color at center with correct worldPos', () => {
            // If worldPos = absolute position, center = (200, 0, 100)
            const correctWorldPos = { x: 200, y: 0, z: 100 };
            const color = normalizeForColor(correctWorldPos);

            expect(color.r).toBeCloseTo(0.78, 1);  // 200/256
            expect(color.g).toBeCloseTo(0, 1);     // 0/256
            expect(color.b).toBeCloseTo(0.39, 1);  // 100/256
        });

        it('should have specific color at bottom-right with correct worldPos', () => {
            // Bottom-right = (200, -200, -100)
            const correctWorldPos = { x: 200, y: -200, z: -100 };
            const color = normalizeForColor(correctWorldPos);

            expect(color.r).toBeCloseTo(0.78, 1);  // 200/256
            expect(color.g).toBeCloseTo(0.78, 1);  // 200/256
            expect(color.b).toBeCloseTo(0.39, 1);  // 100/256
        });
    });

    describe('Buggy WorldPos Colors (worldPos = position - mins)', () => {
        it('should have different color at center with buggy worldPos', () => {
            // If worldPos = position - mins, center = (0, 200, 200)
            const buggyWorldPos = {
                x: wallCenter.x - wallMin.x,  // 0
                y: wallCenter.y - wallMin.y,  // 200
                z: wallCenter.z - wallMin.z   // 200
            };
            const color = normalizeForColor(buggyWorldPos);

            expect(buggyWorldPos).toEqual({ x: 0, y: 200, z: 200 });
            expect(color.r).toBeCloseTo(0, 1);     // 0/256
            expect(color.g).toBeCloseTo(0.78, 1);  // 200/256
            expect(color.b).toBeCloseTo(0.78, 1);  // 200/256
        });

        it('should have color (0,0,0) at bottom-right with buggy worldPos', () => {
            // If worldPos = position - mins, bottom-right = (0, 0, 0)
            const bottomRight = { x: 200, y: -200, z: -100 };
            const buggyWorldPos = {
                x: bottomRight.x - wallMin.x,  // 0
                y: bottomRight.y - wallMin.y,  // 0
                z: bottomRight.z - wallMin.z   // 0
            };
            const color = normalizeForColor(buggyWorldPos);

            expect(buggyWorldPos).toEqual({ x: 0, y: 0, z: 0 });
            expect(color.r).toBeCloseTo(0, 1);
            expect(color.g).toBeCloseTo(0, 1);
            expect(color.b).toBeCloseTo(0, 1);
        });
    });

    describe('Light Distance Analysis', () => {
        const lightPos = { x: 180, y: 0, z: 100 };
        const intensity = 150;

        function distance(a: { x: number, y: number, z: number }, b: { x: number, y: number, z: number }) {
            return Math.sqrt(
                Math.pow(a.x - b.x, 2) +
                Math.pow(a.y - b.y, 2) +
                Math.pow(a.z - b.z, 2)
            );
        }

        it('should illuminate center with correct worldPos', () => {
            const correctCenterWorldPos = wallCenter;
            const dist = distance(lightPos, correctCenterWorldPos);

            expect(dist).toBe(20);  // Light is 20 units from center
            expect(dist).toBeLessThan(intensity);  // Within range!
        });

        it('should NOT illuminate center with buggy worldPos', () => {
            const buggyCenterWorldPos = {
                x: wallCenter.x - wallMin.x,  // 0
                y: wallCenter.y - wallMin.y,  // 200
                z: wallCenter.z - wallMin.z   // 200
            };
            const dist = distance(lightPos, buggyCenterWorldPos);

            expect(dist).toBeCloseTo(287, 0);  // Far from light!
            expect(dist).toBeGreaterThan(intensity);  // Outside range!
        });

        it('should NOT illuminate bottom-right with correct worldPos', () => {
            const correctBottomRightWorldPos = { x: 200, y: -200, z: -100 };
            const dist = distance(lightPos, correctBottomRightWorldPos);

            expect(dist).toBeCloseTo(284, 0);  // Far from light
            expect(dist).toBeGreaterThan(intensity);
        });

        it('should NOT illuminate bottom-right with buggy worldPos (still outside range)', () => {
            const buggyBottomRightWorldPos = { x: 0, y: 0, z: 0 };
            const dist = distance(lightPos, buggyBottomRightWorldPos);

            expect(dist).toBeCloseTo(206, 0);  // Closer than center! But still > 150
            expect(dist).toBeGreaterThan(intensity);
        });

        it('should show relative brightness pattern with buggy worldPos', () => {
            // Even though both are outside intensity range, bottom-right is CLOSER
            // This explains the visible glow pattern in the test image
            const buggyCenterDist = distance(lightPos, { x: 0, y: 200, z: 200 });
            const buggyBottomRightDist = distance(lightPos, { x: 0, y: 0, z: 0 });

            // Bottom-right is closer (brighter) than center
            expect(buggyBottomRightDist).toBeLessThan(buggyCenterDist);

            // This explains why light appears at bottom-right instead of center!
            console.log('Buggy center distance:', buggyCenterDist);
            console.log('Buggy bottom-right distance:', buggyBottomRightDist);
            console.log('Difference:', buggyCenterDist - buggyBottomRightDist, 'units');
        });
    });

    describe('Investigation Conclusion', () => {
        it('summarizes the bug pattern', () => {
            /**
             * CONFIRMED BUG PATTERN:
             *
             * The fragment shader is receiving worldPos = position - mins
             * instead of worldPos = position (absolute coordinates).
             *
             * This causes:
             * 1. Light at center (180, 0, 100) to appear at bottom-right
             * 2. Because buggy worldPos at bottom-right (0, 0, 0) is closer
             *    to light (180, 0, 100) than buggy center (0, 200, 200)
             *
             * ROOT CAUSE STILL TO FIND:
             * - Shader sets output.worldPos = pos directly (correct)
             * - Vertex data contains absolute positions (correct)
             * - Upload code doesn't transform positions (correct)
             * - Light positions uploaded directly (correct)
             *
             * The offset must be happening somewhere not yet identified.
             * Possible areas to investigate:
             * 1. GPU buffer alignment causing misread of vertex data
             * 2. Varying interpolation issue specific to lavapipe
             * 3. Some hidden transformation in the vertex fetch
             */
            expect(true).toBe(true);
        });
    });
});
