
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../../src/entities/entity.js';
import { GameExports } from '../../src/index.js';
import { T_Damage } from '../../src/combat/damage.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { ZERO_VEC3 } from '@quake2ts/shared';

describe('Quad Damage', () => {
    let attacker: Entity;
    let target: Entity;
    let game: GameExports;

    beforeEach(() => {
        attacker = {
            classname: 'player',
            takedamage: true,
            health: 100,
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            client: {
                inventory: {
                    ammo: { counts: [] },
                    items: new Set(),
                    ownedWeapons: new Set(),
                },
                weaponStates: [],
                quad_time: 0,
                double_time: 0
            }
        } as unknown as Entity;

        target = {
            classname: 'monster_soldier',
            takedamage: true,
            health: 100,
            origin: { x: 100, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            pain: vi.fn(),
            die: vi.fn()
        } as unknown as Entity;

        game = {
            time: 10,
            multicast: vi.fn()
        } as unknown as GameExports;
    });

    it('should deal normal damage when no powerups are active', () => {
        const result = T_Damage(
            target as any,
            attacker as any,
            attacker as any,
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
            target as any,
            attacker as any,
            attacker as any,
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
        // Also check knockback if possible, but T_Damage returns "knocked" vector
        expect(result?.knocked.x).not.toBe(0);
    });

    it('should deal 2x damage when Double Damage is active', () => {
        if (attacker.client) {
            attacker.client.double_time = game.time + 10;
        }

        const result = T_Damage(
            target as any,
            attacker as any,
            attacker as any,
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
            target as any,
            attacker as any,
            attacker as any,
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
