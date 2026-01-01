import { describe, it, expect } from 'vitest';
import { DLight } from '../../../../src/render/dlight.js';

/**
 * Unit tests for lighting calculation logic
 *
 * These tests verify the lighting calculations work correctly without
 * requiring visual snapshot comparisons. They test the core logic from
 * the BSP shader's lighting calculations.
 */

describe('WebGPU Lighting Calculations', () => {
    /**
     * Mimics the shader's distance-based lighting calculation
     * From bsp.wgsl lines 125-137
     */
    function calculateDynamicLighting(
        worldPos: { x: number; y: number; z: number },
        dlights: DLight[],
        ambient: number = 0.0
    ): { r: number; g: number; b: number } {
        let totalLight = { r: ambient, g: ambient, b: ambient };

        for (const dlight of dlights) {
            const dist = Math.sqrt(
                Math.pow(worldPos.x - dlight.origin.x, 2) +
                Math.pow(worldPos.y - dlight.origin.y, 2) +
                Math.pow(worldPos.z - dlight.origin.z, 2)
            );

            if (dist < dlight.intensity) {
                const contribution = (dlight.intensity - dist) * (1.0 / 255.0);
                totalLight.r += dlight.color.x * contribution;
                totalLight.g += dlight.color.y * contribution;
                totalLight.b += dlight.color.z * contribution;
            }
        }

        return totalLight;
    }

    describe('Single Point Light', () => {
        it('should fully illuminate vertex at light origin', () => {
            const light: DLight = {
                origin: { x: 100, y: 50, z: 75 },
                color: { x: 1, y: 0, z: 0 }, // Red
                intensity: 100,
                die: 0
            };

            const lighting = calculateDynamicLighting(
                { x: 100, y: 50, z: 75 }, // Same position as light
                [light],
                0.0
            );

            // At distance 0, contribution = (100 - 0) / 255 ≈ 0.392
            expect(lighting.r).toBeCloseTo(100 / 255, 3);
            expect(lighting.g).toBe(0);
            expect(lighting.b).toBe(0);
        });

        it('should not illuminate vertex beyond light radius', () => {
            const light: DLight = {
                origin: { x: 0, y: 0, z: 0 },
                color: { x: 1, y: 1, z: 1 },
                intensity: 100,
                die: 0
            };

            const lighting = calculateDynamicLighting(
                { x: 150, y: 0, z: 0 }, // 150 units away, beyond radius
                [light],
                0.1
            );

            // Should only have ambient light
            expect(lighting.r).toBe(0.1);
            expect(lighting.g).toBe(0.1);
            expect(lighting.b).toBe(0.1);
        });

        it('should calculate correct contribution at partial distance', () => {
            const light: DLight = {
                origin: { x: 0, y: 0, z: 0 },
                color: { x: 1, y: 0, z: 0 },
                intensity: 100,
                die: 0
            };

            const lighting = calculateDynamicLighting(
                { x: 50, y: 0, z: 0 }, // 50 units away
                [light],
                0.0
            );

            // contribution = (100 - 50) / 255 ≈ 0.196
            expect(lighting.r).toBeCloseTo(50 / 255, 3);
            expect(lighting.g).toBe(0);
            expect(lighting.b).toBe(0);
        });
    });

    describe('Wall Test Geometry', () => {
        // Wall at X=200, Y∈[-200,200], Z∈[-100,300]
        // Light at (180, 0, 100)
        // Should illuminate center of wall at (200, 0, 100)

        it('should illuminate wall center from nearby light', () => {
            const wallCenter = { x: 200, y: 0, z: 100 };
            const light: DLight = {
                origin: { x: 180, y: 0, z: 100 },
                color: { x: 1, y: 0, z: 0 }, // Red
                intensity: 150,
                die: 0
            };

            const lighting = calculateDynamicLighting(wallCenter, [light], 0.1);

            // Distance = 20 units
            // Contribution = (150 - 20) / 255 ≈ 0.510
            expect(lighting.r).toBeCloseTo((150 - 20) / 255 + 0.1, 2);
            expect(lighting.g).toBeCloseTo(0.1, 2);
            expect(lighting.b).toBeCloseTo(0.1, 2);
        });

        it('should NOT illuminate wall corner as much as center', () => {
            const wallBottomRight = { x: 200, y: 200, z: -100 };
            const light: DLight = {
                origin: { x: 180, y: 0, z: 100 },
                color: { x: 1, y: 0, z: 0 },
                intensity: 150,
                die: 0
            };

            const centerLighting = calculateDynamicLighting(
                { x: 200, y: 0, z: 100 },
                [light],
                0.1
            );
            const cornerLighting = calculateDynamicLighting(wallBottomRight, [light], 0.1);

            // Corner is much farther away, should have less light
            // Distance to corner ≈ sqrt(20² + 200² + 200²) ≈ 283
            // This exceeds intensity, so no contribution
            expect(centerLighting.r).toBeGreaterThan(cornerLighting.r);
            expect(cornerLighting.r).toBeCloseTo(0.1, 2); // Only ambient
        });

        it('should calculate exact distances for wall vertices', () => {
            const light = { x: 180, y: 0, z: 100 };

            // Test various points on the wall
            const vertices = [
                { name: 'center', pos: { x: 200, y: 0, z: 100 }, expectedDist: 20 },
                { name: 'top-center', pos: { x: 200, y: 0, z: 300 }, expectedDist: Math.sqrt(20*20 + 200*200) },
                { name: 'right-center', pos: { x: 200, y: 200, z: 100 }, expectedDist: Math.sqrt(20*20 + 200*200) },
                { name: 'bottom-right', pos: { x: 200, y: 200, z: -100 }, expectedDist: Math.sqrt(20*20 + 200*200 + 200*200) },
            ];

            for (const vertex of vertices) {
                const dist = Math.sqrt(
                    Math.pow(vertex.pos.x - light.x, 2) +
                    Math.pow(vertex.pos.y - light.y, 2) +
                    Math.pow(vertex.pos.z - light.z, 2)
                );
                expect(dist).toBeCloseTo(vertex.expectedDist, 1);
            }
        });
    });

    describe('Multiple Lights', () => {
        it('should blend red and blue lights to create purple', () => {
            const redLight: DLight = {
                origin: { x: 180, y: -50, z: 100 },
                color: { x: 1, y: 0, z: 0 },
                intensity: 100,
                die: 0
            };

            const blueLight: DLight = {
                origin: { x: 180, y: 50, z: 100 },
                color: { x: 0, y: 0, z: 1 },
                intensity: 100,
                die: 0
            };

            // Point equidistant from both lights
            const centerPoint = { x: 200, y: 0, z: 100 };
            const lighting = calculateDynamicLighting(centerPoint, [redLight, blueLight], 0.1);

            // Both lights should contribute equally
            // Distance from each light = sqrt(20² + 50²) ≈ 53.85
            // Contribution each = (100 - 53.85) / 255 ≈ 0.181
            const expectedContribution = (100 - Math.sqrt(20*20 + 50*50)) / 255;

            expect(lighting.r).toBeCloseTo(expectedContribution + 0.1, 2);
            expect(lighting.g).toBeCloseTo(0.1, 2);
            expect(lighting.b).toBeCloseTo(expectedContribution + 0.1, 2);
        });

        it('should have red dominate near red light source', () => {
            const redLight: DLight = {
                origin: { x: 180, y: -50, z: 100 },
                color: { x: 1, y: 0, z: 0 },
                intensity: 100,
                die: 0
            };

            const blueLight: DLight = {
                origin: { x: 180, y: 50, z: 100 },
                color: { x: 0, y: 0, z: 1 },
                intensity: 100,
                die: 0
            };

            // Point closer to red light
            const nearRed = { x: 200, y: -50, z: 100 };
            const lighting = calculateDynamicLighting(nearRed, [redLight, blueLight], 0.1);

            // Should have more red than blue
            expect(lighting.r).toBeGreaterThan(lighting.b);
        });
    });

    describe('Floor Test Geometry', () => {
        // Floor at Z=0, X∈[-200,200], Y∈[-200,200]
        // Light at (0, 0, 50)
        // Should illuminate center of floor at (0, 0, 0)

        it('should illuminate floor center from above', () => {
            const floorCenter = { x: 0, y: 0, z: 0 };
            const light: DLight = {
                origin: { x: 0, y: 0, z: 50 },
                color: { x: 0, y: 1, z: 0 }, // Green
                intensity: 150,
                die: 0
            };

            const lighting = calculateDynamicLighting(floorCenter, [light], 0.0);

            // Distance = 50 units
            // Contribution = (150 - 50) / 255 ≈ 0.392
            expect(lighting.r).toBe(0);
            expect(lighting.g).toBeCloseTo((150 - 50) / 255, 2);
            expect(lighting.b).toBe(0);
        });

        it('should fall off with distance from center', () => {
            const light: DLight = {
                origin: { x: 0, y: 0, z: 50 },
                color: { x: 0, y: 1, z: 0 },
                intensity: 150,
                die: 0
            };

            const center = { x: 0, y: 0, z: 0 };
            const edge = { x: 150, y: 0, z: 0 };

            const centerLighting = calculateDynamicLighting(center, [light], 0.0);
            const edgeLighting = calculateDynamicLighting(edge, [light], 0.0);

            // Distance to edge ≈ sqrt(150² + 50²) ≈ 158, exceeds intensity
            expect(centerLighting.g).toBeGreaterThan(edgeLighting.g);
            expect(edgeLighting.g).toBe(0); // Beyond radius
        });
    });

    describe('Ambient Lighting', () => {
        it('should provide minimum ambient light even without dlights', () => {
            const lighting = calculateDynamicLighting(
                { x: 0, y: 0, z: 0 },
                [],
                0.2
            );

            expect(lighting.r).toBe(0.2);
            expect(lighting.g).toBe(0.2);
            expect(lighting.b).toBe(0.2);
        });

        it('should add ambient to dynamic light', () => {
            const light: DLight = {
                origin: { x: 0, y: 0, z: 0 },
                color: { x: 1, y: 0, z: 0 },
                intensity: 50,
                die: 0
            };

            const lighting = calculateDynamicLighting(
                { x: 25, y: 0, z: 0 },
                [light],
                0.1
            );

            // Dynamic contribution = (50 - 25) / 255 ≈ 0.098
            // Total = 0.1 + 0.098 ≈ 0.198
            expect(lighting.r).toBeCloseTo((50 - 25) / 255 + 0.1, 2);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero intensity light', () => {
            const light: DLight = {
                origin: { x: 0, y: 0, z: 0 },
                color: { x: 1, y: 1, z: 1 },
                intensity: 0,
                die: 0
            };

            const lighting = calculateDynamicLighting(
                { x: 0, y: 0, z: 0 },
                [light],
                0.1
            );

            // Zero intensity means no contribution
            expect(lighting.r).toBe(0.1);
            expect(lighting.g).toBe(0.1);
            expect(lighting.b).toBe(0.1);
        });

        it('should handle light exactly at intensity radius', () => {
            const light: DLight = {
                origin: { x: 0, y: 0, z: 0 },
                color: { x: 1, y: 0, z: 0 },
                intensity: 100,
                die: 0
            };

            const lighting = calculateDynamicLighting(
                { x: 100, y: 0, z: 0 }, // Exactly at radius
                [light],
                0.0
            );

            // At exactly the radius, contribution should be 0
            expect(lighting.r).toBeCloseTo(0, 3);
        });

        it('should handle very large coordinates', () => {
            const light: DLight = {
                origin: { x: 10000, y: 10000, z: 10000 },
                color: { x: 1, y: 1, z: 1 },
                intensity: 100,
                die: 0
            };

            const lighting = calculateDynamicLighting(
                { x: 10050, y: 10000, z: 10000 },
                [light],
                0.0
            );

            // Distance = 50, contribution = (100 - 50) / 255
            expect(lighting.r).toBeCloseTo(50 / 255, 2);
        });
    });
});
