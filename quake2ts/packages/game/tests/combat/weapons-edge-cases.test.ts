// =================================================================
// Quake II - Edge Case Weapon Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { GameExports } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { PlayerClient } from '../../src/game/player.js';
import { createPlayerInventory, WeaponId } from '../../src/inventory/playerInventory.js';
import * as damage from '../../src/combat/damage.js';
import { AmmoType } from '../../src/inventory/ammo.js';
import { DeepPartial } from '@quake2ts/shared';

describe('Weapon Firing - Edge Cases', () => {
    let game: DeepPartial<GameExports>;
    let player: Entity;
    let T_Damage_spy: any;

    beforeEach(() => {
        T_Damage_spy = vi.spyOn(damage, 'T_Damage');

        player = new Entity();
        player.client = {
            inventory: createPlayerInventory(),
            weaponStates: {
                states: new Map()
            },
        } as PlayerClient;
        player.angles = { x: 0, y: 0, z: 0 };
        player.origin = { x: 0, y: 0, z: 0 };

        const target = new Entity();
        target.takedamage = true;

        game = {
            time: 0,
            deathmatch: false,
            trace: vi.fn().mockReturnValue({
                ent: target,
                fraction: 0.5,
                endpos: { x: 1, y: 1, z: 1 },
                plane: { normal: { x: 0, y: 0, z: 1 } }
            }),
            multicast: vi.fn(),
            sound: vi.fn(),
            entities: {
                world: new Entity(),
                spawn: vi.fn().mockReturnValue(new Entity()),
                finalizeSpawn: vi.fn(),
            },
            random: {
                irandom: vi.fn(),
            }
        };
    });

    describe('Railgun', () => {
        beforeEach(() => {
            player.client!.inventory.ammo.counts[AmmoType.Slugs] = 10;
        });

        it('should deal 125 damage in single player', () => {
            game.deathmatch = false;
            fire(game as GameExports, player, WeaponId.Railgun);
            expect(T_Damage_spy).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                125, // damage
                225, // knockback
                expect.anything(),
                expect.anything(),
                expect.anything()
            );
        });

        it('should deal 100 damage in deathmatch', () => {
            game.deathmatch = true;
            fire(game as GameExports, player, WeaponId.Railgun);
            expect(T_Damage_spy).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                100, // damage
                200, // knockback
                expect.anything(),
                expect.anything(),
                expect.anything()
            );
        });
    });

    describe('HyperBlaster', () => {
        beforeEach(() => {
            player.client!.inventory.ammo.counts[AmmoType.Cells] = 50;
        });

        it('should deal 20 damage in single player', async () => {
            game.deathmatch = false;
            // Mock createBlasterBolt to check damage param
            const projectiles = await import('../../src/entities/projectiles.js');
            const spy = vi.spyOn(projectiles, 'createBlasterBolt');

            fire(game as GameExports, player, WeaponId.HyperBlaster);

            expect(spy).toHaveBeenCalledWith(
                expect.anything(),
                player,
                expect.anything(),
                expect.anything(),
                20, // damage
                expect.anything(),
                expect.anything()
            );
        });

        it('should deal 15 damage in deathmatch', async () => {
            game.deathmatch = true;
            const projectiles = await import('../../src/entities/projectiles.js');
            const spy = vi.spyOn(projectiles, 'createBlasterBolt');

            fire(game as GameExports, player, WeaponId.HyperBlaster);

            expect(spy).toHaveBeenCalledWith(
                expect.anything(),
                player,
                expect.anything(),
                expect.anything(),
                15, // damage
                expect.anything(),
                expect.anything()
            );
        });
    });

    describe('RocketLauncher', () => {
        beforeEach(() => {
            player.client!.inventory.ammo.counts[AmmoType.Rockets] = 10;
        });

        it('should deal deterministic random damage', async () => {
            const projectiles = await import('../../src/entities/projectiles.js');
            const spy = vi.spyOn(projectiles, 'createRocket');
            vi.spyOn(game.random, 'irandom').mockReturnValue(10); // 100 + 10 = 110

            fire(game as GameExports, player, WeaponId.RocketLauncher);

            expect(spy).toHaveBeenCalledWith(
                expect.anything(),
                player,
                expect.anything(),
                expect.anything(),
                110, // damage
                120, // radiusDamage
                expect.anything()
            );
        });
    });
});
