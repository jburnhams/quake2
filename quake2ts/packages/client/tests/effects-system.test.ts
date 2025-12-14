
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { ClientEffectSystem } from '../src/effects-system.js';
import { DynamicLightManager } from '@quake2ts/engine';
import { EngineImports, EntityState } from '@quake2ts/engine';
import { MZ_BLASTER, MZ_ROCKET, MZ_SHOTGUN, MZ_GRENADE, MZ_RAILGUN } from '@quake2ts/shared';
import { Vec3 } from '@quake2ts/shared';

// Mock dependencies
const mockDLightManager = {
    addLight: vi.fn(),
    getActiveLights: vi.fn().mockReturnValue([]),
    update: vi.fn(),
    clear: vi.fn()
};

const mockAudio = {
    soundindex: vi.fn().mockReturnValue(1),
    positioned_sound: vi.fn(),
    sound: vi.fn()
};

const mockEngine: EngineImports = {
    trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }),
    audio: mockAudio as any,
    assets: {
        getModel: vi.fn()
    } as any
};

const mockEntityProvider = {
    getEntity: vi.fn(),
    getPlayerNum: vi.fn().mockReturnValue(0)
};

const mockConfigStrings = {
    getModelName: vi.fn()
};

// Mock Math.random to avoid jitter in tests
const originalRandom = Math.random;

describe('ClientEffectSystem', () => {
    let effectSystem: ClientEffectSystem;

    beforeEach(() => {
        vi.clearAllMocks();
        // Override random to return 0.6 so that (0.6 < 0.5) is false
        // This prevents the radius jitter branch: `if (Math.random() < 0.5) radius += ...`
        Math.random = () => 0.6;

        effectSystem = new ClientEffectSystem(
            mockDLightManager as any,
            mockEngine,
            mockEntityProvider,
            mockConfigStrings as any
        );
    });

    afterAll(() => {
        Math.random = originalRandom;
    });

    it('should add a light and play sound for Blaster muzzle flash', () => {
        const ent: EntityState = {
            origin: { x: 100, y: 100, z: 100 },
            angles: { x: 0, y: 0, z: 0 },
        } as any;

        mockEntityProvider.getEntity.mockReturnValue(ent);

        effectSystem.onMuzzleFlash(1, MZ_BLASTER, 1.0);

        expect(mockDLightManager.addLight).toHaveBeenCalled();
        const callArgs = mockDLightManager.addLight.mock.calls[0][0];
        expect(callArgs.key).toBe(1);
        expect(callArgs.intensity).toBe(150);
        expect(callArgs.color).toEqual({ x: 1, y: 1, z: 0 });

        expect(mockAudio.positioned_sound).not.toHaveBeenCalled();
        expect(mockAudio.sound).toHaveBeenCalled();
    });

    it('should calculate correct flash origin based on offsets', () => {
         const ent: EntityState = {
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
        } as any;

        mockEntityProvider.getEntity.mockReturnValue(ent);

        effectSystem.onMuzzleFlash(1, MZ_BLASTER, 1.0);

        const callArgs = mockDLightManager.addLight.mock.calls[0][0];
        // Blaster offset defined as { x: 24, y: 8, z: 0 }
        expect(callArgs.origin).not.toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should use different properties for different weapons', () => {
        const ent: EntityState = {
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
        } as any;
        mockEntityProvider.getEntity.mockReturnValue(ent);

        // Test Rocket
        effectSystem.onMuzzleFlash(1, MZ_ROCKET, 1.0);
        const rocketArgs = mockDLightManager.addLight.mock.calls[0][0];
        expect(rocketArgs.intensity).toBe(300);
        expect(rocketArgs.color).toEqual({ x: 1, y: 0.5, z: 0.2 });

        vi.clearAllMocks();

        // Test Railgun (should have longer duration)
        effectSystem.onMuzzleFlash(1, MZ_RAILGUN, 1.0);
        const railArgs = mockDLightManager.addLight.mock.calls[0][0];
        expect(railArgs.intensity).toBe(150);
        expect(railArgs.die - 1.0).toBeCloseTo(0.15); // Duration check
    });

    it('should handle missing entity gracefully', () => {
        mockEntityProvider.getEntity.mockReturnValue(undefined);
        effectSystem.onMuzzleFlash(1, MZ_BLASTER, 1.0);
        expect(mockDLightManager.addLight).not.toHaveBeenCalled();
    });
});
