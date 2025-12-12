// =================================================================
// Quake II - Armor Pickup Entities
// =================================================================

import { Entity } from '../entity.js';
import { pickupArmor, ArmorItem } from '../../inventory/index.js';
import { GameExports } from '../../index.js';
import { handleItemPickup, createItemRespawnFunction } from './common.js';

import { Solid } from '../entity.js';

export function createArmorPickupEntity(game: GameExports, armorItem: ArmorItem): Partial<Entity> {
    const modelName = `models/items/armor/${armorItem.id.replace('item_armor_', '')}/tris.md2`;

    return {
        classname: armorItem.id,
        solid: Solid.Trigger,
        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            if (pickupArmor(other.client.inventory, armorItem, game.time * 1000)) {
                game.sound?.(other, 0, 'items/pkup.wav', 1, 1, 0);
                game.centerprintf?.(other, `You got the ${armorItem.name}`);

                handleItemPickup(game, self, other);
            }
        },
        think: createItemRespawnFunction(game, modelName)
    };
}
