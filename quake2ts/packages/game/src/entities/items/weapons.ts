// =================================================================
// Quake II - Weapon Pickup Entities
// =================================================================

import { Entity } from '../entity.js';
import { pickupWeapon, WeaponItem } from '../../inventory/index.js';
import { GameExports } from '../../index.js';

import { Solid } from '../entity.js';

export function createWeaponPickupEntity(game: GameExports, weaponItem: WeaponItem): Partial<Entity> {
    const respawn = (self: Entity) => {
        self.solid = Solid.Trigger;
    };

    return {
        classname: weaponItem.id,
        solid: Solid.Trigger,
        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            if (pickupWeapon(other.client.inventory, weaponItem)) {
                game.sound?.(other, 0, 'items/pkup.wav', 1, 1, 0);
                game.centerprintf?.(other, `You got the ${weaponItem.name}`);
                self.solid = Solid.Not;
                self.nextthink = game.time + 30;
                game.entities.scheduleThink(self, self.nextthink);
            }
        },
        think: respawn,
    };
}
