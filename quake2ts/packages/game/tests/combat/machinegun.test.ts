// =================================================================
// Quake II - Machinegun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Machinegun', () => {
    it('should consume 1 bullet and deal damage', () => {
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { imports, entities, game } = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });

        spawnEntity(entities, createEntityFactory({
            classname: 'info_player_start',
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 }
        }));

        game.spawnWorld();

        const player = entities.find(e => e.classname === 'player')!;
        if (!player.client) player.client = {} as any;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Machinegun],
            ammo: { [AmmoType.Bullets]: 50 },
        });

        const target = spawnEntity(entities, createEntityFactory({
            health: 100,
            takedamage: true
        }));

        imports.trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 },
            fraction: 0.1,
            startsolid: false,
            allsolid: false
        });

        fire(game, player, WeaponId.Machinegun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(49);
        // 1 source trace + 1 bullet trace
        expect(imports.trace).toHaveBeenCalledTimes(2);
        expect(T_Damage).toHaveBeenCalled();
    });
});
