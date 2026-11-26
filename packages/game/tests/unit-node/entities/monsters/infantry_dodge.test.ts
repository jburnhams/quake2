import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SP_monster_infantry } from '../../../../src/entities/monsters/infantry.js';
import { Entity } from '../../../../src/entities/entity.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import * as aiIndex from '../../../../src/ai/index.js';
import { createTestContext, createEntity, TestContext } from '@quake2ts/test-utils';

vi.mock('../../../../src/ai/index.js', async (importOriginal) => {
    const actual = await importOriginal<typeof aiIndex>();
    return {
        ...actual,
        visible: vi.fn(),
    };
});

describe('monster_infantry dodge', () => {
    let context: TestContext;
    let sys: EntitySystem;
    let infantry: Entity;

    beforeEach(() => {
        context = createTestContext();
        sys = context.entities;

        // Ensure rng methods are spies or mockable
        // createTestContext provides a real RNG by default, but we want to control it.
        // We can overwrite it with a mock or spy on it.
        // Since we want strict control over return values, let's mock the methods.
        vi.spyOn(sys.rng, 'frandom');
        vi.spyOn(sys.rng, 'irandom');
        vi.spyOn(sys.rng, 'crandom');

        infantry = createEntity({ index: 1 });
        SP_monster_infantry(infantry, context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('dodges when random check passes', () => {
        infantry.enemy = createEntity({ index: 2, health: 100 });

        // Mock rng to be < 0.3 (0.1)
        vi.mocked(sys.rng.frandom).mockReturnValue(0.1);

        const result = infantry.monsterinfo.checkattack!(infantry, sys);

        expect(result).toBe(true);
        // Duck move firstframe is 90
        expect(infantry.monsterinfo.current_move?.firstframe).toBe(90);
    });

    it('does not dodge when random check fails', () => {
        infantry.enemy = createEntity({ index: 2, health: 100 });

        // Mock rng to be > 0.3 (0.5)
        vi.mocked(sys.rng.frandom).mockReturnValue(0.5);

        const result = infantry.monsterinfo.checkattack!(infantry, sys);

        expect(result).toBe(false);
        // Should remain in stand/idle or whatever previous move was
        // Default is stand_move (frame 0)
        expect(infantry.monsterinfo.current_move?.firstframe).toBe(0);
    });

    it('attacks when visible and close', () => {
        infantry.enemy = createEntity({
            index: 2,
            health: 100,
            origin: { x: 100, y: 0, z: 0 }
        });
        infantry.origin = { x: 0, y: 0, z: 0 };

        // Mock visible to return true
        vi.mocked(aiIndex.visible).mockReturnValue(true);

        // Random > 0.3 (fail dodge), < 0.2 (pass attack)
        vi.mocked(sys.rng.frandom)
            .mockReturnValueOnce(0.5) // Fail dodge
            .mockReturnValueOnce(0.1); // Pass attack

        const result = infantry.monsterinfo.checkattack!(infantry, sys);

        expect(result).toBe(true);
        // Attack move firstframe is 45
        expect(infantry.monsterinfo.current_move?.firstframe).toBe(45);
    });
});
