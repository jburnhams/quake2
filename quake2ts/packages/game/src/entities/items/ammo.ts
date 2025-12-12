// =================================================================
// Quake II - Ammo Pickup Entities
// =================================================================

import { Entity, Solid } from '../entity.js';
import { GameExports } from '../../index.js';
import { AmmoItemId, getAmmoItemDefinition, pickupAmmo } from '../../inventory/ammo.js';
import { handleItemPickup, createItemRespawnFunction } from './common.js';

const AMMO_DISPLAY_NAMES: Record<AmmoItemId, string> = {
  [AmmoItemId.Shells]: 'Shells',
  [AmmoItemId.Bullets]: 'Bullets',
  [AmmoItemId.Rockets]: 'Rockets',
  [AmmoItemId.Grenades]: 'Grenades',
  [AmmoItemId.Cells]: 'Cells',
  [AmmoItemId.Slugs]: 'Slugs',
  [AmmoItemId.MagSlugs]: 'Magnum Slugs',
  [AmmoItemId.Flechettes]: 'Flechettes',
  [AmmoItemId.Disruptor]: 'Disruptor Rounds',
  [AmmoItemId.Tesla]: 'Tesla Cells',
  [AmmoItemId.Trap]: 'Traps',
  [AmmoItemId.Prox]: 'Prox Mines'
};

export function createAmmoPickupEntity(game: GameExports, itemId: AmmoItemId): Partial<Entity> {
  const def = getAmmoItemDefinition(itemId);
  const modelName = `models/items/ammo/${itemId.replace('ammo_', '')}/tris.md2`; // Approximate

  return {
    classname: itemId,
    solid: Solid.Trigger,
    touch: (self, other) => {
      if (!other || !other.client) {
        return;
      }

      const result = pickupAmmo(other.client.inventory.ammo, itemId);
      if (result.pickedUp) {
        // Trigger pickup hook
        game.entities.scriptHooks.onPickup?.(other, itemId);

        game.sound?.(other, 0, 'items/pkup.wav', 1, 1, 0);

        const name = AMMO_DISPLAY_NAMES[itemId] || itemId.replace('ammo_', '');
        game.centerprintf?.(other, `You got ${def.quantity} ${name}`);

        handleItemPickup(game, self, other);
      }
    },
    think: createItemRespawnFunction(game, modelName),
  };
}
