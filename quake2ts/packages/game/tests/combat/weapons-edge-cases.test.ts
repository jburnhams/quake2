// =================================================================
// Quake II - Edge Case Weapon Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fire, firingRandom } from '../../src/combat/weapons/firing.js';
import { GameExports } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { WeaponId } from '../../src/inventory/playerInventory.js';
import * as damage from '../../src/combat/damage.js';
import { AmmoType } from '../../src/inventory/ammo.js';
import { DeepPartial } from '@quake2ts/shared';
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';
import { createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';
import { createEntityFactory, createPlayerStateFactory } from '@quake2ts/test-utils';
import { createGame } from '../../src/index.js';

describe('Weapon Firing - Edge Cases', () => {
    let game: GameExports;
    let player: Entity;
    let T_Damage_spy: any;

    beforeEach(() => {
        T_Damage_spy = vi.spyOn(damage, 'T_Damage');
        T_Damage_spy.mockImplementation(() => {}); // Prevent actual execution

        const { imports, engine } = createGameImportsAndEngine({
            imports: {
                trace: vi.fn().mockReturnValue({
                    ent: createEntityFactory({ takedamage: true }),
                    fraction: 0.5,
                    endpos: { x: 1, y: 1, z: 1 },
                    plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0, type: 0, signbits: 0 },
                    surface: null,
                    contents: 0,
                    startsolid: false,
                    allsolid: false
                })
            }
        });

        game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 }, random: firingRandom });
        game.spawnWorld();

        player = createPlayerEntityFactory({
            angles: { x: 0, y: 0, z: 0 },
            origin: { x: 0, y: 0, z: 0 }
        }) as Entity;

        // Ensure client properties are fully initialized if factory was partial
        if (!player.client) {
             player.client = {
                ...createPlayerStateFactory(),
                inventory: {
                    ammo: { counts: [], caps: [] },
                    weaponStates: { states: new Map() },
                    items: new Set(),
                    ownedWeapons: new Set()
                }
             } as any;
        }

        // Setup ammo slots
        player.client!.inventory.ammo.counts[AmmoType.Slugs] = 0;
        player.client!.inventory.ammo.counts[AmmoType.Cells] = 0;
        player.client!.inventory.ammo.counts[AmmoType.Rockets] = 0;

        game.entities.spawn = vi.fn().mockReturnValue(createEntityFactory({}));
        game.entities.find = vi.fn().mockReturnValue(player);
    });

    describe('Railgun', () => {
        beforeEach(() => {
            player.client!.inventory.ammo.counts[AmmoType.Slugs] = 10;
        });

        it('should deal 125 damage in single player', () => {
            (game as any).deathmatch = false;
            fire(game, player, WeaponId.Railgun);
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
                game.time,
                expect.anything(),
                expect.objectContaining({ hooks: expect.anything() })
            );
        });

        it('should deal 100 damage in deathmatch', () => {
            (game as any).deathmatch = true;
            fire(game, player, WeaponId.Railgun);
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
                game.time,
                expect.anything(),
                expect.objectContaining({ hooks: expect.anything() })
            );
        });
    });

    describe('HyperBlaster', () => {
        beforeEach(() => {
            player.client!.inventory.ammo.counts[AmmoType.Cells] = 50;
        });

        it('should deal 20 damage in single player', async () => {
            (game as any).deathmatch = false;
            // Mock createBlasterBolt to check damage param
            const projectiles = await import('../../src/entities/projectiles.js');
            const spy = vi.spyOn(projectiles, 'createBlasterBolt');

            fire(game, player, WeaponId.HyperBlaster);

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
            (game as any).deathmatch = true;
            const projectiles = await import('../../src/entities/projectiles.js');
            const spy = vi.spyOn(projectiles, 'createBlasterBolt');

            fire(game, player, WeaponId.HyperBlaster);

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

            // Note: firingRandom is imported from firing.js which uses standard RNG unless mocked/seeded.
            // We use the same random generator that 'fire' uses.
            vi.spyOn(firingRandom, 'irandomRange').mockReturnValue(10); // 100 + 10 = 110

            fire(game, player, WeaponId.RocketLauncher);

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
