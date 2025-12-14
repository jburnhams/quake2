import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientEffectSystem, EntityProvider } from '../src/effects-system.js';
import { DynamicLightManager, EngineImports, EntityState, AudioApi } from '@quake2ts/engine';
import { MZ_BLASTER, MZ_ROCKET, MZ_MACHINEGUN, TempEntity } from '@quake2ts/shared';

// Mocks
const mockAudio = {
    soundindex: vi.fn().mockImplementation((name) => name === 'invalid' ? 0 : 1),
    sound: vi.fn(),
    positioned_sound: vi.fn()
} as unknown as AudioApi;

const mockEngine: EngineImports = {
    audio: mockAudio,
    trace: vi.fn(),
};

const mockDLightManager = {
    addLight: vi.fn(),
} as unknown as DynamicLightManager;

const mockEntityProvider: EntityProvider = {
    getEntity: vi.fn(),
    getPlayerNum: vi.fn().mockReturnValue(0)
};

describe('ClientEffectSystem', () => {
    let system: ClientEffectSystem;

    beforeEach(() => {
        vi.clearAllMocks();
        system = new ClientEffectSystem(mockDLightManager, mockEngine, mockEntityProvider);
    });

    describe('onMuzzleFlash', () => {
        it('should add a yellow dlight and play sound for Blaster', () => {
            const ent: EntityState = {
                number: 1,
                origin: { x: 100, y: 100, z: 100 },
                angles: { x: 0, y: 0, z: 0 },
            } as any;

            vi.mocked(mockEntityProvider.getEntity).mockReturnValue(ent);

            system.onMuzzleFlash(1, MZ_BLASTER, 10.0);

            // Verify DLight
            expect(mockDLightManager.addLight).toHaveBeenCalled();
            const lightCall = vi.mocked(mockDLightManager.addLight).mock.calls[0][0];
            expect(lightCall.key).toBe(1);
            expect(lightCall.color).toEqual({ x: 1, y: 1, z: 0 }); // Yellow
            expect(lightCall.intensity).toBeGreaterThan(100);
            expect(lightCall.die).toBeCloseTo(10.1);

            // Verify Sound
            expect(mockAudio.soundindex).toHaveBeenCalledWith('weapons/blastf1a.wav');
            expect(mockAudio.sound).toHaveBeenCalledWith(1, 0, 1, 1.0, 1.0, 0);
        });

        it('should handle silenced weapons with reduced volume and radius', () => {
            const ent: EntityState = {
                number: 2,
                origin: { x: 0, y: 0, z: 0 },
                angles: { x: 0, y: 0, z: 0 },
            } as any;
            vi.mocked(mockEntityProvider.getEntity).mockReturnValue(ent);

            // MZ_MACHINEGUN | 128 (Silenced bit)
            system.onMuzzleFlash(2, MZ_MACHINEGUN | 128, 5.0);

            // Verify Sound Volume
            expect(mockAudio.sound).toHaveBeenCalledWith(2, 0, 1, 0.2, 1.0, 0);
        });
    });

    describe('onTempEntity', () => {
        it('should spawn explosion light and sound', () => {
            const pos = { x: 50, y: 50, z: 50 };
            system.onTempEntity(TempEntity.EXPLOSION1, pos, 20.0);

            // Verify DLight
            expect(mockDLightManager.addLight).toHaveBeenCalled();
            const lightCall = vi.mocked(mockDLightManager.addLight).mock.calls[0][0];
            expect(lightCall.color).toEqual({ x: 1, y: 0.5, z: 0.2 }); // Orange
            expect(lightCall.die).toBe(20.5);

            // Verify Sound
            expect(mockAudio.positioned_sound).toHaveBeenCalledWith(pos, 1, 1.0, 0.5);
        });
    });
});
