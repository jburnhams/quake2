// =================================================================
// Quake II - Machinegun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import * as damage from '../../../src/combat/damage.js';
import { createTestGame, spawnEntity, createPlayerEntityFactory, createEntityFactory } from '@quake2ts/test-utils';

describe('Machinegun', () => {
    it('should consume 1 bullet and deal damage', () => {
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { game, imports } = createTestGame();

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.Machinegun],
                    ammo: { [AmmoType.Bullets]: 50 },
                }),
                weaponStates: { states: new Map() }
            } as any
        }));

        const target = spawnEntity(game.entities, createEntityFactory({
            health: 100,
            takedamage: 1
        }));

        imports.trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
        });

        fire(game, player, WeaponId.Machinegun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(49);
        // 1 source trace + 1 bullet trace
        expect(imports.trace).toHaveBeenCalledTimes(2);
        expect(T_Damage).toHaveBeenCalled();
    });
});
