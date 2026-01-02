import { describe, it, expect } from 'vitest';

/**
 * Unit tests for lighting coordinate transformation
 *
 * Background: WebGPU uses Quake-to-GL coordinate transform in the view matrix
 * (applied via Camera.viewProjectionMatrix). The vertices are in Quake space,
 * but after transformation they're in GL space. Dynamic lights (dlights) are
 * also specified in Quake space, so they need the same transform to match.
 *
 * Coordinate mappings:
 * - Quake X (forward) → GL -Z
 * - Quake Y (left) → GL -X
 * - Quake Z (up) → GL Y
 */

describe('WebGPU Lighting Coordinate Transform', () => {
    /**
     * Transform a Quake-space position to GL-space
     * This is the same transform applied in bspPipeline.ts
     */
    function quakeToGL(quake: { x: number; y: number; z: number }) {
        return {
            x: -quake.y,  // GL X = -Quake Y
            y: quake.z,   // GL Y = Quake Z
            z: -quake.x   // GL Z = -Quake X
        };
    }

    it('should transform light at Quake origin correctly', () => {
        const quakePos = { x: 0, y: 0, z: 0 };
        const glPos = quakeToGL(quakePos);

        expect(Math.abs(glPos.x)).toBe(0);
        expect(Math.abs(glPos.y)).toBe(0);
        expect(Math.abs(glPos.z)).toBe(0);
    });

    it('should transform Quake X (forward) to GL -Z', () => {
        const quakePos = { x: 100, y: 0, z: 0 };
        const glPos = quakeToGL(quakePos);

        expect(Math.abs(glPos.x)).toBe(0);
        expect(Math.abs(glPos.y)).toBe(0);
        expect(glPos.z).toBe(-100);
    });

    it('should transform Quake Y (left) to GL -X', () => {
        const quakePos = { x: 0, y: 100, z: 0 };
        const glPos = quakeToGL(quakePos);

        expect(glPos.x).toBe(-100);
        expect(Math.abs(glPos.y)).toBe(0);
        expect(Math.abs(glPos.z)).toBe(0);
    });

    it('should transform Quake Z (up) to GL Y', () => {
        const quakePos = { x: 0, y: 0, z: 100 };
        const glPos = quakeToGL(quakePos);

        expect(Math.abs(glPos.x)).toBe(0);
        expect(glPos.y).toBe(100);
        expect(Math.abs(glPos.z)).toBe(0);
    });

    it('should correctly transform wall test light position', () => {
        // From lighting.test.ts - wall test
        // Wall at X=200 (Quake forward), light at X=180 Y=0 Z=100
        const quakeLight = { x: 180, y: 0, z: 100 };
        const glLight = quakeToGL(quakeLight);

        expect(Math.abs(glLight.x)).toBe(0);   // -Y = -0
        expect(glLight.y).toBe(100); // Z = 100
        expect(glLight.z).toBe(-180); // -X = -180

        // Wall in Quake space: X=200, so in GL space: Z=-200
        // Light should be 20 units in front of wall (closer to camera)
        const wallZ = -200;
        expect(glLight.z - wallZ).toBe(20); // Light is 20 units closer
    });

    it('should correctly transform floor test light position', () => {
        // From lighting.test.ts - floor test
        // Floor at Z=0 (Quake up), light at X=0 Y=0 Z=50
        const quakeLight = { x: 0, y: 0, z: 50 };
        const glLight = quakeToGL(quakeLight);

        expect(Math.abs(glLight.x)).toBe(0);  // -Y = -0
        expect(glLight.y).toBe(50); // Z = 50
        expect(Math.abs(glLight.z)).toBe(0);  // -X = -0

        // Floor in Quake space: Z=0, so in GL space: Y=0
        // Light should be 50 units above floor
        const floorY = 0;
        expect(glLight.y - floorY).toBe(50); // Light is 50 units above
    });

    it('should correctly transform multiple lights position', () => {
        // From lighting.test.ts - multiple lights test
        const quakeLight1 = { x: 180, y: -50, z: 100 }; // Red light
        const quakeLight2 = { x: 180, y: 50, z: 100 };  // Blue light

        const glLight1 = quakeToGL(quakeLight1);
        const glLight2 = quakeToGL(quakeLight2);

        // Red light
        expect(glLight1.x).toBe(50);  // -Y = -(-50) = 50
        expect(glLight1.y).toBe(100); // Z = 100
        expect(glLight1.z).toBe(-180); // -X = -180

        // Blue light
        expect(glLight2.x).toBe(-50); // -Y = -(50) = -50
        expect(glLight2.y).toBe(100); // Z = 100
        expect(glLight2.z).toBe(-180); // -X = -180

        // Lights should be symmetric around X=0 (GL space)
        expect(glLight1.x).toBe(-glLight2.x);
        expect(glLight1.y).toBe(glLight2.y);
        expect(glLight1.z).toBe(glLight2.z);
    });

    it('should maintain distance relationships after transform', () => {
        // Distance should be preserved (orthogonal transform)
        const quake1 = { x: 0, y: 0, z: 0 };
        const quake2 = { x: 10, y: 0, z: 0 };

        const gl1 = quakeToGL(quake1);
        const gl2 = quakeToGL(quake2);

        const quakeDist = Math.sqrt(
            Math.pow(quake2.x - quake1.x, 2) +
            Math.pow(quake2.y - quake1.y, 2) +
            Math.pow(quake2.z - quake1.z, 2)
        );

        const glDist = Math.sqrt(
            Math.pow(gl2.x - gl1.x, 2) +
            Math.pow(gl2.y - gl1.y, 2) +
            Math.pow(gl2.z - gl1.z, 2)
        );

        expect(glDist).toBeCloseTo(quakeDist, 5);
    });

    it('should handle negative coordinates correctly', () => {
        const quakePos = { x: -100, y: -50, z: -25 };
        const glPos = quakeToGL(quakePos);

        expect(glPos.x).toBe(50);   // -Y = -(-50) = 50
        expect(glPos.y).toBe(-25);  // Z = -25
        expect(glPos.z).toBe(100);  // -X = -(-100) = 100
    });

    it('should be invertible', () => {
        // The inverse transform: GL → Quake
        function glToQuake(gl: { x: number; y: number; z: number }) {
            return {
                x: -gl.z,  // Quake X = -GL Z
                y: -gl.x,  // Quake Y = -GL X
                z: gl.y    // Quake Z = GL Y
            };
        }

        const original = { x: 123, y: 456, z: 789 };
        const transformed = quakeToGL(original);
        const restored = glToQuake(transformed);

        expect(restored.x).toBeCloseTo(original.x, 5);
        expect(restored.y).toBeCloseTo(original.y, 5);
        expect(restored.z).toBeCloseTo(original.z, 5);
    });
});
