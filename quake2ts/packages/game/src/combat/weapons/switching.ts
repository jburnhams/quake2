// =================================================================
// Quake II - Weapon Switching
// =================================================================

import { Entity } from '../../entities/entity.js';
import { PlayerInventory, WeaponId, selectWeapon } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';
import { WeaponStateEnum } from './state.js';
import { Weapon_AnimationTime } from './common.js';
import { WEAPON_ITEMS } from '../../inventory/items.js';
import {
    FRAME_GRENADE_IDLE_LAST,
    FRAME_SHOTGUN_IDLE_LAST,
    FRAME_SSHOTGUN_IDLE_LAST,
    FRAME_MACHINEGUN_IDLE_LAST,
    FRAME_CHAINGUN_IDLE_LAST,
    FRAME_RAILGUN_IDLE_LAST,
    FRAME_ROCKET_IDLE_LAST,
    FRAME_HYPERBLASTER_IDLE_LAST,
    FRAME_BFG_IDLE_LAST,
    FRAME_GRENADELAUNCHER_IDLE_LAST,
    FRAME_BLASTER_IDLE_LAST
} from './frames.js';

// TODO: This should be a cvar or config option
let instantSwitch = false;

export function setInstantSwitch(enabled: boolean) {
    instantSwitch = enabled;
}

/**
 * Helper to get the IDLE_LAST frame for the current weapon.
 * This is needed to start the deactivate sequence (usually IDLE_LAST + 1).
 */
function getWeaponIdleLastFrame(weaponId: WeaponId): number {
    switch (weaponId) {
        case WeaponId.HandGrenade: return FRAME_GRENADE_IDLE_LAST;
        case WeaponId.Shotgun: return FRAME_SHOTGUN_IDLE_LAST;
        case WeaponId.SuperShotgun: return FRAME_SSHOTGUN_IDLE_LAST;
        case WeaponId.Machinegun: return FRAME_MACHINEGUN_IDLE_LAST;
        case WeaponId.Chaingun: return FRAME_CHAINGUN_IDLE_LAST;
        case WeaponId.Railgun: return FRAME_RAILGUN_IDLE_LAST;
        case WeaponId.RocketLauncher: return FRAME_ROCKET_IDLE_LAST;
        case WeaponId.HyperBlaster: return FRAME_HYPERBLASTER_IDLE_LAST;
        case WeaponId.BFG10K: return FRAME_BFG_IDLE_LAST;
        case WeaponId.GrenadeLauncher: return FRAME_GRENADELAUNCHER_IDLE_LAST;
        case WeaponId.Blaster: return FRAME_BLASTER_IDLE_LAST;
        default: return 0; // Should not happen for standard weapons, or fallback
    }
}

/**
 * ChangeWeapon
 * Source: p_weapon.cpp:761-809
 */
export function ChangeWeapon(ent: Entity, weaponId?: WeaponId) {
    if (!ent.client) return;

    const client = ent.client;

    if (weaponId) {
        // Queue the weapon switch
        if (client.weaponstate === WeaponStateEnum.WEAPON_DROPPING) {
            client.newWeapon = weaponId;
            return;
        }

        if (client.weaponstate === WeaponStateEnum.WEAPON_READY || client.weaponstate === WeaponStateEnum.WEAPON_FIRING) {
            client.newWeapon = weaponId;
            client.weaponstate = WeaponStateEnum.WEAPON_DROPPING;

            // Start deactivate sequence
            // Usually starts after IDLE_LAST
            if (client.inventory.currentWeapon) {
                client.gun_frame = getWeaponIdleLastFrame(client.inventory.currentWeapon) + 1;
            } else {
                 client.gun_frame = 0;
            }

            if (instantSwitch) {
                selectWeapon(client.inventory, weaponId);
                client.weaponstate = WeaponStateEnum.WEAPON_READY;
                client.weapon_think_time = 0;
                client.newWeapon = undefined;
            }
            return;
        }

        // If activating, we could override? For now, ignore or queue.
        // Original Q2 sometimes ignores if activating.
        client.newWeapon = weaponId;
        return;
    }

    // No weaponId means finalize the switch (called from animation end)
    if (client.newWeapon) {
        selectWeapon(client.inventory, client.newWeapon);
        client.weaponstate = WeaponStateEnum.WEAPON_ACTIVATING;
        client.gun_frame = 0;
        client.weapon_think_time = 0;
        client.newWeapon = undefined; // Clear pending
    }
}

/**
 * Auto-Switch on Empty Ammo
 * Source: p_weapon.cpp: NoAmmoWeaponChange
 */
export function NoAmmoWeaponChange(ent: Entity) {
    if (!ent.client) return;

    // Find best weapon
    const bestWeapon = getBestWeapon(ent);
    if (bestWeapon && bestWeapon !== ent.client.inventory.currentWeapon) {
        // Initiate switch
        ChangeWeapon(ent, bestWeapon);
    }
}

export function getBestWeapon(player: Entity): WeaponId | null {
    if (!player.client) {
        return null;
    }
    const inventory = player.client.inventory;

    if (inventory.ownedWeapons.has(WeaponId.BFG10K) && inventory.ammo.counts[AmmoType.Cells] >= 50) {
        return WeaponId.BFG10K;
    } else if (inventory.ownedWeapons.has(WeaponId.RocketLauncher) && inventory.ammo.counts[AmmoType.Rockets] >= 1) {
        return WeaponId.RocketLauncher;
    } else if (inventory.ownedWeapons.has(WeaponId.HyperBlaster) && inventory.ammo.counts[AmmoType.Cells] >= 1) {
        return WeaponId.HyperBlaster;
    } else if (inventory.ownedWeapons.has(WeaponId.Railgun) && inventory.ammo.counts[AmmoType.Slugs] >= 1) {
        return WeaponId.Railgun;
    } else if (inventory.ownedWeapons.has(WeaponId.Chaingun) && inventory.ammo.counts[AmmoType.Bullets] >= 1) {
        return WeaponId.Chaingun;
    } else if (inventory.ownedWeapons.has(WeaponId.GrenadeLauncher) && inventory.ammo.counts[AmmoType.Grenades] >= 1) {
        return WeaponId.GrenadeLauncher;
    } else if (inventory.ownedWeapons.has(WeaponId.SuperShotgun) && inventory.ammo.counts[AmmoType.Shells] >= 2) {
        return WeaponId.SuperShotgun;
    } else if (inventory.ownedWeapons.has(WeaponId.Machinegun) && inventory.ammo.counts[AmmoType.Bullets] >= 1) {
        return WeaponId.Machinegun;
    } else if (inventory.ownedWeapons.has(WeaponId.Shotgun) && inventory.ammo.counts[AmmoType.Shells] >= 1) {
        return WeaponId.Shotgun;
    } else {
        return WeaponId.Blaster;
    }
}

// Kept for backward compatibility if needed, but delegates to ChangeWeapon
export function switchToBestWeapon(player: Entity) {
    if (!player.client) return;
    const best = getBestWeapon(player);
    if (best && best !== player.client.inventory.currentWeapon) {
        // Old behavior was instant switch? Or forced switch?
        // Let's use ChangeWeapon to be safe and consistent.
        // But tests expected immediate effect if instantSwitch is on?

        // Use direct manipulation if we want to force it (like on spawn)
        // selectWeapon(player.client.inventory, best);
        // player.client.weaponstate = WeaponStateEnum.WEAPON_ACTIVATING;
        // player.client.gun_frame = 0;

        // Better to use ChangeWeapon
        ChangeWeapon(player, best);
    }
}
