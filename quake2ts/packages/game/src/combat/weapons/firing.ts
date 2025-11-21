// =================================================================
// Quake II - Weapon Firing
// =================================================================

import { Entity } from '../../entities/entity.js';
import { GameExports } from '../../index.js';
import { getWeaponState } from './state.js';
import { WEAPON_ITEMS, WeaponItem } from '../../inventory/items.js';
import { PlayerInventory, WeaponId } from '../../inventory/playerInventory.js';
import { T_Damage } from '../damage.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import { DamageFlags } from '../damageFlags.js';

export function fire(game: GameExports, player: Entity, weaponId: WeaponId) {
    if (!player.client) {
        return;
    }

    const inventory = player.client.inventory;
    const weaponItem = Object.values(WEAPON_ITEMS).find(item => item.weaponId === weaponId);

    if (!weaponItem) {
        return;
    }

    const weaponState = getWeaponState(player.client.weaponStates, weaponId);

    if (game.time < weaponState.lastFireTime) {
        return;
    }

    if (weaponItem.ammoType) {
        if (inventory.ammo[weaponItem.ammoType] < 1) {
            return;
        }
        inventory.ammo[weaponItem.ammoType] -= 1;
    }

    // TODO: Implement instant hit and projectile weapons
    // For now, we'll just apply some damage to a dummy target

    const target = game.entities.find(e => e.classname === 'monster_ogre');

    if (target) {
        T_Damage(target, player, player, ZERO_VEC3, ZERO_VEC3, ZERO_VEC3, 10, 10, DamageFlags.None, 0);
    }

    weaponState.lastFireTime = game.time + 0.5; // TODO: Use weapon fire rate
}
