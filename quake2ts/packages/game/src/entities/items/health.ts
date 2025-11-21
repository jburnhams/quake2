// =================================================================
// Quake II - Health Pickup Entities
// =================================================================

import { Entity } from '../entity.js';
import { pickupHealth, HealthItem } from '../../inventory/index.js';
import { GameExports } from '../../index.js';

import { Solid } from '../entity.js';

export function createHealthPickupEntity(game: GameExports, healthItem: HealthItem): Partial<Entity> {
    const respawn = (self: Entity) => {
        self.solid = Solid.Trigger;
    };

    return {
        classname: healthItem.id,
        solid: Solid.Trigger,
        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            if (pickupHealth(other.client.inventory, other.health, healthItem)) {
                other.health += healthItem.amount;
                if (other.health > healthItem.max) {
                    other.health = healthItem.max;
                }
                game.sound?.(other, 0, 'items/pkup.wav', 1, 1, 0);
                game.centerprintf?.(other, `You got the ${healthItem.name}`);
                self.solid = Solid.Not;
                self.nextthink = game.time + 30;
                game.entities.scheduleThink(self, self.nextthink);
            }
        },
        think: respawn,
    };
}
