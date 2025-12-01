import { Entity } from './entity.js';
import { PlayerStat, G_SetAmmoStat, G_SetPowerupStat, AmmoType, AMMO_TYPE_COUNT, AMMO_MAX } from '@quake2ts/shared';
import { WeaponId, PowerupId } from '../inventory/playerInventory.js';
import { WEAPON_ITEMS } from '../inventory/items.js';

// Order matches Q2 original weapon wheel index order for bitmask generation
const WEAPON_WHEEL_ORDER: WeaponId[] = [
    WeaponId.Blaster,
    WeaponId.Shotgun,
    WeaponId.SuperShotgun,
    WeaponId.Machinegun,
    WeaponId.Chaingun,
    WeaponId.GrenadeLauncher,
    WeaponId.RocketLauncher,
    WeaponId.HandGrenade,
    WeaponId.HyperBlaster,
    WeaponId.Railgun,
    WeaponId.BFG10K
];

// Powerup wheel mapping (based on original game)
// Used for finding the active timer
const POWERUP_TIMERS: { id: PowerupId, priority: number }[] = [
    { id: PowerupId.QuadDamage, priority: 1 },
    { id: PowerupId.Invulnerability, priority: 2 },
    { id: PowerupId.EnviroSuit, priority: 3 },
    { id: PowerupId.Rebreather, priority: 4 },
    { id: PowerupId.Silencer, priority: 5 }
];

export function populatePlayerStats(player: Entity, timeSeconds: number): number[] {
    if (!player.client) return [];

    const inventory = player.client.inventory;
    // Increased size to 64 to accommodate new STAT_ indices (max ~54)
    const statArray: number[] = new Array(64).fill(0);

    // Health
    statArray[PlayerStat.STAT_HEALTH] = player.health;

    // Armor
    if (inventory.armor) {
        statArray[PlayerStat.STAT_ARMOR] = inventory.armor.armorCount;
    }

    // Weapons Bitmask
    let weaponBits = 0;
    for (let i = 0; i < WEAPON_WHEEL_ORDER.length; i++) {
        const weaponId = WEAPON_WHEEL_ORDER[i];
        if (inventory.ownedWeapons.has(weaponId)) {
            weaponBits |= (1 << i);
        }
    }
    statArray[PlayerStat.STAT_WEAPONS_OWNED_1] = weaponBits & 0xFFFF;
    statArray[PlayerStat.STAT_WEAPONS_OWNED_2] = (weaponBits >> 16) & 0xFFFF;

    // Ammo (Current Weapon)
    statArray[PlayerStat.STAT_AMMO] = 0;
    if (inventory.currentWeapon) {
        const weaponItem = Object.values(WEAPON_ITEMS).find(item => item.weaponId === inventory.currentWeapon);
        // Explicitly check for null because Blaster has ammoType: null
        if (weaponItem && weaponItem.ammoType !== null && weaponItem.ammoType !== undefined) {
             // STAT_AMMO is simple int
            statArray[PlayerStat.STAT_AMMO] = inventory.ammo.counts[weaponItem.ammoType] || 0;
        }
    }

    // Ammo Info (All Types)
    // We only need to iterate up to AMMO_MAX (C++ protocol limit), as G_SetAmmoStat rejects higher IDs anyway.
    // This avoids iterating over custom/extra ammo types that are not part of the standard protocol.
    for (let i = 0; i < AMMO_MAX; i++) {
        // Safe access since inventory.ammo.counts is usually larger (AMMO_TYPE_COUNT)
        const count = inventory.ammo.counts[i] || 0;
        G_SetAmmoStat(statArray, i, count);
    }

    // Powerups Info
    // Set powerup stats (active/timer bits)
    const nowMs = timeSeconds * 1000;

    for (const [id, expiresAt] of inventory.powerups) {
        if (expiresAt && expiresAt > nowMs) {
             // Active
             // Cast to any because PowerupId from playerInventory (game) matches PowerupId from shared
             G_SetPowerupStat(statArray, id as any, 1);
        }
    }

    // Timer (HUD Timer for best powerup)
    let bestTime = Infinity;
    let bestPowerup: PowerupId | null = null;

    for (const { id } of POWERUP_TIMERS) {
        const expiresAt = inventory.powerups.get(id);
        if (expiresAt && expiresAt > nowMs) {
            if (expiresAt < bestTime) {
                bestTime = expiresAt;
                bestPowerup = id;
            }
        }
    }

    if (bestPowerup && bestTime !== Infinity) {
        const remainingSeconds = Math.ceil((bestTime - nowMs) / 1000);
        statArray[PlayerStat.STAT_TIMER] = remainingSeconds;
        // statArray[PlayerStat.STAT_TIMER_ICON] = ...
    }

    return statArray;
}
