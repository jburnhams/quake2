
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, DeadFlag } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { T_Damage } from '../../src/combat/damage.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { ZERO_VEC3 } from '@quake2ts/shared';

describe('Environment Suit Powerup', () => {
    let player: Entity;
    let game: any;

    beforeEach(() => {
        player = new Entity(1);
        player.takedamage = true;
        player.health = 100;
        player.deadflag = DeadFlag.Alive;
        player.flags = 0;
        player.client = {
            inventory: {
                powerups: new Map(),
                ammo: { counts: [] },
                ownedWeapons: new Set(),
                keys: new Set(),
                items: new Set(),
            },
            weaponStates: {},
            invincible_time: 0,
            enviro_time: 0,
            buttons: 0,
            pm_flags: 0,
            pm_type: 0,
            pm_time: 0,
            gun_frame: 0,
            rdflags: 0,
            fov: 90,
        } as any;

        game = {
            time: 10,
            multicast: vi.fn(),
        };
    });

    it('should take damage from SLIME without enviro suit', () => {
        const result = T_Damage(
            player as any,
            null,
            null,
            ZERO_VEC3,
            player.origin,
            ZERO_VEC3,
            10,
            0,
            DamageFlags.NONE,
            DamageMod.SLIME,
            game.time,
            game.multicast
        );

        expect(result?.take).toBe(10);
    });

    it('should take damage from LAVA without enviro suit', () => {
        const result = T_Damage(
            player as any,
            null,
            null,
            ZERO_VEC3,
            player.origin,
            ZERO_VEC3,
            10,
            0,
            DamageFlags.NONE,
            DamageMod.LAVA,
            game.time,
            game.multicast
        );

        expect(result?.take).toBe(10);
    });

    it('should NOT take damage from SLIME with enviro suit', () => {
        player.client!.enviro_time = game.time + 5;

        const result = T_Damage(
            player as any,
            null,
            null,
            ZERO_VEC3,
            player.origin,
            ZERO_VEC3,
            10,
            0,
            DamageFlags.NONE,
            DamageMod.SLIME,
            game.time,
            game.multicast
        );

        // Result can be null (if we return null) or take=0
        if (result) {
            expect(result.take).toBe(0);
        } else {
            expect(result).toBeNull();
        }
    });

    it('should NOT take damage from LAVA with enviro suit', () => {
        player.client!.enviro_time = game.time + 5;

        const result = T_Damage(
            player as any,
            null,
            null,
            ZERO_VEC3,
            player.origin,
            ZERO_VEC3,
            10,
            0,
            DamageFlags.NONE,
            DamageMod.LAVA,
            game.time,
            game.multicast
        );

        if (result) {
            expect(result.take).toBe(0);
        } else {
            expect(result).toBeNull();
        }
    });

    it('should still take damage from other sources with enviro suit', () => {
        player.client!.enviro_time = game.time + 5;

        const result = T_Damage(
            player as any,
            null,
            null,
            ZERO_VEC3,
            player.origin,
            ZERO_VEC3,
            10,
            0,
            DamageFlags.NONE,
            DamageMod.BLASTER,
            game.time,
            game.multicast
        );

        expect(result?.take).toBe(10);
    });
});
