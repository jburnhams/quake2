// =================================================================
// Quake II - Powerup Pickup Entities
// =================================================================

import { Entity } from '../entity.js';
import { pickupPowerup, PowerupItem } from '../../inventory/index.js';
import { GameExports } from '../../index.js';
import { handleItemPickup, createItemRespawnFunction } from './common.js';

import { Solid } from '../entity.js';

export function createPowerupPickupEntity(game: GameExports, powerupItem: PowerupItem): Partial<Entity> {
    const respawnTime = powerupItem.id === 'item_quad' || powerupItem.id === 'item_invulnerability' ? 60 : 30;
    const modelName = `models/items/powerups/${powerupItem.id.replace('item_', '')}/tris.md2`;

    return {
        classname: powerupItem.id,
        solid: Solid.Trigger,
        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            if (pickupPowerup(other.client, powerupItem, game.time * 1000)) {
                // Trigger pickup hook
                game.entities.scriptHooks.onPickup?.(other, powerupItem.id);

                game.sound?.(other, 0, 'items/pkup.wav', 1, 1, 0);
                game.centerprintf?.(other, `You got the ${powerupItem.name}`);

                handleItemPickup(game, self, other, respawnTime);
            }
        },
        think: createItemRespawnFunction(game, modelName)
    };
}
