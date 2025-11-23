// =================================================================
// Quake II - Ammo Pickup Entities
// =================================================================

import { Entity, Solid } from '../entity.js';
import { GameExports } from '../../index.js';
import { AmmoItemId, getAmmoItemDefinition, pickupAmmo } from '../../inventory/ammo.js';

export function createAmmoPickupEntity(game: GameExports, itemId: AmmoItemId): Partial<Entity> {
  const def = getAmmoItemDefinition(itemId);
  const respawn = (self: Entity) => {
    self.solid = Solid.Trigger;
  };

  return {
    classname: itemId,
    solid: Solid.Trigger,
    touch: (self, other) => {
      if (!other || !other.client) {
        return;
      }

      const result = pickupAmmo(other.client.inventory.ammo, itemId);
      if (result.pickedUp) {
        game.sound?.(other, 0, 'items/pkup.wav', 1, 1, 0);
        // TODO: Map ammo type to nice name
        game.centerprintf?.(other, `You got ${def.quantity} ${itemId.replace('ammo_', '')}`);
        self.solid = Solid.Not;
        self.nextthink = game.time + 30;
        game.entities.scheduleThink(self, self.nextthink);
      }
    },
    think: respawn,
  };
}
