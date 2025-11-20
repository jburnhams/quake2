// =================================================================
// Quake II - Item Definitions
// =================================================================

import { AmmoType } from './ammo.js';
import { WeaponId } from './playerInventory.js';

export interface BaseItem {
    id: string; // classname
    name: string; // pickup name
}

export interface WeaponItem extends BaseItem {
    type: 'weapon';
    weaponId: WeaponId;
    ammoType: AmmoType | null;
    initialAmmo: number;
    pickupAmmo: number;
}

export const WEAPON_ITEMS: Record<string, WeaponItem> = {
    'weapon_blaster': {
        type: 'weapon',
        id: 'weapon_blaster',
        name: 'Blaster',
        weaponId: WeaponId.Blaster,
        ammoType: null,
        initialAmmo: 0,
        pickupAmmo: 0,
    },
    'weapon_shotgun': {
        type: 'weapon',
        id: 'weapon_shotgun',
        name: 'Shotgun',
        weaponId: WeaponId.Shotgun,
        ammoType: AmmoType.Shells,
        initialAmmo: 10,
        pickupAmmo: 10,
    },
    'weapon_supershotgun': {
        type: 'weapon',
        id: 'weapon_supershotgun',
        name: 'Super Shotgun',
        weaponId: WeaponId.SuperShotgun,
        ammoType: AmmoType.Shells,
        initialAmmo: 10,
        pickupAmmo: 10,
    },
    'weapon_machinegun': {
        type: 'weapon',
        id: 'weapon_machinegun',
        name: 'Machinegun',
        weaponId: WeaponId.Machinegun,
        ammoType: AmmoType.Bullets,
        initialAmmo: 50,
        pickupAmmo: 50,
    },
    'weapon_chaingun': {
        type: 'weapon',
        id: 'weapon_chaingun',
        name: 'Chaingun',
        weaponId: WeaponId.Chaingun,
        ammoType: AmmoType.Bullets,
        initialAmmo: 50,
        pickupAmmo: 50,
    },
    'weapon_grenadelauncher': {
        type: 'weapon',
        id: 'weapon_grenadelauncher',
        name: 'Grenade Launcher',
        weaponId: WeaponId.GrenadeLauncher,
        ammoType: AmmoType.Grenades,
        initialAmmo: 10,
        pickupAmmo: 10,
    },
    'weapon_rocketlauncher': {
        type: 'weapon',
        id: 'weapon_rocketlauncher',
        name: 'Rocket Launcher',
        weaponId: WeaponId.RocketLauncher,
        ammoType: AmmoType.Rockets,
        initialAmmo: 5,
        pickupAmmo: 5,
    },
    'weapon_hyperblaster': {
        type: 'weapon',
        id: 'weapon_hyperblaster',
        name: 'HyperBlaster',
        weaponId: WeaponId.HyperBlaster,
        ammoType: AmmoType.Cells,
        initialAmmo: 50,
        pickupAmmo: 50,
    },
    'weapon_railgun': {
        type: 'weapon',
        id: 'weapon_railgun',
        name: 'Railgun',
        weaponId: WeaponId.Railgun,
        ammoType: AmmoType.Slugs,
        initialAmmo: 10,
        pickupAmmo: 10,
    },
    'weapon_bfg': {
        type: 'weapon',
        id: 'weapon_bfg',
        name: 'BFG10K',
        weaponId: WeaponId.BFG10K,
        ammoType: AmmoType.Cells,
        initialAmmo: 50,
        pickupAmmo: 50,
    },
};
