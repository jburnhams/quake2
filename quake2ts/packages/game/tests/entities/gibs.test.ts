import { describe, it, expect, vi } from 'vitest';
import { spawnGib, throwGibs } from '../../src/entities/gibs.js';
import { EntitySystem } from '../../src/entities/system.js';
import type { GameEngine } from '../../src/index.js';

describe('Gibs', () => {
    it('should spawn gibs with correct properties', () => {
        const mockEngine: GameEngine = {
            modelIndex: vi.fn().mockReturnValue(1),
        } as any;

        const mockImports = {
            trace: vi.fn(),
            pointcontents: vi.fn(),
            linkentity: vi.fn(),
            multicast: vi.fn(),
            unicast: vi.fn(),
        };

        const system = new EntitySystem(mockEngine, mockImports as any);

        // Mock sys.spawn to return a dummy entity
        const mockEntity = {
            index: 1,
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            avelocity: { x: 0, y: 0, z: 0 },
            mins: { x: 0, y: 0, z: 0 },
            maxs: { x: 0, y: 0, z: 0 },
            inUse: true,
        };
        const spawnSpy = vi.spyOn(system, 'spawn').mockReturnValue(mockEntity as any);
        const finalizeSpy = vi.spyOn(system, 'finalizeSpawn');
        const scheduleThinkSpy = vi.spyOn(system, 'scheduleThink');

        spawnGib(system, { x: 10, y: 20, z: 30 }, 50);

        expect(spawnSpy).toHaveBeenCalled();
        expect(finalizeSpy).toHaveBeenCalledWith(mockEntity);
        expect(scheduleThinkSpy).toHaveBeenCalledWith(mockEntity, expect.any(Number));
        expect(mockEntity.origin).not.toEqual({ x: 10, y: 20, z: 30 }); // Should be randomized
        expect(mockEngine.modelIndex).toHaveBeenCalled();
    });

    it('should throw multiple gibs', () => {
        const mockEngine: GameEngine = {
            modelIndex: vi.fn().mockReturnValue(1),
        } as any;

        const mockImports = {
            trace: vi.fn(),
            pointcontents: vi.fn(),
            linkentity: vi.fn(),
            multicast: vi.fn(),
            unicast: vi.fn(),
        };

        const system = new EntitySystem(mockEngine, mockImports as any);
        const spawnSpy = vi.spyOn(system, 'spawn').mockReturnValue({} as any);

        throwGibs(system, { x: 0, y: 0, z: 0 }, 100);

        expect(spawnSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
    });
});
