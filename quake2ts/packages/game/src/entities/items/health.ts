// =================================================================
// Quake II - Health Pickup Entities
// =================================================================

import { Entity } from '../entity.js';
import { canPickupHealth, HealthItem } from '../../inventory/index.js';
import { GameExports } from '../../index.js';
import { handleItemPickup, createItemRespawnFunction } from './common.js';

import { Solid } from '../entity.js';

export function createHealthPickupEntity(game: GameExports, healthItem: HealthItem): Partial<Entity> {
    const modelName = `models/items/healing/${healthItem.id.replace('item_health_', '')}/tris.md2`; // Approximate, specific mapping might be needed

    return {
        classname: healthItem.id,
        solid: Solid.Trigger,
        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            if (canPickupHealth(other.client.inventory, other.health, healthItem)) {
                other.health += healthItem.amount;
                if (other.health > healthItem.max) {
                    other.health = healthItem.max;
                }
                game.sound?.(other, 0, 'items/pkup.wav', 1, 1, 0);
                game.centerprintf?.(other, `You got the ${healthItem.name}`);

                handleItemPickup(game, self, other);
            }
        },
        think: createItemRespawnFunction(game, modelName)
    };
}
