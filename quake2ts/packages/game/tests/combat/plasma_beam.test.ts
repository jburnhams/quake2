// =================================================================
// Quake II - Plasma Beam Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import { createPlayerWeaponStates } from '../../src/combat/weapons/state.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import * as damage from '../../src/combat/damage.js';
import { ServerCommand, TempEntity } from '@quake2ts/shared';

describe('Plasma Beam (Heatbeam)', () => {
    it('should fire a beam, consume ammo, and deal damage', () => {
        const trace = vi.fn().mockReturnValue({
            fraction: 0.5,
            endpos: { x: 100, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
            ent: { takedamage: true }
        });
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const sound = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            trace,
            sound,
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 }, rogue: true });
        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        player.viewheight = 22;
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.PlasmaBeam],
                ammo: { [AmmoType.Cells]: 50 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1, // BUTTON_ATTACK
        } as any;
        game.entities.finalizeSpawn(player);

        // Fire
        fire(game, player, WeaponId.PlasmaBeam);

        // Ammo consumption
        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(49);

        // Trace call
        expect(trace).toHaveBeenCalled();

        // Damage call
        expect(T_Damage).toHaveBeenCalledWith(
            expect.anything(), // ent
            player, // inflictor
            player, // attacker
            expect.anything(), // dir
            expect.anything(), // point
            expect.anything(), // normal
            15, // damage
            0, // knockback
            expect.anything(), // flags
            DamageMod.HEATBEAM,
            expect.anything(),
            expect.anything()
        );

        // Visual effects
        expect(multicast).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            ServerCommand.temp_entity,
            TempEntity.HEATBEAM,
            expect.anything(),
            expect.anything()
        );

         expect(multicast).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            ServerCommand.temp_entity,
            TempEntity.HEATBEAM_SPARKS,
            expect.anything(),
            expect.anything()
        );

        // Kickback
        expect(player.client!.kick_angles?.x).toBe(-0.5);
    });

    it('should not fire if out of ammo', () => {
        const trace = vi.fn();
        const multicast = vi.fn();
        const engine = { trace, sound: vi.fn(), centerprintf: vi.fn(), modelIndex: vi.fn() };
        const game = createGame({ trace, multicast }, engine, { gravity: { x: 0, y: 0, z: 0 } });
        game.init(0);

        const player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.PlasmaBeam],
                ammo: { [AmmoType.Cells]: 0 },
            }),
            weaponStates: createPlayerWeaponStates(),
        } as any;
        game.entities.finalizeSpawn(player);

        fire(game, player, WeaponId.PlasmaBeam);

        expect(trace).not.toHaveBeenCalled();
        expect(multicast).not.toHaveBeenCalled();
    });
});
