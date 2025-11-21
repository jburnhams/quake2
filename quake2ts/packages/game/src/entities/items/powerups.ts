// =================================================================
// Quake II - Powerup Pickup Entities
// =================================================================

import { Entity } from '../entity.js';
import { pickupPowerup, PowerupItem } from '../../inventory/index.js';
import { GameExports } from '../../index.js';

import { Solid } from '../entity.js';

export function createPowerupPickupEntity(game: GameExports, powerupItem: PowerupItem): Partial<Entity> {
    const respawn = (self: Entity) => {
        self.solid = Solid.Trigger;
    };

    return {
        classname: powerupItem.id,
        solid: Solid.Trigger,
        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            if (pickupPowerup(other.client.inventory, powerupItem, game.time)) {
                game.sound?.(other, 0, 'items/pkup.wav', 1, 1, 0);
                game.centerprintf?.(other, `You got the ${powerupItem.name}`);
                self.solid = Solid.Not;
                self.nextthink = game.time + 30;
                game.entities.scheduleThink(self, self.nextthink);
            }
        },
        think: respawn,
    };
}
