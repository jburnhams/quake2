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
import { createRocket } from '../../entities/projectiles.js';

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
        if (inventory.ammo.counts[weaponItem.ammoType] < 1) {
            return;
        }
        inventory.ammo.counts[weaponItem.ammoType] -= 1;
    }

    switch (weaponId) {
        case WeaponId.Shotgun:
        case WeaponId.SuperShotgun:
        case WeaponId.Machinegun:
        case WeaponId.Chaingun:
        case WeaponId.Railgun:
            // Instant-hit weapon logic
            // TODO: Implement trace logic
            break;
        case WeaponId.RocketLauncher:
            // Projectile weapon logic
            createRocket(game, player, player.origin, { x: 1, y: 0, z: 0 }, 100, 650);
            break;
        case WeaponId.GrenadeLauncher:
        case WeaponId.BFG10K:
        case WeaponId.Blaster:
            // Projectile weapon logic
            // TODO: Implement other projectiles
            break;
    }

    weaponState.lastFireTime = game.time + weaponItem.fireRate;
}
