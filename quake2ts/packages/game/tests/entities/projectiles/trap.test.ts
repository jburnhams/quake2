
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTrap, trapThink } from '../../../src/entities/projectiles.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';
import { GameExports } from '../../../src/index.js';
import { vec3 } from '@quake2ts/shared';

describe('Trap Projectile', () => {
    let context: ReturnType<typeof createTestContext>;
    let game: GameExports;

    beforeEach(() => {
        context = createTestContext();
        const sys = context.entities;

        game = {
            sound: sys.engine.sound,
            centerprintf: sys.engine.centerprintf,
            time: 100,
            deathmatch: true,
            entities: sys
        } as unknown as GameExports;

        // Mock sys methods if needed override
        // sys.spawn is already mocked in createTestContext
    });

    it('should create a trap projectile', () => {
        const owner = new Entity(1);
        const start = { x: 0, y: 0, z: 0 };
        const dir = { x: 1, y: 0, z: 0 };
        const speed = 400;

        const trap = createTrap(context.entities, owner, start, dir, speed);

        expect(trap.classname).toBe('food_cube_trap');
        expect(trap.movetype).toBe(MoveType.Bounce);
        expect(trap.solid).toBe(Solid.BoundingBox);
        expect(trap.owner).toBe(owner);
        expect(trap.velocity.x).toBe(400);
        expect(context.entities.linkentity).toHaveBeenCalledWith(trap);
    });

    it('should deploy when on ground', () => {
        const trap = new Entity(10);
        trap.groundentity = new Entity(99);
        trap.frame = 0;
        trap.timestamp = 1000;

        // Mock context time
        const ctx = { ...context.entities, timeSeconds: 100 } as any;

        trapThink(trap, ctx);

        expect(trap.frame).toBe(1);
        expect(trap.nextthink).toBe(100.1);
    });

    it('should hunt targets when deployed', () => {
        const trap = new Entity(10);
        trap.groundentity = new Entity(99);
        trap.frame = 4; // Deployed
        trap.timestamp = 1000;
        trap.origin = { x: 0, y: 0, z: 0 };

        const target = new Entity(20);
        target.inUse = true;
        target.origin = { x: 100, y: 0, z: 0 }; // Within 256
        target.health = 100;
        target.takedamage = true;

        const sys = context.entities;
        sys.forEachEntity = vi.fn((cb: any) => cb(target));
        sys.engine = game; // Ensure engine access
        sys.timeSeconds = 100;

        trapThink(trap, sys);

        // Should pull target towards trap (at 0,0,0)
        // Target is at 100,0,0. Pull direction is (-1, 0, 0).
        expect(target.velocity.x).toBeLessThan(0);
        expect(sys.engine.sound).toHaveBeenCalledWith(trap, 0, 'weapons/trapsuck.wav', 1, 1, 0);
    });
});
