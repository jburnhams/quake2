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
    fireRate: number;
}

export interface HealthItem extends BaseItem {
    type: 'health';
    amount: number;
    max: number;
}

export interface ArmorItem extends BaseItem {
    type: 'armor';
    amount: number;
}

export interface PowerupItem extends BaseItem {
    type: 'powerup';
    timer: number;
}

export interface PowerArmorItem extends BaseItem {
    type: 'power_armor';
    armorType: 'screen' | 'shield';
}

export interface KeyItem extends BaseItem {
    type: 'key';
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
        fireRate: 0.5,
    },
    'weapon_shotgun': {
        type: 'weapon',
        id: 'weapon_shotgun',
        name: 'Shotgun',
        weaponId: WeaponId.Shotgun,
        ammoType: AmmoType.Shells,
        initialAmmo: 10,
        pickupAmmo: 10,
        fireRate: 1,
    },
    'weapon_supershotgun': {
        type: 'weapon',
        id: 'weapon_supershotgun',
        name: 'Super Shotgun',
        weaponId: WeaponId.SuperShotgun,
        ammoType: AmmoType.Shells,
        initialAmmo: 10,
        pickupAmmo: 10,
        fireRate: 1,
    },
    'weapon_machinegun': {
        type: 'weapon',
        id: 'weapon_machinegun',
        name: 'Machinegun',
        weaponId: WeaponId.Machinegun,
        ammoType: AmmoType.Bullets,
        initialAmmo: 50,
        pickupAmmo: 50,
        fireRate: 0.1,
    },
    'weapon_chaingun': {
        type: 'weapon',
        id: 'weapon_chaingun',
        name: 'Chaingun',
        weaponId: WeaponId.Chaingun,
        ammoType: AmmoType.Bullets,
        initialAmmo: 50,
        pickupAmmo: 50,
        fireRate: 0.1,
    },
    'weapon_grenadelauncher': {
        type: 'weapon',
        id: 'weapon_grenadelauncher',
        name: 'Grenade Launcher',
        weaponId: WeaponId.GrenadeLauncher,
        ammoType: AmmoType.Grenades,
        initialAmmo: 10,
        pickupAmmo: 10,
        fireRate: 1,
    },
    'weapon_rocketlauncher': {
        type: 'weapon',
        id: 'weapon_rocketlauncher',
        name: 'Rocket Launcher',
        weaponId: WeaponId.RocketLauncher,
        ammoType: AmmoType.Rockets,
        initialAmmo: 5,
        pickupAmmo: 5,
        fireRate: 1,
    },
    'weapon_hyperblaster': {
        type: 'weapon',
        id: 'weapon_hyperblaster',
        name: 'HyperBlaster',
        weaponId: WeaponId.HyperBlaster,
        ammoType: AmmoType.Cells,
        initialAmmo: 50,
        pickupAmmo: 50,
        fireRate: 0.1,
    },
    'weapon_railgun': {
        type: 'weapon',
        id: 'weapon_railgun',
        name: 'Railgun',
        weaponId: WeaponId.Railgun,
        ammoType: AmmoType.Slugs,
        initialAmmo: 10,
        pickupAmmo: 10,
        fireRate: 1.5,
    },
    'weapon_bfg': {
        type: 'weapon',
        id: 'weapon_bfg',
        name: 'BFG10K',
        weaponId: WeaponId.BFG10K,
        ammoType: AmmoType.Cells,
        initialAmmo: 50,
        pickupAmmo: 50,
        fireRate: 1,
    },
};

export const HEALTH_ITEMS: Record<string, HealthItem> = {
    'item_health_small': {
        type: 'health',
        id: 'item_health_small',
        name: 'Small Health',
        amount: 2,
        max: 100,
    },
    'item_health': {
        type: 'health',
        id: 'item_health',
        name: 'Medium Health',
        amount: 10,
        max: 100,
    },
    'item_health_large': {
        type: 'health',
        id: 'item_health_large',
        name: 'Large Health',
        amount: 25,
        max: 100,
    },
    'item_health_mega': {
        type: 'health',
        id: 'item_health_mega',
        name: 'Mega Health',
        amount: 100,
        max: 200,
    },
};

export const ARMOR_ITEMS: Record<string, ArmorItem> = {
    'item_armor_shard': {
        type: 'armor',
        id: 'item_armor_shard',
        name: 'Armor Shard',
        amount: 2,
    },
    'item_armor_jacket': {
        type: 'armor',
        id: 'item_armor_jacket',
        name: 'Jacket Armor',
        amount: 25,
    },
    'item_armor_combat': {
        type: 'armor',
        id: 'item_armor_combat',
        name: 'Combat Armor',
        amount: 50,
    },
    'item_armor_body': {
        type: 'armor',
        id: 'item_armor_body',
        name: 'Body Armor',
        amount: 100,
    },
};

export const POWERUP_ITEMS: Record<string, PowerupItem> = {
    'item_quad': {
        type: 'powerup',
        id: 'item_quad',
        name: 'Quad Damage',
        timer: 30,
    },
    'item_invulnerability': {
        type: 'powerup',
        id: 'item_invulnerability',
        name: 'Invulnerability',
        timer: 30,
    },
    'item_silencer': {
        type: 'powerup',
        id: 'item_silencer',
        name: 'Silencer',
        timer: 30,
    },
    'item_rebreather': {
        type: 'powerup',
        id: 'item_rebreather',
        name: 'Rebreather',
        timer: 30,
    },
    'item_enviro': {
        type: 'powerup',
        id: 'item_enviro',
        name: 'Enviro Suit',
        timer: 30,
    },
};

export const POWER_ARMOR_ITEMS: Record<string, PowerArmorItem> = {
    'item_power_screen': {
        type: 'power_armor',
        id: 'item_power_screen',
        name: 'Power Screen',
        armorType: 'screen',
    },
    'item_power_shield': {
        type: 'power_armor',
        id: 'item_power_shield',
        name: 'Power Shield',
        armorType: 'shield',
    },
};

export const KEY_ITEMS: Record<string, KeyItem> = {
    'key_blue': {
        type: 'key',
        id: 'key_blue',
        name: 'Blue Key',
    },
    'key_red': {
        type: 'key',
        id: 'key_red',
        name: 'Red Key',
    },
    'key_green': {
        type: 'key',
        id: 'key_green',
        name: 'Green Key',
    },
    'key_yellow': {
        type: 'key',
        id: 'key_yellow',
        name: 'Yellow Key',
    },
};
