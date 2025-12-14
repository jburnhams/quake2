import {
  WEAPON_ITEMS,
  HEALTH_ITEMS,
  ARMOR_ITEMS,
  POWERUP_ITEMS,
  POWER_ARMOR_ITEMS,
  KEY_ITEMS,
  FLAG_ITEMS
} from './items.js';
import { getAmmoItemDefinition, AmmoItemId } from './ammo.js';

import {
  pickupWeapon,
  canPickupHealth,
  pickupArmor,
  pickupPowerup,
  pickupPowerArmor,
  pickupKey,
  pickupFlag,
  giveAmmoItem
} from './playerInventory.js';
import { PlayerClient } from './playerInventory.js';
import { Entity } from '../entities/entity.js';

export function giveItem(entity: Entity, classname: string): boolean {
  if (!entity.client) return false;
  const client = entity.client;
  const inventory = client.inventory;
  const time = 0; // Immediate effect, no time delay for pickup animations usually

  // Weapon?
  const weapon = WEAPON_ITEMS[classname];
  if (weapon) {
    return pickupWeapon(inventory, weapon, time);
  }

  // Ammo?
  // Check if classname is an AmmoItemId
  const isAmmo = Object.values(AmmoItemId).includes(classname as AmmoItemId);
  if (isAmmo) {
      const res = giveAmmoItem(inventory, classname as AmmoItemId);
      return res.pickedUp;
  }

  // Health?
  const healthItem = HEALTH_ITEMS[classname];
  if (healthItem) {
      if (canPickupHealth(inventory, entity.health, healthItem)) {
           // Apply health immediately
           // Note: pickupHealth logic in Q2 is usually in the item touch function
           // which calls heal() on the entity.
           // Since we don't have a centralized pickupHealth in inventory logic (it returns bool),
           // we replicate the effect here.
           const count = healthItem.amount;
           const max = healthItem.max;
           if (entity.health < max) {
               entity.health += count;
               if (entity.health > max) entity.health = max;
               return true;
           }
           // Overheal logic?
           // Megahealth goes over max.
           if (classname === 'item_health_mega') {
                if (entity.health < max) {
                    entity.health += count;
                    return true;
                }
                return false;
           }
      }
      return false;
  }

  // Armor?
  const armorItem = ARMOR_ITEMS[classname];
  if (armorItem) {
      return pickupArmor(inventory, armorItem, time);
  }

  // Powerup?
  const powerupItem = POWERUP_ITEMS[classname];
  if (powerupItem) {
      return pickupPowerup(client, powerupItem, time);
  }

  // Power Armor?
  const powerArmorItem = POWER_ARMOR_ITEMS[classname];
  if (powerArmorItem) {
      return pickupPowerArmor(inventory, powerArmorItem, time);
  }

  // Key?
  const keyItem = KEY_ITEMS[classname];
  if (keyItem) {
      return pickupKey(inventory, keyItem, time);
  }

  // Flag?
  const flagItem = FLAG_ITEMS[classname];
  if (flagItem) {
      return pickupFlag(client, flagItem, time);
  }

  return false;
}
