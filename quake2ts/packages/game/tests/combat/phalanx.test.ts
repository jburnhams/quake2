// =================================================================
// Quake II - Phalanx Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import { createPlayerWeaponStates } from '../../src/combat/weapons/state.js';
import * as projectiles from '../../src/entities/projectiles.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { MulticastType } from '../../src/imports.js';
import { ServerCommand, TempEntity, MZ_PHALANX, MZ_PHALANX2 } from '@quake2ts/shared';

describe('Phalanx', () => {
    it('should fire standard shot (Frame != 8) with radius 120 and MZ_PHALANX', () => {
        const trace = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        const multicast = vi.fn();
        const createPhalanxBall = vi.spyOn(projectiles, 'createPhalanxBall');

        const engine = {
            trace,
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn().mockReturnValue(1),
        };
        const game = createGame({ trace, pointcontents: vi.fn(), linkentity: vi.fn(), multicast, unicast: vi.fn() }, engine, { gravity: { x: 0, y: 0, z: -800 }, rogue: true });

        vi.spyOn(game.random, 'irandomRange').mockReturnValue(75);

        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        player.viewheight = 22;
        player.angles = { x: 0, y: 0, z: 0 };
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.Phalanx],
                ammo: { [AmmoType.MagSlugs]: 10 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1,
            gun_frame: 0 // Standard Shot
        } as any;
        game.entities.finalizeSpawn(player);

        fire(game, player, WeaponId.Phalanx);

        expect(player.client!.inventory.ammo.counts[AmmoType.MagSlugs]).toBe(9);
        expect(createPhalanxBall).toHaveBeenCalledWith(
            expect.anything(), player, expect.anything(), expect.anything(),
            75, // damage
            120, // radius
            725 // speed
        );
        expect(multicast).toHaveBeenCalledWith(
            expect.anything(), MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_PHALANX
        );
    });

    it('should fire alternate shot (Frame 8) with radius 30 and MZ_PHALANX2', () => {
        const trace = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        const multicast = vi.fn();
        const createPhalanxBall = vi.spyOn(projectiles, 'createPhalanxBall');

        const engine = {
            trace,
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn().mockReturnValue(1),
        };
        const game = createGame({ trace, pointcontents: vi.fn(), linkentity: vi.fn(), multicast, unicast: vi.fn() }, engine, { gravity: { x: 0, y: 0, z: -800 }, rogue: true });

        vi.spyOn(game.random, 'irandomRange').mockReturnValue(75);
        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        player.viewheight = 22;
        player.angles = { x: 0, y: 0, z: 0 };
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.Phalanx],
                ammo: { [AmmoType.MagSlugs]: 10 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1,
            gun_frame: 8 // Alternate Shot
        } as any;
        game.entities.finalizeSpawn(player);

        fire(game, player, WeaponId.Phalanx);

        expect(createPhalanxBall).toHaveBeenCalledWith(
            expect.anything(), player, expect.anything(), expect.anything(),
            75, // damage
            30, // radius
            725 // speed
        );
        expect(multicast).toHaveBeenCalledWith(
            expect.anything(), MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_PHALANX2
        );
    });
});
