import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_supertank } from '../../../src/entities/monsters/supertank.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { createEntityFactory } from '@quake2ts/test-utils';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity } from '../../../src/entities/entity.js';
import * as attack from '../../../src/entities/monsters/attack.js';

describe('Heat Seeking Missiles (Supertank)', () => {
    let context: ReturnType<typeof createTestContext>;
    let sys: EntitySystem;
    let supertank: Entity;
    let enemy: Entity;

    beforeEach(async () => {
        // Ensure clean slate for spies
        vi.restoreAllMocks();

        context = await createTestContext();
        sys = context.entities;

        supertank = sys.spawn();
        SP_monster_supertank(supertank, context);

        enemy = sys.spawn();
        Object.assign(enemy, createEntityFactory({
            origin: { x: 500, y: 0, z: 0 },
            health: 100
        }));
        supertank.enemy = enemy;
    });

    it('Fires heat seeking missiles when spawnflag is set', () => {
        // Set flag AFTER spawn function, as spawn checks it too but we want to simulate the behavior during attack
        // SP_monster_supertank might set some properties but flags are persistent
        // Wait, SP_monster_supertank sets monsterinfo.checkattack etc.
        // The logic for heat seeking is inside the firing function which checks spawnflags.
        supertank.spawnflags = 8; // SPAWNFLAG_SUPERTANK_POWERSHIELD -> Enables heat seeker

        const spyHeat = vi.spyOn(attack, 'monster_fire_heat');
        const spyRocket = vi.spyOn(attack, 'monster_fire_rocket');

        // Setup state to fire rocket
        // Attack 2 (Rocket): Indices 7, 10, 13 call supertank_fire_rocket
        // Move frames 120-146. Frame 127 corresponds to index 7?
        // 120 + 7 = 127

        // Mock current move structure if needed, but SP_monster_supertank should have set it up implicitly
        // or we can just invoke attack logic.

        // Force attack logic to pick rocket
        // sys.rng.frandom returns 0.85 -> > 0.8 tries rocket/grenade depending on distance
        vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.85);

        supertank.monsterinfo.attack!(supertank, sys);

        // If attack chose rocket, current_move should be rocket move (120-146)
        const move = supertank.monsterinfo.current_move!;
        expect(move.firstframe).toBe(120);

        // Now execute the think of a firing frame (e.g., 7th frame)
        // Accessing frames array from the move
        const fireFrame = move.frames[7];
        expect(fireFrame.think).toBeDefined();

        fireFrame.think!(supertank, sys);

        expect(spyHeat).toHaveBeenCalled();
        expect(spyRocket).not.toHaveBeenCalled();
    });

    it('Fires normal rockets when spawnflag is NOT set', () => {
        supertank.spawnflags = 0;
        const spyHeat = vi.spyOn(attack, 'monster_fire_heat');
        const spyRocket = vi.spyOn(attack, 'monster_fire_rocket');

        vi.spyOn(sys.rng, 'frandom').mockReturnValue(0.85);
        supertank.monsterinfo.attack!(supertank, sys);

        const move = supertank.monsterinfo.current_move!;
        const fireFrame = move.frames[7];
        fireFrame.think!(supertank, sys);

        expect(spyRocket).toHaveBeenCalled();
        expect(spyHeat).not.toHaveBeenCalled();
    });
});
