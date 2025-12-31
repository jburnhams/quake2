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
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';
import { createEntityFactory } from '@quake2ts/test-utils';
import { createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';

describe('Plasma Beam (Heatbeam)', () => {
    it('should fire a beam, consume ammo, and deal damage', () => {
        const customTrace = vi.fn().mockReturnValue({
            fraction: 0.5,
            endpos: { x: 100, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
            ent: { takedamage: true }
        });
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { imports, engine } = createGameImportsAndEngine({
            imports: {
                trace: customTrace,
            },
        });
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 }, rogue: true });
        game.init(0);

        const player = createPlayerEntityFactory({
            classname: 'player',
            origin: { x: 0, y: 0, z: 0 },
            viewheight: 22,
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.PlasmaBeam],
                    ammo: { [AmmoType.Cells]: 50 },
                }),
                weaponStates: createPlayerWeaponStates(),
                buttons: 1, // BUTTON_ATTACK
            } as any
        }) as any;
        game.entities.spawn = vi.fn().mockReturnValue(player);
        game.entities.finalizeSpawn(player);

        // Fire
        fire(game, player, WeaponId.PlasmaBeam);

        // Ammo consumption
        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(49);

        // Trace call
        expect(customTrace).toHaveBeenCalled();

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
        expect(imports.multicast).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            ServerCommand.temp_entity,
            TempEntity.HEATBEAM,
            expect.anything(),
            expect.anything()
        );

         expect(imports.multicast).toHaveBeenCalledWith(
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
        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: 0 } });
        game.init(0);

        const player = createPlayerEntityFactory({
            classname: 'player',
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.PlasmaBeam],
                    ammo: { [AmmoType.Cells]: 0 },
                }),
                weaponStates: createPlayerWeaponStates(),
            } as any
        });
        game.entities.spawn = vi.fn().mockReturnValue(player);
        game.entities.finalizeSpawn(player);

        fire(game, player, WeaponId.PlasmaBeam);

        // P_ProjectSource calls trace, so we don't expect 'not.toHaveBeenCalled()' for trace
        expect(imports.multicast).not.toHaveBeenCalled();
    });
});
