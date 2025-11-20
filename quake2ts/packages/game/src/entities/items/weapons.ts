// =================================================================
// Quake II - Weapon Pickup Entities
// =================================================================

import { Entity } from '../entity.js';
import { pickupWeapon, WeaponItem } from '../../inventory/index.js';
import { GameExports } from '../../index.js';

export function createWeaponPickupEntity(game: GameExports, weaponItem: WeaponItem): Partial<Entity> {
    return {
        classname: weaponItem.id,
        touch: (self, other) => {
            if (!other.client) {
                return;
            }

            if (pickupWeapon(other.client.inventory, weaponItem)) {
                game.sound(other, 0, 'items/pkup.wav', 1, 1, 0);
                // TODO: Show pickup message on HUD
                game.addUFFlags(self, -1);
            }
        },
    };
}
