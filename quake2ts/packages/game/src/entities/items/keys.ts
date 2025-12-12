// =================================================================
// Quake II - Key Pickup Entities
// =================================================================

import { Entity } from '../entity.js';
import { pickupKey, KeyItem } from '../../inventory/index.js';
import { GameExports } from '../../index.js';

import { Solid } from '../entity.js';

export function createKeyPickupEntity(game: GameExports, keyItem: KeyItem): Partial<Entity> {
    const respawn = (self: Entity) => {
        self.solid = Solid.Trigger;
    };

    return {
        classname: keyItem.id,
        solid: Solid.Trigger,
        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            if (pickupKey(other.client.inventory, keyItem, game.time * 1000)) {
                // Trigger pickup hook
                game.entities.scriptHooks.onPickup?.(other, keyItem.id);

                game.sound?.(other, 0, 'items/pkup.wav', 1, 1, 0);
                game.centerprintf?.(other, `You got the ${keyItem.name}`);
                self.solid = Solid.Not;
                self.nextthink = game.time + 30;
                game.entities.scheduleThink(self, self.nextthink);
            }
        },
        think: respawn,
    };
}
