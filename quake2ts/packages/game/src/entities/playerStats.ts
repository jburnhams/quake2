import { Entity } from './entity.js';
import { PlayerStat, G_SetAmmoStat } from '@quake2ts/shared';
import { WeaponId, PowerupId } from '../inventory/playerInventory.js';
import { AmmoType } from '../inventory/ammo.js';
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
    WeaponId.HyperBlaster,
    WeaponId.Railgun,
    WeaponId.BFG10K
];

// Order matches Q2 original ammo wheel index order
const AMMO_WHEEL_ORDER: AmmoType[] = [
    AmmoType.Shells,
    AmmoType.Bullets,
    AmmoType.Cells,
    AmmoType.Rockets,
    AmmoType.Slugs
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
    const statArray: number[] = new Array(32).fill(0);

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
        if (weaponItem && weaponItem.ammoType) {
            statArray[PlayerStat.STAT_AMMO] = inventory.ammo.counts[weaponItem.ammoType] || 0;
        }
    }

    // Ammo Info (All Types)
    for (let i = 0; i < AMMO_WHEEL_ORDER.length; i++) {
        const ammoType = AMMO_WHEEL_ORDER[i];
        const count = inventory.ammo.counts[ammoType] || 0;
        // STAT_AMMO_INFO_START is 20 in shared definitions
        statArray[PlayerStat.STAT_AMMO_INFO_START + i] = G_SetAmmoStat(count);
    }

    // Timer (Powerups)
    let bestTime = Infinity;
    let bestPowerup: PowerupId | null = null;

    const nowMs = timeSeconds * 1000;

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
        // statArray[PlayerStat.STAT_TIMER_ICON] = ... // Skipped
    }

    return statArray;
}
