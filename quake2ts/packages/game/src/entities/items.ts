// =================================================================
// Quake II - Item Registration
// =================================================================

import { SpawnRegistry } from './spawn.js';
import { GameExports } from '../index.js';
import {
    WEAPON_ITEMS,
    HEALTH_ITEMS,
    ARMOR_ITEMS,
    POWERUP_ITEMS,
    KEY_ITEMS,
    POWER_ARMOR_ITEMS,
} from '../inventory/items.js';
import { createWeaponPickupEntity } from './items/weapons.js';
export { createWeaponPickupEntity } from './items/weapons.js';
import { createHealthPickupEntity } from './items/health.js';
import { createArmorPickupEntity } from './items/armor.js';
import { createPowerupPickupEntity } from './items/powerups.js';
import { createKeyPickupEntity } from './items/keys.js';
import { createAmmoPickupEntity } from './items/ammo.js';
import { createPowerArmorPickupEntity } from './items/powerArmor.js';
import { AmmoItemId } from '../inventory/ammo.js';
import { Entity } from './entity.js';

export function registerItemSpawns(game: GameExports, registry: SpawnRegistry) {
    for (const weaponItem of Object.values(WEAPON_ITEMS)) {
        registry.register(weaponItem.id, (entity: Entity) => {
            Object.assign(entity, createWeaponPickupEntity(game, weaponItem));
        });
    }

    for (const healthItem of Object.values(HEALTH_ITEMS)) {
        registry.register(healthItem.id, (entity: Entity) => {
            Object.assign(entity, createHealthPickupEntity(game, healthItem));
        });
    }

    for (const armorItem of Object.values(ARMOR_ITEMS)) {
        registry.register(armorItem.id, (entity: Entity) => {
            Object.assign(entity, createArmorPickupEntity(game, armorItem));
        });
    }

    for (const powerupItem of Object.values(POWERUP_ITEMS)) {
        registry.register(powerupItem.id, (entity: Entity) => {
            Object.assign(entity, createPowerupPickupEntity(game, powerupItem));
        });
    }

    for (const item of Object.values(POWER_ARMOR_ITEMS)) {
        registry.register(item.id, (entity: Entity) => {
            Object.assign(entity, createPowerArmorPickupEntity(game, item));
        });
    }

    for (const keyItem of Object.values(KEY_ITEMS)) {
        registry.register(keyItem.id, (entity: Entity) => {
            Object.assign(entity, createKeyPickupEntity(game, keyItem));
        });
    }

    for (const ammoId of Object.values(AmmoItemId)) {
        registry.register(ammoId, (entity: Entity) => {
            Object.assign(entity, createAmmoPickupEntity(game, ammoId));
        });
    }
}
