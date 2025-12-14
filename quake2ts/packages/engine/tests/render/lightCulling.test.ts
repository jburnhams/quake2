import { describe, it, expect } from 'vitest';
import { cullLights } from '../../src/render/lightCulling.js';
import { DLight } from '../../src/render/dlight.js';
import { FrustumPlane } from '../../src/render/culling.js';

describe('cullLights', () => {
    // Define a simple frustum:
    // Left: x >= -10
    // Right: x <= 10
    // Front: z <= -1
    // Back: z >= -20
    // Top: y <= 10
    // Bottom: y >= -10

    // Planes point inward. P . N + D >= 0
    // x >= -10  =>  x + 10 >= 0  => N=(1,0,0), D=10
    // x <= 10   => -x + 10 >= 0  => N=(-1,0,0), D=10
    // z <= -1   => -z - 1 >= 0   => N=(0,0,-1), D=-1 (Points towards -z)
    // z >= -20  => z + 20 >= 0   => N=(0,0,1), D=20

    const planes: FrustumPlane[] = [
        { normal: { x: 1, y: 0, z: 0 }, distance: 10 },
        { normal: { x: -1, y: 0, z: 0 }, distance: 10 },
        { normal: { x: 0, y: 1, z: 0 }, distance: 10 },
        { normal: { x: 0, y: -1, z: 0 }, distance: 10 },
        { normal: { x: 0, y: 0, z: -1 }, distance: -1 },
        { normal: { x: 0, y: 0, z: 1 }, distance: 20 },
    ];

    const createLight = (x: number, y: number, z: number, intensity: number): DLight => ({
        origin: { x, y, z },
        color: { x: 1, y: 1, z: 1 },
        intensity,
        die: 1000
    });

    it('should include lights inside the frustum', () => {
        const light = createLight(0, 0, -10, 5); // Inside
        const result = cullLights([light], planes);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(light);
    });

    it('should include lights intersecting the frustum', () => {
        // Light center at x = -12. Plane is x >= -10. Distance to plane: -12 + 10 = -2.
        // Radius 5. -2 > -5, so visible.
        const light = createLight(-12, 0, -10, 5);
        const result = cullLights([light], planes);
        expect(result).toHaveLength(1);
    });

    it('should exclude lights outside the frustum', () => {
        // Light center at x = -20. Plane is x >= -10. Dist: -20 + 10 = -10.
        // Radius 5. -10 < -5, so invisible.
        const light = createLight(-20, 0, -10, 5);
        const result = cullLights([light], planes);
        expect(result).toHaveLength(0);
    });

    it('should sort lights by distance if camera position is provided', () => {
        const farLight = createLight(0, 0, -15, 5);
        const nearLight = createLight(0, 0, -5, 5);
        const cameraPos = { x: 0, y: 0, z: 0 };

        const result = cullLights([farLight, nearLight], planes, cameraPos);
        expect(result).toHaveLength(2);
        expect(result[0]).toBe(nearLight);
        expect(result[1]).toBe(farLight);
    });

    it('should respect maxLights limit', () => {
        const lights: DLight[] = [];
        for(let i=0; i<10; i++) {
            lights.push(createLight(0, 0, -5 - i, 5));
        }

        // Should return 3 closest lights
        const cameraPos = { x: 0, y: 0, z: 0 };
        const result = cullLights(lights, planes, cameraPos, 3);

        expect(result).toHaveLength(3);
        expect(result[0].origin.z).toBe(-5);
        expect(result[1].origin.z).toBe(-6);
        expect(result[2].origin.z).toBe(-7);
    });
});
