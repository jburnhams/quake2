// =================================================================
// Quake II - Weapon Switching
// =================================================================

import { Entity } from '../../entities/entity.js';
import { PlayerInventory, WeaponId, selectWeapon } from '../../inventory/playerInventory.js';

export function switchToBestWeapon(player: Entity) {
    if (!player.client) {
        return;
    }

    const inventory = player.client.inventory;
    let bestWeapon: WeaponId | null = null;

    if (inventory.ownedWeapons.has(WeaponId.BFG10K) && inventory.ammo.cells >= 50) {
        bestWeapon = WeaponId.BFG10K;
    } else if (inventory.ownedWeapons.has(WeaponId.RocketLauncher) && inventory.ammo.rockets >= 1) {
        bestWeapon = WeaponId.RocketLauncher;
    } else if (inventory.ownedWeapons.has(WeaponId.Railgun) && inventory.ammo.slugs >= 1) {
        bestWeapon = WeaponId.Railgun;
    } else if (inventory.ownedWeapons.has(WeaponId.Chaingun) && inventory.ammo.bullets >= 1) {
        bestWeapon = WeaponId.Chaingun;
    } else if (inventory.ownedWeapons.has(WeaponId.SuperShotgun) && inventory.ammo.shells >= 2) {
        bestWeapon = WeaponId.SuperShotgun;
    } else if (inventory.ownedWe-apons.has(WeaponId.Machinegun) && inventory.ammo.bullets >= 1) {
        bestWeapon = WeaponId.Machinegun;
    } else if (inventory.ownedWeapons.has(WeaponId.Shotgun) && inventory.ammo.shells >= 1) {
        bestWeapon = WeaponId.Shotgun;
    } else {
        bestWeapon = WeaponId.Blaster;
    }

    if (bestWeapon) {
        selectWeapon(inventory, bestWeapon);
    }
}
