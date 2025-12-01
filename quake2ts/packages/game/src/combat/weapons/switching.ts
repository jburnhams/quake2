// =================================================================
// Quake II - Weapon Switching
// =================================================================

import { Entity } from '../../entities/entity.js';
import { PlayerInventory, WeaponId, selectWeapon } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';
import { WeaponStateEnum } from './state.js';
import { Weapon_AnimationTime } from './animation.js';

/**
 * ChangeWeapon
 * Source: p_weapon.cpp:761-809
 */
export function ChangeWeapon(ent: Entity, weaponId?: WeaponId) {
    if (!ent.client) return;

    // If no weapon specified, check if we have a pending weapon change?
    // In Q2, `ent->client->newweapon` stores the pending weapon.
    // We don't have `newweapon` in our `PlayerClient` yet, or we assume `currentWeapon` is the target?

    // If we call this, we probably want to initiate the switch.

    // For now, let's implement the logic to START the switch (Put away old).

    const client = ent.client;

    // If we are already dropping, do nothing
    if (client.weaponstate === WeaponStateEnum.WEAPON_DROPPING) {
        return;
    }

    // If we are activating, we can override?
    // "Weapon Change Request: Player selects new weapon -> sets newweapon"
    // "If in READY state: Transition to DROPPING"

    // We need a place to store "next weapon".
    // Let's add it to PlayerClient if needed, or pass it.

    // Assuming `ChangeWeapon` is called when the animation completes (DROPPING finished).
    // Or it is called to START the switch?

    // In Q2:
    // void ChangeWeapon (edict_t *ent) {
    //    if (ent->client->weiaponstate == WEAPON_DROPPING) {
    //        // finish dropping
    //        ent->client->pers.lastweapon = ent->client->pers.weapon;
    //        ent->client->pers.weapon = ent->client->newweapon;
    //        ent->client->weaponstate = WEAPON_ACTIVATING;
    //        ent->client->ps.gunframe = 0;
    //        ent->client->weapon_think_time = 0;
    //        return;
    //    }
    //    // Start dropping
    //    ent->client->weaponstate = WEAPON_DROPPING;
    //    ent->client->ps.gunframe = FRAME_DEACTIVATE_FIRST; // Or similar
    //    ent->client->weapon_think_time = 0;
    // }

    // So ChangeWeapon is called to START and also called (or logic runs) to FINISH.

    // Here, let's make `ChangeWeapon` the function that handles the actual swap.
    // The "Start Dropping" logic should be in the input handling or `weapon_think`.

    // But for this task "15.0.2.5: Weapon Switching", it says:
    // "ChangeWeapon() Logic: Remove old weapon, Equip new weapon, Set state to ACTIVATING"

    // So this function is likely the "Finish Dropping / Start Raising" part.

    if (weaponId) {
        // Direct switch (instant or after drop)
        selectWeapon(client.inventory, weaponId);
        client.weaponstate = WeaponStateEnum.WEAPON_ACTIVATING;
        client.gun_frame = 0;
        client.weapon_think_time = 0; // Start immediately
    }
}

/**
 * Auto-Switch on Empty Ammo
 * Source: p_weapon.cpp: NoAmmoWeaponChange
 */
export function NoAmmoWeaponChange(ent: Entity) {
    if (!ent.client) return;

    // TODO: Check if we have ammo for current weapon.
    // This is usually called when fire fails.

    // Find best weapon
    switchToBestWeapon(ent);
}

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

    if (bestWeapon && bestWeapon !== inventory.currentWeapon) {
        // Here we should trigger the switch animation sequence
        // For now, we just switch state to ACTIVATING if we select it.
        // But if we are mid-fire, we might need to be careful.

        // selectWeapon updates currentWeapon.
        // We need to reset state.

        selectWeapon(inventory, bestWeapon);
        player.client.weaponstate = WeaponStateEnum.WEAPON_ACTIVATING;
        player.client.gun_frame = 0;
        player.client.weapon_think_time = 0;
    }
}
