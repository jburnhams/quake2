import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_supertank } from '../../../src/entities/monsters/supertank.js';
import { createTestContext } from '@quake2ts/test-utils';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity } from '../../../src/entities/entity.js';
import { Vec3 } from '@quake2ts/shared';
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
        supertank.origin = { x: 0, y: 0, z: 0 };
        supertank.spawnflags = 8; // SPAWNFLAG_SUPERTANK_POWERSHIELD -> Enables heat seeker

        SP_monster_supertank(supertank, {
            entities: sys,
            health_multiplier: 1,
            keyValues: {},
            warn: () => {},
            free: () => {}
        });

        enemy = sys.spawn();
        enemy.origin = { x: 500, y: 0, z: 0 };
        enemy.health = 100;
        supertank.enemy = enemy;
    });

    it('Fires heat seeking missiles when spawnflag is set', () => {
        const spyHeat = vi.spyOn(attack, 'monster_fire_heat');
        const spyRocket = vi.spyOn(attack, 'monster_fire_rocket');

        // Setup state to fire rocket
        // Attack 2 (Rocket): Indices 7, 10, 13 call supertank_fire_rocket
        // Move frames 120-146. Frame 127 corresponds to index 7?
        // 120 + 7 = 127

        supertank.monsterinfo.current_move = {
            firstframe: 120, lastframe: 146,
            frames: Array(27).fill({ ai: () => {}, dist: 0 }),
            endfunc: () => {}
        } as any;

        // Trigger the specific think function
        // Need to access `supertank_fire_rocket` which is not exported.
        // But we can trigger it by simulating the frame execution or finding the frame in current_move.

        // We can inspect the frames of current_move initialized by SP_monster_supertank
        // The frames are created in the module scope.
        // But since we can't easily access the private `supertank_fire_rocket`,
        // we can spy on `monster_fire_heat` and assume that if it's called, the logic works.
        // To trigger it, we need to execute the think function of the correct frame.

        // Manually find the frame with the think function
        // Accessing via `monsterinfo.attack` path is one way but random.

        // Let's iterate frames in the move and execute one that has a think
        const frames = supertank.monsterinfo.current_move!.frames;

        // We need to find the specific move that is `attack_rocket_move`.
        // Since we can't import `attack_rocket_move` directly, we can try to find it by frame number
        // or just invoke `supertank.monsterinfo.attack` and force RNG to choose rockets.

        sys.rng.frandom = vi.fn().mockReturnValue(0.85); // > 0.8 tries rocket/grenade depending on distance
        // Logic: if isFar (range > 540), 0.3-0.8 is rocket.
        // distance 500 is not Far.
        // Else: 0.5-0.9 is rocket.

        supertank.monsterinfo.attack!(supertank, sys);

        // If attack chose rocket, current_move should be rocket move (120-146)
        const move = supertank.monsterinfo.current_move!;
        expect(move.firstframe).toBe(120);

        // Now execute the think of a firing frame (e.g., 7th frame)
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

        sys.rng.frandom = vi.fn().mockReturnValue(0.85);
        supertank.monsterinfo.attack!(supertank, sys);

        const move = supertank.monsterinfo.current_move!;
        const fireFrame = move.frames[7];
        fireFrame.think!(supertank, sys);

        expect(spyRocket).toHaveBeenCalled();
        expect(spyHeat).not.toHaveBeenCalled();
    });
});
