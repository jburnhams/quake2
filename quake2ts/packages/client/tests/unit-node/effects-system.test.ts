
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { ClientEffectSystem } from '@quake2ts/client/effects-system.js';
import { EngineImports, EntityState } from '@quake2ts/engine';
import { MZ_BLASTER, MZ_ROCKET, MZ_SHOTGUN, MZ_GRENADE, MZ_RAILGUN, TempEntity } from '@quake2ts/shared';
import { createMockDLightManager } from '@quake2ts/test-utils';

// Hoist mocks
const mocks = vi.hoisted(() => ({
    spawnRailTrail: vi.fn(),
    spawnSparks: vi.fn(),
    spawnBlasterImpact: vi.fn(),
    spawnBfgExplosion: vi.fn(),
    spawnBulletImpact: vi.fn(),
    spawnExplosion: vi.fn(),
    spawnBlood: vi.fn(),
    spawnMuzzleFlash: vi.fn(),
    spawnTrail: vi.fn(),
    spawnSplash: vi.fn(),
    spawnSteam: vi.fn()
}));

// Mock engine with particle system mocks exposed via import
vi.mock('@quake2ts/engine', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as any,
        spawnRailTrail: mocks.spawnRailTrail,
        spawnSparks: mocks.spawnSparks,
        spawnBlasterImpact: mocks.spawnBlasterImpact,
        spawnBfgExplosion: mocks.spawnBfgExplosion,
        spawnBulletImpact: mocks.spawnBulletImpact,
        spawnExplosion: mocks.spawnExplosion,
        spawnBlood: mocks.spawnBlood,
        spawnMuzzleFlash: mocks.spawnMuzzleFlash,
        spawnTrail: mocks.spawnTrail,
        spawnSplash: mocks.spawnSplash,
        spawnSteam: mocks.spawnSteam
    };
});

// Use createMockDLightManager from test-utils
const mockDLightManager = createMockDLightManager();

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
    } as any,
    renderer: {
        particleSystem: {} as any // Just need truthy object for checks
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
        mocks.spawnRailTrail.mockClear();
        mocks.spawnSparks.mockClear();
        mocks.spawnBlasterImpact.mockClear();
        mocks.spawnBfgExplosion.mockClear();

        // Override random to return 0.6 so that (0.6 < 0.5) is false
        // This prevents the radius jitter branch: `if (Math.random() < 0.5) radius += ...`
        Math.random = () => 0.6;

        effectSystem = new ClientEffectSystem(
            mockDLightManager,
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

    // New tests for particles
    it('should spawn railgun trail', () => {
        const start = { x: 0, y: 0, z: 0 };
        const end = { x: 100, y: 0, z: 0 };
        effectSystem.onTempEntity(TempEntity.RAILTRAIL, start, 1.0, undefined, end);

        expect(mocks.spawnRailTrail).toHaveBeenCalled();
        const args = mocks.spawnRailTrail.mock.calls[0][0];
        expect(args.start).toEqual(start);
        expect(args.end).toEqual(end);
    });

    it('should spawn blaster impact', () => {
        const pos = { x: 10, y: 20, z: 30 };
        effectSystem.onTempEntity(TempEntity.BLASTER, pos, 1.0);

        expect(mocks.spawnBlasterImpact).toHaveBeenCalled();
        const args = mocks.spawnBlasterImpact.mock.calls[0][0];
        expect(args.origin).toEqual(pos);
        expect(args.color).toEqual([1.0, 1.0, 0.0, 1.0]); // Yellow
    });

    it('should spawn blue blaster impact', () => {
        const pos = { x: 10, y: 20, z: 30 };
        effectSystem.onTempEntity(TempEntity.BLUEHYPERBLASTER, pos, 1.0);

        expect(mocks.spawnBlasterImpact).toHaveBeenCalled();
        const args = mocks.spawnBlasterImpact.mock.calls[0][0];
        expect(args.origin).toEqual(pos);
        expect(args.color).toEqual([0.0, 0.0, 1.0, 1.0]); // Blue
    });

    it('should spawn sparks', () => {
        const pos = { x: 10, y: 20, z: 30 };
        const dir = { x: 0, y: 1, z: 0 };
        effectSystem.onTempEntity(TempEntity.SPARKS, pos, 1.0, dir);

        expect(mocks.spawnSparks).toHaveBeenCalled();
        const args = mocks.spawnSparks.mock.calls[0][0];
        expect(args.origin).toEqual(pos);
        expect(args.normal).toEqual(dir);
    });

    it('should spawn BFG explosion', () => {
        const pos = { x: 50, y: 50, z: 50 };
        effectSystem.onTempEntity(TempEntity.BFG_EXPLOSION, pos, 1.0);

        expect(mocks.spawnBfgExplosion).toHaveBeenCalled();
        const args = mocks.spawnBfgExplosion.mock.calls[0][0];
        expect(args.origin).toEqual(pos);
    });
});
