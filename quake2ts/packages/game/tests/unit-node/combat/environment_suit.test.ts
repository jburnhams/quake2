
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, DeadFlag } from '../../../src/entities/entity.js';
import { T_Damage } from '../../../src/combat/damage.js';
import { DamageFlags } from '../../../src/combat/damageFlags.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import {
    createPlayerEntityFactory,
    createTestGame,
    spawnEntity
} from '@quake2ts/test-utils';

describe('Environment Suit Powerup', () => {
    let player: Entity;
    let mockGame: ReturnType<typeof createTestGame>['game'];
    let mockMulticast: any;

    beforeEach(() => {
        const testEnv = createTestGame();
        mockGame = testEnv.game;
        mockMulticast = vi.fn();

        vi.spyOn(mockGame, 'time', 'get').mockReturnValue(10);

        const playerFactory = createPlayerEntityFactory({
            takedamage: true,
            health: 100,
            deadflag: DeadFlag.Alive,
            flags: 0,
        });

        // Setup initial client state
        if (playerFactory.client) {
            playerFactory.client.enviro_time = 0;
        }

        player = spawnEntity(mockGame.entities, playerFactory);
    });

    it('should take damage from SLIME without enviro suit', () => {
        const result = T_Damage(
            player,
            null,
            null,
            ZERO_VEC3,
            player.origin,
            ZERO_VEC3,
            10,
            0,
            DamageFlags.NONE,
            DamageMod.SLIME,
            mockGame.time,
            mockMulticast
        );

        expect(result?.take).toBe(10);
    });

    it('should take damage from LAVA without enviro suit', () => {
        const result = T_Damage(
            player,
            null,
            null,
            ZERO_VEC3,
            player.origin,
            ZERO_VEC3,
            10,
            0,
            DamageFlags.NONE,
            DamageMod.LAVA,
            mockGame.time,
            mockMulticast
        );

        expect(result?.take).toBe(10);
    });

    it('should NOT take damage from SLIME with enviro suit', () => {
        player.client!.enviro_time = mockGame.time + 5;

        const result = T_Damage(
            player,
            null,
            null,
            ZERO_VEC3,
            player.origin,
            ZERO_VEC3,
            10,
            0,
            DamageFlags.NONE,
            DamageMod.SLIME,
            mockGame.time,
            mockMulticast
        );

        // Result can be null (if we return null) or take=0
        if (result) {
            expect(result.take).toBe(0);
        } else {
            expect(result).toBeNull();
        }
    });

    it('should NOT take damage from LAVA with enviro suit', () => {
        player.client!.enviro_time = mockGame.time + 5;

        const result = T_Damage(
            player,
            null,
            null,
            ZERO_VEC3,
            player.origin,
            ZERO_VEC3,
            10,
            0,
            DamageFlags.NONE,
            DamageMod.LAVA,
            mockGame.time,
            mockMulticast
        );

        if (result) {
            expect(result.take).toBe(0);
        } else {
            expect(result).toBeNull();
        }
    });

    it('should still take damage from other sources with enviro suit', () => {
        player.client!.enviro_time = mockGame.time + 5;

        const result = T_Damage(
            player,
            null,
            null,
            ZERO_VEC3,
            player.origin,
            ZERO_VEC3,
            10,
            0,
            DamageFlags.NONE,
            DamageMod.BLASTER,
            mockGame.time,
            mockMulticast
        );

        expect(result?.take).toBe(10);
    });
});
