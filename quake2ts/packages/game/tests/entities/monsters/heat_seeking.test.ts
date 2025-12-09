import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { monster_fire_heat } from '../../../src/entities/monsters/attack.js';
import { createTestContext } from '../../test-helpers.js';
import { Vec3 } from '@quake2ts/shared';

describe('Heat-Seeking Missiles', () => {
    let context: EntitySystem;
    let monster: Entity;
    let target: Entity;

    beforeEach(async () => {
        const spawnContext = createTestContext();
        context = spawnContext.entities;

        monster = context.spawn();
        monster.origin = { x: 0, y: 0, z: 0 };
        monster.angles = { x: 0, y: 0, z: 0 };

        // Setup findByRadius to return target
        const dummyTarget = context.spawn();
        dummyTarget.origin = { x: 100, y: 20, z: 0 }; // Increased Y to make turn more obvious
        dummyTarget.takedamage = true;
        dummyTarget.health = 100; // Ensure it's alive
        dummyTarget.solid = Solid.Bsp;
        dummyTarget.client = {} as any; // Must be client to be tracked by default logic
        target = dummyTarget;

        context.findByRadius = vi.fn().mockReturnValue([target]);
        context.trace = vi.fn().mockReturnValue({ fraction: 1.0, ent: target }); // Visible
    });

    it('spawns a rocket with heat tracking logic', () => {
        const start: Vec3 = { x: 0, y: 0, z: 0 };
        const dir: Vec3 = { x: 1, y: 0, z: 0 };

        // We can't easily capture the return value since monster_fire_heat returns void.
        // But we can spy on spawn/finalizeSpawn to capture the created entity.
        let createdRocket: Entity | undefined;
        const originalFinalize = context.finalizeSpawn;
        context.finalizeSpawn = vi.fn((ent) => {
            createdRocket = ent;
            if (originalFinalize) originalFinalize(ent);
        });

        monster_fire_heat(monster, start, dir, 50, 600, 0, 0.5, context); // increased turn rate for test

        expect(createdRocket).toBeDefined();
        expect(createdRocket?.think).toBeDefined();
        expect(createdRocket?.classname).toBe('heat_seeking_missile');

        const rocket = createdRocket!;
        const initialVel = { ...rocket.velocity };

        // Run think manually to verify tracking updates velocity
        rocket.think!(rocket, context);

        expect(rocket.velocity.y).toBeGreaterThan(initialVel.y);
    });
});
