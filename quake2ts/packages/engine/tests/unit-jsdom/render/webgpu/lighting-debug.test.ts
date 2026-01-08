import { describe, it, expect } from 'vitest';

/**
 * Debug test to help identify the coordinate mismatch issue
 *
 * The lights appear in the bottom-right corner instead of center.
 * This test helps identify where the coordinate transform is happening.
 */

describe('WebGPU Lighting Position Debug', () => {
    describe('Wall Test Analysis', () => {
        it('should identify the coordinate offset pattern', () => {
            // Expected: Light at center
            const expectedLight = { x: 180, y: 0, z: 100 };
            const expectedWallCenter = { x: 200, y: 0, z: 100 };

            // Actual: Light appears at bottom-right
            const actualIlluminatedPoint = { x: 200, y: 200, z: -100 };

            // Calculate offset
            const offset = {
                x: actualIlluminatedPoint.x - expectedWallCenter.x,
                y: actualIlluminatedPoint.y - expectedWallCenter.y,
                z: actualIlluminatedPoint.z - expectedWallCenter.z
            };

            console.log('Wall test offset:', offset);
            expect(offset.x).toBe(0);   // No X offset (wall is flat in X)
            expect(offset.y).toBe(200); // Y offset = +200
            expect(offset.z).toBe(-200); // Z offset = -200

            // Wall bounds
            const wallBounds = {
                min: { x: 200, y: -200, z: -100 },
                max: { x: 200, y: 200, z: 300 }
            };

            // Check if offset relates to bounds
            const halfSize = {
                y: (wallBounds.max.y - wallBounds.min.y) / 2, // 200
                z: (wallBounds.max.z - wallBounds.min.z) / 2  // 200
            };

            expect(offset.y).toBe(halfSize.y);   // Y offset = half height
            expect(Math.abs(offset.z)).toBe(halfSize.z); // Z offset = half width
        });
    });

    describe('Potential Root Causes', () => {
        it('Test 1: Are coordinates being offset by bounding box center?', () => {
            // If coordinates are relative to bbox center:
            const wallMin = { x: 200, y: -200, z: -100 };
            const wallMax = { x: 200, y: 200, z: 300 };

            const bboxCenter = {
                x: (wallMin.x + wallMax.x) / 2, // 200
                y: (wallMin.y + wallMax.y) / 2, // 0
                z: (wallMin.z + wallMax.z) / 2  // 100
            };

            // If light at (180, 0, 100) is interpreted relative to bbox center (200, 0, 100):
            const lightRelativeToBbox = {
                x: 180 - bboxCenter.x, // -20
                y: 0 - bboxCenter.y,   // 0
                z: 100 - bboxCenter.z  // 0
            };

            // Then vertices at (200, 0, 100) relative to bbox are:
            const vertexRelativeToBbox = {
                x: 200 - bboxCenter.x, // 0
                y: 0 - bboxCenter.y,   // 0
                z: 100 - bboxCenter.z  // 0
            };

            // But vertex at (200, 200, -100) relative to bbox is:
            const bottomRightRelativeToBbox = {
                x: 200 - bboxCenter.x,  // 0
                y: 200 - bboxCenter.y,  // 200
                z: -100 - bboxCenter.z  // -200
            };

            console.log('Light relative to bbox:', lightRelativeToBbox);
            console.log('Center vertex relative to bbox:', vertexRelativeToBbox);
            console.log('Bottom-right vertex relative to bbox:', bottomRightRelativeToBbox);

            // This doesn't explain the issue - the center vertex is still closest
            const distToCenter = Math.sqrt(
                Math.pow(lightRelativeToBbox.x - vertexRelativeToBbox.x, 2) +
                Math.pow(lightRelativeToBbox.y - vertexRelativeToBbox.y, 2) +
                Math.pow(lightRelativeToBbox.z - vertexRelativeToBbox.z, 2)
            );

            const distToBottomRight = Math.sqrt(
                Math.pow(lightRelativeToBbox.x - bottomRightRelativeToBbox.x, 2) +
                Math.pow(lightRelativeToBbox.y - bottomRightRelativeToBbox.y, 2) +
                Math.pow(lightRelativeToBbox.z - bottomRightRelativeToBbox.z, 2)
            );

            expect(distToCenter).toBeLessThan(distToBottomRight);
        });

        it('Test 2: Are Y and Z coordinates swapped in upload?', () => {
            const light = { x: 180, y: 0, z: 100 };

            // If Y and Z are swapped during upload:
            const swappedLight = { x: 180, y: 100, z: 0 };

            // Then comparing with wall vertex at (200, 200, -100):
            const vertex = { x: 200, y: 200, z: -100 };

            const dist = Math.sqrt(
                Math.pow(swappedLight.x - vertex.x, 2) +
                Math.pow(swappedLight.y - vertex.y, 2) +
                Math.pow(swappedLight.z - vertex.z, 2)
            );

            console.log('Distance with Y/Z swap:', dist);

            // Distance ≈ sqrt(20² + 100² + 100²) ≈ 143
            // This is still less than 150 (intensity), so it would illuminate

            // But the correct center at (200, 0, 100):
            const centerVertex = { x: 200, y: 0, z: 100 };
            const distToCenter = Math.sqrt(
                Math.pow(swappedLight.x - centerVertex.x, 2) +
                Math.pow(swappedLight.y - centerVertex.y, 2) +
                Math.pow(swappedLight.z - centerVertex.z, 2)
            );

            console.log('Distance to center with Y/Z swap:', distToCenter);

            // With swap: distance to center ≈ sqrt(20² + 100² + 100²) = 143
            // But we want distance of 20!

            expect(distToCenter).not.toBeCloseTo(20, 1);
        });

        it('Test 3: Are vertices being offset by mins in upload?', () => {
            // What if vertices are uploaded as (vertex - min)?
            const wallMin = { x: 200, y: -200, z: -100 };
            const lightActual = { x: 180, y: 0, z: 100 };

            // Light relative to min:
            const lightRelativeToMin = {
                x: lightActual.x - wallMin.x,  // -20
                y: lightActual.y - wallMin.y,  // 200
                z: lightActual.z - wallMin.z   // 200
            };

            // Center vertex (200, 0, 100) relative to min:
            const centerRelativeToMin = {
                x: 200 - wallMin.x,  // 0
                y: 0 - wallMin.y,    // 200
                z: 100 - wallMin.z   // 200
            };

            // Bottom-right vertex (200, 200, -100) relative to min:
            const bottomRightRelativeToMin = {
                x: 200 - wallMin.x,   // 0
                y: 200 - wallMin.y,   // 400
                z: -100 - wallMin.z   // 0
            };

            console.log('Light rel to min:', lightRelativeToMin);
            console.log('Center rel to min:', centerRelativeToMin);
            console.log('Bottom-right rel to min:', bottomRightRelativeToMin);

            // Distance from light to center:
            const distToCenter = Math.sqrt(
                Math.pow(-20 - 0, 2) +
                Math.pow(200 - 200, 2) +
                Math.pow(200 - 200, 2)
            );

            // Distance from light to bottom-right:
            const distToBottomRight = Math.sqrt(
                Math.pow(-20 - 0, 2) +
                Math.pow(200 - 400, 2) +
                Math.pow(200 - 0, 2)
            );

            console.log('Dist to center (rel to min):', distToCenter);
            console.log('Dist to bottom-right (rel to min):', distToBottomRight);

            expect(distToCenter).toBeCloseTo(20, 1);
            expect(distToBottomRight).toBeGreaterThan(distToCenter);

            // This still shows center is closer!
        });

        it('Test 4: Check if light position has +min offset but vertices dont', () => { // Hypothesis failed: light position + min offset does not explain the issue
            const wallMin = { x: 200, y: -200, z: -100 };
            const lightActual = { x: 180, y: 0, z: 100 };

            // What if light is uploaded as (light + min)?
            const lightWithMinOffset = {
                x: lightActual.x + wallMin.x,  // 380
                y: lightActual.y + wallMin.y,  // -200
                z: lightActual.z + wallMin.z   // 0
            };

            // And vertices are uploaded as absolute:
            const centerVertex = { x: 200, y: 0, z: 100 };
            const bottomRightVertex = { x: 200, y: 200, z: -100 };

            const distToCenter = Math.sqrt(
                Math.pow(lightWithMinOffset.x - centerVertex.x, 2) +
                Math.pow(lightWithMinOffset.y - centerVertex.y, 2) +
                Math.pow(lightWithMinOffset.z - centerVertex.z, 2)
            );

            const distToBottomRight = Math.sqrt(
                Math.pow(lightWithMinOffset.x - bottomRightVertex.x, 2) +
                Math.pow(lightWithMinOffset.y - bottomRightVertex.y, 2) +
                Math.pow(lightWithMinOffset.z - bottomRightVertex.z, 2)
            );

            console.log('Light with +min offset:', lightWithMinOffset);
            console.log('Dist to center:', distToCenter);
            console.log('Dist to bottom-right:', distToBottomRight);

            // Hypothesis: If this was the cause, distToBottomRight would be less than distToCenter.
            // Result: 449.8 vs 287.0.
            // Conclusion: This hypothesis is incorrect.
            expect(distToBottomRight).not.toBeLessThan(distToCenter);
        });
    });
});
