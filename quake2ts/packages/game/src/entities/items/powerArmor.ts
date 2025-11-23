// =================================================================
// Quake II - Power Armor Pickups
// =================================================================

import { Entity } from '../entity.js';
import { pickupPowerArmor, PowerArmorItem } from '../../inventory/index.js';
import { GameExports } from '../../index.js';
import { Solid } from '../entity.js';

export function createPowerArmorPickupEntity(game: GameExports, item: PowerArmorItem): Partial<Entity> {
    const respawn = (self: Entity) => {
        self.solid = Solid.Trigger;
    };

    return {
        classname: item.id,
        solid: Solid.Trigger,
        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            if (pickupPowerArmor(other.client.inventory, item, game.time * 1000)) {
                game.sound?.(other, 0, 'items/ar2_pkup.wav', 1, 1, 0); // Reuse armor pickup sound? Or check specific.
                game.centerprintf?.(other, `You got the ${item.name}`);
                self.solid = Solid.Not;
                if (game.deathmatch) {
                    self.nextthink = game.time + 30;
                    game.entities.scheduleThink(self, self.nextthink);
                }
            }
        },
        think: respawn,
    };
}
