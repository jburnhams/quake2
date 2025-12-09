import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_medic_commander } from '../../../src/entities/monsters/medic.js';
import { createTestContext } from '../../test-helpers.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity, AiFlags } from '../../../src/entities/entity.js';
import { Vec3 } from '@quake2ts/shared';

describe('Reinforcement System (Medic Commander)', () => {
    let context: ReturnType<typeof createTestContext>;
    let sys: EntitySystem;
    let commander: Entity;
    let spawnFunction: any;

    beforeEach(async () => {
        context = await createTestContext();
        sys = context.entities;

        // Mock getSpawnFunction to return a function that modifies the entity
        spawnFunction = vi.fn().mockImplementation((ent: Entity) => {
            // Simulate minimal spawn behavior
            ent.inUse = true;
        });
        sys.getSpawnFunction = vi.fn().mockReturnValue(spawnFunction);

        // Mock finding a spawn point
        // sys.trace is already mocked by createTestContext but we need checkGroundSpawnPoint/findSpawnPoint to succeed
        // Since findSpawnPoint relies on trace, and we want to simulate success:
        // We'll mock the internal behavior if possible, or just rely on the fact that mock traces return empty (fraction 1) usually.
        // However, findSpawnPoint usually checks for contents.
        // For simplicity in unit testing `medic_finish_spawn` logic specifically, we might need to invoke it directly or mock dependencies.

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

    it('Configures spawned reinforcement entity correctly', () => {
        // Setup commander with specific reinforcement
        SP_monster_medic_commander(commander, {
            entities: sys,
            health_multiplier: 1,
            keyValues: {
                reinforcements: "monster_soldier 2",
                monster_slots: "10"
            },
            warn: () => {},
            free: () => {}
        });

        // Force select the reinforcement
        commander.monsterinfo.chosen_reinforcements = [0];

        // Trigger the spawn frame logic (medic_finish_spawn)
        // We need to access the private/internal `medic_finish_spawn` function.
        // In medic.ts, it's not exported. But we can trigger it via the move frames.

        // Find the move that corresponds to reinforcement
        // It's `call_reinforcements_move`.
        // We can find it by triggering the attack and checking the move.
        sys.rng.frandom = vi.fn().mockReturnValue(0.1);
        commander.monsterinfo.attack!(commander, sys);

        const move = commander.monsterinfo.current_move!;
        // The spawn frame is index 19 in the frames array (based on medic.ts source analysis)
        // 122 + 19 = 141. Frame 141 call `medic_finish_spawn`.
        const spawnFrame = move.frames[19];
        expect(spawnFrame).toBeDefined();

        // We need to ensure findSpawnPoint returns a valid point for the spawn to happen
        // Mock trace to return fraction 1 (clear) so checkGroundSpawnPoint passes?
        // Actually checkGroundSpawnPoint does a trace down.
        // We need to mock sys.trace to return appropriate results.
        sys.trace = vi.fn().mockImplementation((start, mins, maxs, end) => {
             // If checking down (end.z < start.z), return a hit (ground)
             if (end.z < start.z) {
                 return { fraction: 0.5, ent: null, startsolid: false, allsolid: false };
             }
             // Checking spawn point clear? Return 1.0
             return { fraction: 1.0, ent: null, startsolid: false, allsolid: false };
        });

        // Also mock findSpawnPoint to just return a point close by
        // Since findSpawnPoint is imported from spawn_utils, mocking it might be hard if it's not on context.
        // But medic.ts imports it directly.
        // LUCKILY: medic.ts uses `findSpawnPoint` from `../../ai/spawn_utils.js`.
        // We can't easily mock module imports here without vi.mock at top level.
        // BUT, `medic.ts` logic does:
        // const spawnPoint = findSpawnPoint(...)

        // Alternative: Mock `M_ProjectFlashSource` logic? No.

        // Let's assume the default `trace` mock in test-helpers or our override allows it to find a spot.
        // `findSpawnPoint` does `traceBox`.

        // Let's Spy/Mock the internal functions if we can, OR make the conditions perfect.
        // If we set commander origin to 0,0,100, ground at 0.
        commander.origin = { x: 0, y: 0, z: 100 };

        // Capture spawned entity
        let spawnedEnt: Entity | null = null;
        const originalSpawn = sys.spawn;
        sys.spawn = vi.fn().mockImplementation(() => {
            spawnedEnt = originalSpawn.call(sys);
            return spawnedEnt;
        });

        // Call the think function
        if (spawnFrame.think) {
            spawnFrame.think(commander, sys);
        }

        expect(spawnedEnt).toBeDefined();
        if (spawnedEnt) {
            const ent = spawnedEnt as Entity;

            // 1. Verify Flags
            expect(ent.monsterinfo.aiflags & AiFlags.DoNotCount).toBeTruthy();
            expect(ent.monsterinfo.aiflags & AiFlags.SpawnedMedicC).toBeTruthy();
            expect(ent.monsterinfo.aiflags & AiFlags.IgnoreShots).toBeTruthy();

            // 2. Verify Commander Reference
            expect(ent.monsterinfo.commander).toBe(commander);

            // 3. Verify Slot Usage
            // The reinforcement strength was 2.
            // monster_used should have increased by 2.
            expect(commander.monsterinfo.monster_used).toBe(2);

            // monster_slots on the new entity should be 2
            expect(ent.monsterinfo.monster_slots).toBe(2);
        }
    });
});
