
import { describe, it, expect, vi } from 'vitest';
import { KillBox } from '../../src/dm/game.js';
import { Entity, DeadFlag, Solid } from '../../src/entities/entity.js';
import { createTestContext } from '../test-helpers.js';

describe('KillBox', () => {
    it('should kill entities occupying the same space', () => {
        const { entities: sys } = createTestContext();

        // Attacker (the one spawning/teleporting)
        const attacker = sys.spawn();
        attacker.classname = 'player';
        attacker.origin = { x: 100, y: 100, z: 100 };
        attacker.mins = { x: -16, y: -16, z: -24 };
        attacker.maxs = { x: 16, y: 16, z: 32 };
        attacker.client = {} as any; // Mock client

        // Victim (standing in the way)
        const victim = sys.spawn();
        victim.classname = 'player';
        victim.origin = { x: 100, y: 100, z: 100 };
        victim.mins = { x: -16, y: -16, z: -24 };
        victim.maxs = { x: 16, y: 16, z: 32 };
        victim.takedamage = true;
        victim.health = 100;
        victim.solid = Solid.Bbox;
        victim.die = vi.fn();

        // Mock trace to detect collision - victim is blocking attacker
        const traceMock = vi.fn().mockReturnValue({
            fraction: 0, // Immediately hit
            ent: victim,
            startsolid: true
        });

        // Setup mock trace on imports
        (sys.imports as any).trace = traceMock;

        KillBox(attacker, sys);

        // Verify victim was killed (telefrag does 100000 damage)
        expect(victim.health).toBeLessThanOrEqual(0);
        // T_Damage should call die callback if present
        // Since we are not using the real T_Damage from the module but the one imported by KillBox,
        // we should expect the side effects on the victim object.
        // Wait, KillBox calls the real T_Damage.
        // The real T_Damage calls victim.die() if health <= 0.
        // But our victim is a mocked Entity from spawn(), which doesn't have the full T_Damage logic attached?
        // Actually, T_Damage operates on the object passed.
        // We manually added die mock to victim.

        // Let's verify health dropped massive amount
        expect(victim.health).toBeLessThan(-90000);
        expect(victim.die).toHaveBeenCalled();
    });
});
