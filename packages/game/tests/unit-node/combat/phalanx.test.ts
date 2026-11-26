// =================================================================
// Quake II - Phalanx Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import { createPlayerWeaponStates } from '../../../src/combat/weapons/state.js';
import * as projectiles from '../../../src/entities/projectiles.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { MulticastType } from '../../../src/imports.js';
import { ServerCommand, TempEntity, MZ_PHALANX, MZ_PHALANX2 } from '@quake2ts/shared';
import { createGameImportsAndEngine, createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('Phalanx', () => {
    it('should fire standard shot (Frame != 8) with radius 120 and MZ_PHALANX', () => {
        const createPhalanxBall = vi.spyOn(projectiles, 'createPhalanxBall');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 }, rogue: true });

        vi.spyOn(game.random, 'irandomRange').mockReturnValue(75);

        game.init(0);

        const player = createPlayerEntityFactory({
            classname: 'player',
            origin: { x: 0, y: 0, z: 0 },
            viewheight: 22,
            angles: { x: 0, y: 0, z: 0 },
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.Phalanx],
                    ammo: { [AmmoType.MagSlugs]: 10 },
                }),
                weaponStates: createPlayerWeaponStates(),
                buttons: 1,
                gun_frame: 0 // Standard Shot
            } as any
        }) as Entity;
        game.entities.spawn = vi.fn().mockReturnValue(player);
        game.entities.finalizeSpawn(player);

        fire(game, player, WeaponId.Phalanx);

        expect(player.client!.inventory.ammo.counts[AmmoType.MagSlugs]).toBe(9);
        expect(createPhalanxBall).toHaveBeenCalledWith(
            expect.anything(), player, expect.anything(), expect.anything(),
            75, // damage
            120, // radius
            725 // speed
        );
        expect(imports.multicast).toHaveBeenCalledWith(
            expect.anything(), MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_PHALANX
        );
    });

    it('should fire alternate shot (Frame 8) with radius 30 and MZ_PHALANX2', () => {
        const createPhalanxBall = vi.spyOn(projectiles, 'createPhalanxBall');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 }, rogue: true });

        vi.spyOn(game.random, 'irandomRange').mockReturnValue(75);
        game.init(0);

        const player = createPlayerEntityFactory({
            classname: 'player',
            origin: { x: 0, y: 0, z: 0 },
            viewheight: 22,
            angles: { x: 0, y: 0, z: 0 },
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.Phalanx],
                    ammo: { [AmmoType.MagSlugs]: 10 },
                }),
                weaponStates: createPlayerWeaponStates(),
                buttons: 1,
                gun_frame: 8 // Alternate Shot
            } as any
        }) as Entity;
        game.entities.spawn = vi.fn().mockReturnValue(player);
        game.entities.finalizeSpawn(player);

        fire(game, player, WeaponId.Phalanx);

        expect(createPhalanxBall).toHaveBeenCalledWith(
            expect.anything(), player, expect.anything(), expect.anything(),
            75, // damage
            30, // radius
            725 // speed
        );
        expect(imports.multicast).toHaveBeenCalledWith(
            expect.anything(), MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_PHALANX2
        );
    });
});
