// =================================================================
// Quake II - Weapon Switching
// =================================================================

import { Entity } from '../../entities/entity.js';
import { PlayerInventory, WeaponId, selectWeapon } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';

export function switchToBestWeapon(player: Entity) {
    if (!player.client) {
        return;
    }

    const inventory = player.client.inventory;
    let bestWeapon: WeaponId | null = null;

    if (inventory.ownedWeapons.has(WeaponId.BFG10K) && inventory.ammo.counts[AmmoType.Cells] >= 50) {
        bestWeapon = WeaponId.BFG10K;
    } else if (inventory.ownedWeapons.has(WeaponId.RocketLauncher) && inventory.ammo.counts[AmmoType.Rockets] >= 1) {
        bestWeapon = WeaponId.RocketLauncher;
    } else if (inventory.ownedWeapons.has(WeaponId.Railgun) && inventory.ammo.counts[AmmoType.Slugs] >= 1) {
        bestWeapon = WeaponId.Railgun;
    } else if (inventory.ownedWeapons.has(WeaponId.Chaingun) && inventory.ammo.counts[AmmoType.Bullets] >= 1) {
        bestWeapon = WeaponId.Chaingun;
    } else if (inventory.ownedWeapons.has(WeaponId.SuperShotgun) && inventory.ammo.counts[AmmoType.Shells] >= 2) {
        bestWeapon = WeaponId.SuperShotgun;
    } else if (inventory.ownedWeapons.has(WeaponId.Machinegun) && inventory.ammo.counts[AmmoType.Bullets] >= 1) {
        bestWeapon = WeaponId.Machinegun;
    } else if (inventory.ownedWeapons.has(WeaponId.Shotgun) && inventory.ammo.counts[AmmoType.Shells] >= 1) {
        bestWeapon = WeaponId.Shotgun;
    } else {
        bestWeapon = WeaponId.Blaster;
    }

    if (bestWeapon) {
        selectWeapon(inventory, bestWeapon);
    }
}
