
import { Entity } from '../entity.js';
import { GameExports } from '../../index.js';
import { Solid } from '../entity.js';

// Standard Quake 2 Effect Flag
const EF_GIB = 0x00000008;

export function createFoodCubePickupEntity(game: GameExports): Partial<Entity> {
    return {
        classname: 'item_foodcube',
        solid: Solid.Trigger,
        model: 'models/objects/trapfx/tris.md2',
        effects: EF_GIB,
        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            // Trigger pickup hook
            game.entities.scriptHooks.onPickup?.(other, 'item_foodcube');

            // "self->style = HEALTH_IGNORE_MAX;" implies ignoring max health cap.
            // We assume count is set by the spawner, default to 2 (Small Health).
            const amount = self.count || 2;

            other.health += amount;
            // No cap applied here.

            // Sound logic based on amount
            let sound = 'items/m_health.wav';
            if (amount < 10) sound = 'items/s_health.wav';
            else if (amount < 25) sound = 'items/n_health.wav';
            else if (amount < 50) sound = 'items/l_health.wav';

            game.sound?.(other, 0, sound, 1, 1, 0);

            // "You ate the Food Cube" - implicit feedback, though not in original print.
            // game.centerprintf?.(other, `You ate the Food Cube`);

            self.solid = Solid.Not;
            // Remove immediately
            game.entities.free(self);
        },
    };
}
