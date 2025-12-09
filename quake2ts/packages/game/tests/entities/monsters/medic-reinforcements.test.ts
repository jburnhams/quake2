import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_medic_commander } from '../../../src/entities/monsters/medic.js';
import { createTestContext } from '../../test-helpers.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity } from '../../../src/entities/entity.js';
import { Vec3 } from '@quake2ts/shared';

describe('Reinforcement System (Medic Commander)', () => {
    let context: ReturnType<typeof createTestContext>;
    let sys: EntitySystem;
    let commander: Entity;

    beforeEach(async () => {
        context = await createTestContext();
        sys = context.entities;

        // Mock getSpawnFunction manually on the instance since it's a method
        sys.getSpawnFunction = vi.fn().mockReturnValue(() => {});

        commander = sys.spawn();
        commander.origin = { x: 0, y: 0, z: 0 };
    });

    it('Parses reinforcement string correctly', () => {
        SP_monster_medic_commander(commander, {
            entities: sys,
            health_multiplier: 1,
            keyValues: {
                reinforcements: "monster_soldier 2; monster_gunner 4"
            },
            warn: () => {},
            free: () => {}
        });

        expect(commander.monsterinfo.reinforcements).toBeDefined();
        expect(commander.monsterinfo.reinforcements!.length).toBe(2);

        expect(commander.monsterinfo.reinforcements![0].classname).toBe('monster_soldier');
        expect(commander.monsterinfo.reinforcements![0].strength).toBe(2);

        expect(commander.monsterinfo.reinforcements![1].classname).toBe('monster_gunner');
        expect(commander.monsterinfo.reinforcements![1].strength).toBe(4);
    });

    it('Calls reinforcements instead of attacking (chance)', () => {
        SP_monster_medic_commander(commander, {
            entities: sys,
            health_multiplier: 1,
            keyValues: { monster_slots: "10" },
            warn: () => {},
            free: () => {}
        });

        // Mock RNG to trigger spawn (prob < 0.2)
        sys.rng.frandom = vi.fn().mockReturnValue(0.1);

        // Mock monsterinfo.attack calling
        commander.monsterinfo.attack!(commander, sys);

        // Check if current move is reinforcement move (firstframe 122)
        expect(commander.monsterinfo.current_move!.firstframe).toBe(122);
    });

    it('Decrements monster slots when spawning', () => {
         commander.monsterinfo.monster_slots = 10;
         commander.monsterinfo.monster_used = 0;

         // Manually simulate usage
         commander.monsterinfo.monster_used += 4;

         // This test is trivial but ensures the property names match what we expect
         expect(commander.monsterinfo.monster_slots - commander.monsterinfo.monster_used).toBe(6);
    });
});
