import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SP_monster_infantry } from '../../../src/entities/monsters/infantry.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import * as aiIndex from '../../../src/ai/index.js';

vi.mock('../../../src/ai/index.js', async (importOriginal) => {
    const actual = await importOriginal<typeof aiIndex>();
    return {
        ...actual,
        visible: vi.fn(),
    };
});

describe('monster_infantry dodge', () => {
    let sys: EntitySystem;
    let context: SpawnContext;
    let infantry: Entity;

    beforeEach(() => {
        sys = {
            spawn: () => new Entity(1),
            modelIndex: (s: string) => 1,
            timeSeconds: 10,
            multicast: vi.fn(),
            trace: vi.fn(),
            engine: { sound: vi.fn() },
        } as unknown as EntitySystem;

        context = {
            entities: sys,
        } as unknown as SpawnContext;

        infantry = new Entity(1);
        SP_monster_infantry(infantry, context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('dodges when random check passes', () => {
        infantry.enemy = new Entity(2);
        infantry.enemy.health = 100;

        // Mock random to be < 0.3 (0.1)
        vi.spyOn(Math, 'random').mockReturnValue(0.1);

        const result = infantry.monsterinfo.checkattack!(infantry, sys);

        expect(result).toBe(true);
        // Duck move firstframe is 90
        expect(infantry.monsterinfo.current_move?.firstframe).toBe(90);
    });

    it('does not dodge when random check fails', () => {
        infantry.enemy = new Entity(2);
        infantry.enemy.health = 100;

        // Mock random to be > 0.3 (0.5)
        // Also force second random check (for attack) to be > 0.2 (0.9) to fail attack too
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const result = infantry.monsterinfo.checkattack!(infantry, sys);

        expect(result).toBe(false);
        // Should remain in stand/idle or whatever previous move was
        // Default is stand_move (frame 0)
        expect(infantry.monsterinfo.current_move?.firstframe).toBe(0);
    });

    it('attacks when visible and close', () => {
        infantry.enemy = new Entity(2);
        infantry.enemy.health = 100;
        infantry.enemy.origin = { x: 100, y: 0, z: 0 }; // Close
        infantry.origin = { x: 0, y: 0, z: 0 };

        // Mock visible to return true
        vi.mocked(aiIndex.visible).mockReturnValue(true);

        // Random > 0.3 (fail dodge), < 0.2 (pass attack)
        const randomSpy = vi.spyOn(Math, 'random');
        randomSpy.mockReturnValueOnce(0.5); // Fail dodge
        randomSpy.mockReturnValueOnce(0.1); // Pass attack

        const result = infantry.monsterinfo.checkattack!(infantry, sys);

        expect(result).toBe(true);
        // Attack move firstframe is 45
        expect(infantry.monsterinfo.current_move?.firstframe).toBe(45);
    });
});
