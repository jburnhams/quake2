import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamicLightManager, DLight } from '../../../src/render/dlight.js';

describe('DynamicLightManager', () => {
    let manager: DynamicLightManager;

    beforeEach(() => {
        manager = new DynamicLightManager();
    });

    it('should add and retrieve lights', () => {
        const light: DLight = {
            origin: { x: 0, y: 0, z: 0 },
            color: { x: 1, y: 1, z: 1 },
            intensity: 100,
            die: 10.0
        };

        manager.addLight(light, 0);
        expect(manager.getActiveLights()).toContain(light);
    });

    it('should update existing light with same key', () => {
        const light1: DLight = {
            key: 1,
            origin: { x: 0, y: 0, z: 0 },
            color: { x: 1, y: 1, z: 1 },
            intensity: 100,
            die: 10.0
        };
        const light2: DLight = {
            key: 1,
            origin: { x: 10, y: 10, z: 10 },
            color: { x: 0, y: 0, z: 0 },
            intensity: 200,
            die: 11.0
        };

        manager.addLight(light1, 0);
        expect(manager.getActiveLights()[0]).toBe(light1);

        manager.addLight(light2, 0);
        expect(manager.getActiveLights()).toHaveLength(1);
        expect(manager.getActiveLights()[0]).toBe(light2);
    });

    it('should remove expired lights', () => {
        const light: DLight = {
            origin: { x: 0, y: 0, z: 0 },
            color: { x: 1, y: 1, z: 1 },
            intensity: 100,
            die: 5.0
        };

        manager.addLight(light, 0);

        manager.update(4.0, 0.1);
        expect(manager.getActiveLights()).toContain(light);

        manager.update(5.1, 0.1);
        expect(manager.getActiveLights()).toHaveLength(0);
    });

    it('should animate light radius (intensity)', () => {
        const light: DLight = {
            origin: { x: 0, y: 0, z: 0 },
            color: { x: 1, y: 1, z: 1 },
            intensity: 100,
            radiusSpeed: 50, // +50 units/sec
            die: 10.0
        };

        manager.addLight(light, 0);

        // Update by 0.5 seconds
        manager.update(1.0, 0.5);

        const active = manager.getActiveLights()[0];
        expect(active.intensity).toBe(125); // 100 + 50*0.5
    });

    it('should animate light decay', () => {
        const light: DLight = {
            origin: { x: 0, y: 0, z: 0 },
            color: { x: 1, y: 1, z: 1 },
            intensity: 200,
            radiusSpeed: -100, // -100 units/sec
            die: 10.0
        };

        manager.addLight(light, 0);

        manager.update(1.0, 1.0);
        const active = manager.getActiveLights()[0];
        expect(active.intensity).toBe(100); // 200 - 100*1.0
    });

    it('should clamp intensity at 0', () => {
         const light: DLight = {
            origin: { x: 0, y: 0, z: 0 },
            color: { x: 1, y: 1, z: 1 },
            intensity: 100,
            radiusSpeed: -200, // Very fast decay
            die: 10.0
        };
        manager.addLight(light, 0);
        manager.update(1.0, 1.0);
        const active = manager.getActiveLights()[0];
        expect(active.intensity).toBe(0);
    });
});
