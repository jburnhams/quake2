// =================================================================
// Quake II - Weapon Switching
// =================================================================

import { Entity } from '../../entities/entity.js';
import { PlayerInventory, WeaponId, selectWeapon } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';
import { WeaponStateEnum } from './state.js';
import { Weapon_AnimationTime } from './animation.js';

// TODO: This should be a cvar or config option
let instantSwitch = false;

export function setInstantSwitch(enabled: boolean) {
    instantSwitch = enabled;
}

/**
 * ChangeWeapon
 * Source: p_weapon.cpp:761-809
 */
export function ChangeWeapon(ent: Entity, weaponId?: WeaponId) {
    if (!ent.client) return;

    const client = ent.client;

    // If we are already dropping, do nothing
    if (client.weaponstate === WeaponStateEnum.WEAPON_DROPPING) {
        return;
    }

    if (weaponId) {
        // Direct switch
        selectWeapon(client.inventory, weaponId);
        client.weaponstate = WeaponStateEnum.WEAPON_ACTIVATING;
        client.gun_frame = 0;

        // Instant Switch Logic
        // Source: rerelease/p_weapon.cpp
        // if (g_instant_weapon_switch->integer) ...

        // In this implementation, we check if instant switch is enabled.
        // We can expose a global or check ent.context (if we add config access).
        // For now, let's use a module-level variable that can be toggled,
        // or check ent.client.pers.instantSwitch if we add it.
        // The original uses a global cvar `g_instant_weapon_switch`.

        // Assuming we pass this option via GameCreateOptions or similar in future.
        // But the task is to implement the option.

        if (instantSwitch) {
             client.weaponstate = WeaponStateEnum.WEAPON_READY;
             client.weapon_think_time = 0;
             // Skip activation frames
             // Actually, if we set state to READY, we might need to set gun_frame to IDLE?
             // Or rely on Weapon_Generic to handle transitions?
             // If we set state to READY, Weapon_Generic will start idle loop on next think.

             // However, `ChangeWeapon` is also called to *finish* the drop.
             // If we are here, we are *starting* the new weapon.

             // If instant switch, we skip raise/lower.

             return;
        }

        client.weapon_think_time = 0; // Start immediately
    }
}

/**
 * Auto-Switch on Empty Ammo
 * Source: p_weapon.cpp: NoAmmoWeaponChange
 */
export function NoAmmoWeaponChange(ent: Entity) {
    if (!ent.client) return;

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
        selectWeapon(inventory, bestWeapon);

        player.client.weaponstate = WeaponStateEnum.WEAPON_ACTIVATING;
        player.client.gun_frame = 0;

        if (instantSwitch) {
             player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        }

        player.client.weapon_think_time = 0;
    }
}
