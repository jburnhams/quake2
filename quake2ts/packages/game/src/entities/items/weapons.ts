// =================================================================
// Quake II - Weapon Pickup Entities
// =================================================================

import { Entity } from '../entity.js';
import { pickupWeapon, WeaponItem } from '../../inventory/index.js';
import { GameExports } from '../../index.js';
import { handleItemPickup, createItemRespawnFunction } from './common.js';

import { Solid } from '../entity.js';

export function createWeaponPickupEntity(game: GameExports, weaponItem: WeaponItem): Partial<Entity> {
    const modelName = `models/items/${weaponItem.id.replace('weapon_', '')}/tris.md2`;

    return {
        classname: weaponItem.id,
        solid: Solid.Trigger,
        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            if (pickupWeapon(other.client.inventory, weaponItem, game.time * 1000)) {
                game.sound?.(other, 0, 'items/pkup.wav', 1, 1, 0);
                game.centerprintf?.(other, `You got the ${weaponItem.name}`);

                handleItemPickup(game, self, other);
            }
        },
        think: createItemRespawnFunction(game, modelName)
    };
}
