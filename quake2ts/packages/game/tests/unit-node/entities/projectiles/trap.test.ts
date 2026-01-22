
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTrap, trapThink } from '../../../../src/entities/projectiles.js';
import { Entity, MoveType, Solid } from '../../../../src/entities/entity.js';
import { createTestContext, createMockGameExports, createEntityFactory } from '@quake2ts/test-utils';
import { GameExports } from '../../../../src/index.js';
import { EntitySystem } from '../../../../src/entities/system.js';

describe('Trap Projectile', () => {
    let context: ReturnType<typeof createTestContext>;
    let game: GameExports;

    beforeEach(() => {
        context = createTestContext();
        // Use createMockGameExports to ensure cleaner game object setup, reusing context entities mock
        const sys = context.entities;

        game = createMockGameExports({
            sound: sys.engine.sound,
            centerprintf: sys.engine.centerprintf,
            time: 100,
            deathmatch: true,
            entities: sys as unknown as EntitySystem
        });
    });

    it('should create a trap projectile', () => {
        const owner = createEntityFactory({ index: 1 }) as Entity;
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
        const trap = createEntityFactory({
             index: 10,
             groundentity: new Entity(99),
             frame: 0,
             timestamp: 1000
        }) as Entity;

        // Mock context time
        const ctx = { ...context.entities, timeSeconds: 100 } as any;

        trapThink(trap, ctx);

        expect(trap.frame).toBe(1);
        expect(trap.nextthink).toBe(100.1);
    });

    it('should hunt targets when deployed', () => {
        const trap = createEntityFactory({
             index: 10,
             groundentity: new Entity(99),
             frame: 4, // Deployed
             timestamp: 1000,
             origin: { x: 0, y: 0, z: 0 }
        }) as Entity;

        const target = createEntityFactory({
            index: 20,
            origin: { x: 100, y: 0, z: 0 }, // Within 256
            health: 100,
            takedamage: true
        }) as Entity;

        // createEntityFactory removes inUse, but trap logic might check it (though usually visible() checks it).
        // Let's force it to be true just in case.
        target.inUse = true;

        const sys = context.entities;
        sys.forEachEntity = vi.fn((cb: any) => cb(target));
        // Ensure engine access in sys matches game
        sys.engine = game;
        sys.timeSeconds = 100;

        trapThink(trap, sys);

        // Should pull target towards trap (at 0,0,0)
        // Target is at 100,0,0. Pull direction is (-1, 0, 0).
        expect(target.velocity.x).toBeLessThan(0);
        expect(sys.engine.sound).toHaveBeenCalledWith(trap, 0, 'weapons/trapsuck.wav', 1, 1, 0);
    });
});
