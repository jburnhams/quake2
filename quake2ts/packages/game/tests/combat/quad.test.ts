
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../../src/entities/entity.js';
import { GameExports } from '../../src/index.js';
import { T_Damage } from '../../src/combat/damage.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import { createMockGameExports, createPlayerEntityFactory, createEntityFactory, createPlayerStateFactory } from '@quake2ts/test-utils';

describe('Quad Damage', () => {
    let attacker: Entity;
    let target: Entity;
    let game: GameExports;

    beforeEach(() => {
        game = createMockGameExports({
            time: 10,
            multicast: vi.fn()
        });

        // Use createPlayerEntityFactory for attacker
        attacker = createPlayerEntityFactory({
             origin: { x: 0, y: 0, z: 0 },
             velocity: { x: 0, y: 0, z: 0 }
        }) as Entity;

        // Populate minimal client state for quad logic
        attacker.client = {
            ...createPlayerStateFactory(),
            inventory: {
                ammo: { counts: [] },
                items: new Set(),
                ownedWeapons: new Set(),
            } as any,
            weaponStates: [],
            quad_time: 0,
            double_time: 0
        } as any;

        // Use createEntityFactory for target
        target = createEntityFactory({
            classname: 'monster_soldier',
            takedamage: true,
            health: 100,
            origin: { x: 100, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
        }) as Entity;

        target.pain = vi.fn();
        target.die = vi.fn();
    });

    it('should deal normal damage when no powerups are active', () => {
        const result = T_Damage(
            target,
            attacker,
            attacker,
            { x: 1, y: 0, z: 0 },
            target.origin,
            ZERO_VEC3,
            10,
            10,
            DamageFlags.NONE,
            DamageMod.UNKNOWN,
            game.time,
            game.multicast
        );

        expect(result?.take).toBe(10);
    });

    it('should deal 4x damage when Quad Damage is active', () => {
        if (attacker.client) {
            attacker.client.quad_time = game.time + 10;
        }

        const result = T_Damage(
            target,
            attacker,
            attacker,
            { x: 1, y: 0, z: 0 },
            target.origin,
            ZERO_VEC3,
            10,
            10,
            DamageFlags.NONE,
            DamageMod.UNKNOWN,
            game.time,
            game.multicast
        );

        expect(result?.take).toBe(40);
        expect(result?.knocked.x).not.toBe(0);
    });

    it('should deal 2x damage when Double Damage is active', () => {
        if (attacker.client) {
            attacker.client.double_time = game.time + 10;
        }

        const result = T_Damage(
            target,
            attacker,
            attacker,
            { x: 1, y: 0, z: 0 },
            target.origin,
            ZERO_VEC3,
            10,
            10,
            DamageFlags.NONE,
            DamageMod.UNKNOWN,
            game.time,
            game.multicast
        );

        expect(result?.take).toBe(20);
    });

    it('should deal 8x damage when both Quad and Double Damage are active', () => {
        if (attacker.client) {
            attacker.client.quad_time = game.time + 10;
            attacker.client.double_time = game.time + 10;
        }

        const result = T_Damage(
            target,
            attacker,
            attacker,
            { x: 1, y: 0, z: 0 },
            target.origin,
            ZERO_VEC3,
            10,
            10,
            DamageFlags.NONE,
            DamageMod.UNKNOWN,
            game.time,
            game.multicast
        );

        expect(result?.take).toBe(80);
    });
});
