
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTrap, trapThink, trapGibThink } from '../../../../src/entities/projectiles/trap.js';
import { Entity, MoveType, Solid } from '../../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';
import { GameExports } from '../../../../src/index.js';
import { vec3 } from '@quake2ts/shared/src/math/vec3.js';

describe('Trap Projectile', () => {
    let context: ReturnType<typeof createTestContext>;
    let game: GameExports;

    beforeEach(() => {
        context = createTestContext();
        game = context.game;
        context.sys.spawn = vi.fn().mockImplementation(() => new Entity(10));
        context.sys.linkentity = vi.fn();
        context.sys.free = vi.fn();
        context.sys.forEachEntity = vi.fn();
    });

    it('should create a trap projectile', () => {
        const owner = new Entity(1);
        const start = vec3(0, 0, 0);
        const dir = vec3(1, 0, 0);
        const speed = 400;

        const trap = createTrap(context.sys, owner, start, dir, speed);

        expect(trap.classname).toBe('food_cube_trap');
        expect(trap.movetype).toBe(MoveType.Bounce);
        expect(trap.solid).toBe(Solid.BoundingBox);
        expect(trap.owner).toBe(owner);
        expect(trap.velocity.x).toBe(400);
        expect(context.sys.linkentity).toHaveBeenCalledWith(trap);
    });

    it('should deploy when on ground', () => {
        const trap = new Entity(10);
        trap.groundentity = new Entity(99);
        trap.frame = 0;
        trap.timestamp = 1000;

        // Mock context time
        const ctx = { ...context.sys, timeSeconds: 100 } as any;

        trapThink(trap, ctx);

        expect(trap.frame).toBe(1);
        expect(trap.nextthink).toBe(100.1);
    });

    it('should hunt targets when deployed', () => {
        const trap = new Entity(10);
        trap.groundentity = new Entity(99);
        trap.frame = 4; // Deployed
        trap.timestamp = 1000;
        trap.origin = vec3(0, 0, 0);

        const target = new Entity(20);
        target.inUse = true;
        target.origin = vec3(100, 0, 0); // Within 256
        target.health = 100;
        target.takedamage = true;

        const ctx = {
            ...context.sys,
            timeSeconds: 100,
            forEachEntity: (cb: any) => cb(target),
            engine: game
        } as any;

        // Mock game.sound
        game.sound = vi.fn();

        trapThink(trap, ctx);

        // Should pull target
        // target velocity should change
        // We expect velocity to be modified (added).
        expect(target.velocity.x).toBeGreaterThan(0);
        expect(game.sound).toHaveBeenCalledWith(trap, 0, 'weapons/trapsuck.wav', 1, 1, 0);
    });
});
