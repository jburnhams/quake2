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
    FLAG_ITEMS
} from '../inventory/items.js';
import { createWeaponPickupEntity } from './items/weapons.js';
export { createWeaponPickupEntity } from './items/weapons.js';
import { createHealthPickupEntity } from './items/health.js';
import { createArmorPickupEntity } from './items/armor.js';
import { createPowerupPickupEntity } from './items/powerups.js';
import { createKeyPickupEntity } from './items/keys.js';
import { createAmmoPickupEntity } from './items/ammo.js';
import { createPowerArmorPickupEntity } from './items/powerArmor.js';
import { createFoodCubePickupEntity } from './items/foodcube.js';
import { createFlagPickupEntity } from '../modes/ctf/flag.js';
import { AmmoItemId } from '../inventory/ammo.js';
import { Entity } from './entity.js';
import { ITEMLIST, type ItemDef } from '../items/itemlist.js';
import { spawnItem, findItemByClassname, ITEM_CLASSNAME_ALIASES } from './items/spawnItem.js';

/** The port's pickup for an item: the touch its own pickup entity has, if it has one. */
function legacyPickups(game: GameExports): Map<string, () => Partial<Entity>> {
    const pickups = new Map<string, () => Partial<Entity>>();
    pickups.set('item_foodcube', () => createFoodCubePickupEntity(game));
    for (const item of Object.values(WEAPON_ITEMS)) pickups.set(item.id, () => createWeaponPickupEntity(game, item));
    for (const item of Object.values(HEALTH_ITEMS)) pickups.set(item.id, () => createHealthPickupEntity(game, item));
    for (const item of Object.values(ARMOR_ITEMS)) pickups.set(item.id, () => createArmorPickupEntity(game, item));
    for (const item of Object.values(POWERUP_ITEMS)) pickups.set(item.id, () => createPowerupPickupEntity(game, item));
    for (const item of Object.values(POWER_ARMOR_ITEMS)) pickups.set(item.id, () => createPowerArmorPickupEntity(game, item));
    // The port named the keys key_blue..key_yellow; the game's classnames are key_blue_key and so on.
    for (const item of Object.values(KEY_ITEMS)) pickups.set(`${item.id}_key`, () => createKeyPickupEntity(game, item));
    for (const ammoId of Object.values(AmmoItemId)) pickups.set(ammoId, () => createAmmoPickupEntity(game, ammoId));
    for (const item of Object.values(FLAG_ITEMS)) pickups.set(item.id, () => createFlagPickupEntity(game, item));
    return pickups;
}

/**
 * ED_CallSpawn's item half: every classname in itemlist (and its three old aliases) spawns
 * through SpawnItem. What a touch does is the port's pickup where it has one.
 */
export function registerItemSpawns(game: GameExports, registry: SpawnRegistry) {
    const pickups = legacyPickups(game);
    const register = (classname: string, def: ItemDef) => {
        registry.register(classname, (entity: Entity, context) => {
            const touch = pickups.get(def.classname ?? '')?.().touch;
            spawnItem(entity, def, context.entities, touch);
        });
    };
    for (const def of ITEMLIST) if (def?.classname) register(def.classname, def);
    for (const [alias, classname] of Object.entries(ITEM_CLASSNAME_ALIASES)) register(alias, findItemByClassname(classname)!);
}
