import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_tank } from '../../../src/entities/monsters/tank.js';
import { M_AdjustBlindfireTarget } from '../../../src/entities/monsters/common.js';
import { createTestContext } from '@quake2ts/test-utils';
import { EntitySystem } from '../../../src/entities/system.js';
import { AIFlags, AttackState } from '../../../src/ai/index.js';
import { Vec3, MASK_SHOT } from '@quake2ts/shared';
import { Entity } from '../../../src/entities/entity.js';

describe('Blindfire System (Tank)', () => {
    let context: ReturnType<typeof createTestContext>;
    let sys: EntitySystem;
    let tank: Entity;
    let enemy: Entity;

    beforeEach(async () => {
        context = await createTestContext();
        sys = context.entities;

        // Mock traces for visibility checks
        sys.trace = vi.fn().mockReturnValue({
            fraction: 1.0,
            startsolid: false,
            allsolid: false,
            ent: null
        });

        // Setup Tank
        tank = sys.spawn();
        tank.origin = { x: 0, y: 0, z: 0 };
        SP_monster_tank(tank, {
            entities: sys,
            health_multiplier: 1,
            skill: 2,
            deathmatch: false
        });

        // Setup Enemy
        enemy = sys.spawn();
        enemy.origin = { x: 500, y: 0, z: 0 };
        enemy.health = 100;
        enemy.viewheight = 20;
        tank.enemy = enemy;
    });

    it('M_AdjustBlindfireTarget finds valid target around corner', () => {
        const start = { x: 0, y: 0, z: 0 };
        const target = { x: 100, y: 100, z: 0 };
        const right = { x: 1, y: 0, z: 0 };

        // Mock trace: direct line blocked, but side checks clear
        sys.trace = vi.fn().mockImplementation((s, e) => {
            // Check if tracing to original target (blocked)
            if (e.x === target.x && e.y === target.y) {
                 return { fraction: 0.1, startsolid: false, allsolid: false };
            }
            // Check offsets (clear)
            return { fraction: 1.0, startsolid: false, allsolid: false };
        });

        const adjusted = M_AdjustBlindfireTarget(tank, start, target, right, sys);
        expect(adjusted).not.toBeNull();
        // Should be normalized vector
        expect(Math.abs(adjusted!.x * adjusted!.x + adjusted!.y * adjusted!.y + adjusted!.z * adjusted!.z - 1)).toBeLessThan(0.001);
    });

    it('Tank sets AIFlags.ManualSteering during blindfire', () => {
        // Force Blindfire state
        tank.monsterinfo.attack_state = AttackState.Blind;
        tank.monsterinfo.blind_fire_delay = 5.0; // Valid delay
        tank.monsterinfo.blind_fire_target = { x: 500, y: 0, z: 0 };

        // Mock RNG to allow fire
        sys.rng.frandom = vi.fn().mockReturnValue(0.0); // Pass probability checks
        sys.rng.frandomMax = vi.fn().mockReturnValue(1.0);

        // Call attack function
        tank.monsterinfo.attack!(tank, sys);

        expect((tank.monsterinfo.aiflags & AIFlags.ManualSteering) !== 0).toBe(true);
    });

    it('Tank updates ideal_yaw based on blind_fire_target when ManualSteering is set', () => {
        const target = { x: 0, y: 100, z: 0 };

        // Set up ManualSteering and a target
        tank.monsterinfo.aiflags |= AIFlags.ManualSteering;
        tank.monsterinfo.blind_fire_target = target;
        tank.origin = { x: 0, y: 0, z: 0 };

        // Invoke the attack function where blind fire logic resides.
        // This sets the current_move to attack_rocket_move (or blaster),
        // which contains the tank_blind_check think function in its frames.
        tank.monsterinfo.attack_state = AttackState.Blind;
        tank.monsterinfo.attack!(tank, sys);

        // Verify we are in an attack move
        expect(tank.monsterinfo.current_move).toBeDefined();

        // Find the frame that has the blind check logic.
        // In tank.ts, attack_rocket_move has tank_blind_check at frame 0.
        // We simulate the execution of that frame's think function.
        const frame = tank.monsterinfo.current_move!.frames.find(f => f.think && f.think.name === 'tank_blind_check');
        expect(frame).toBeDefined();

        if (frame && frame.think) {
             frame.think(tank, sys);
        }

        // The tank uses vectorToYaw from shared utils, not sys.vectoyaw.
        // For target (0, 100, 0) relative to (0, 0, 0), the yaw should be 90.
        expect(tank.ideal_yaw).toBe(90);
    });

    it('Tank tracks enemy position for blindfire when visible', () => {
        // Enemy is visible
        sys.trace = vi.fn().mockReturnValue({ fraction: 1.0, ent: enemy });

        // Run checkattack
        const result = tank.monsterinfo.checkattack!(tank, sys);

        // Should update blind_fire_target to near enemy
        expect(tank.monsterinfo.blind_fire_target).toBeDefined();
        // Check near enemy origin
        expect(Math.abs(tank.monsterinfo.blind_fire_target!.x - enemy.origin.x)).toBeLessThan(50);
    });
});
