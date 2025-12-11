// =================================================================
// Quake II - CTF Flag Logic
// =================================================================

import { Entity, Solid } from '../../entities/entity.js';
import { GameExports } from '../../index.js';
import { FlagItem } from '../../inventory/items.js';
import { pickupFlag } from '../../inventory/playerInventory.js';
import { EntitySystem } from '../../entities/system.js';

export function createFlagPickupEntity(game: GameExports, flagItem: FlagItem): Partial<Entity> {
    const drop = (self: Entity, context: EntitySystem) => {
        // TODO: Implement drop behavior
        // If dropped, count down to return
    };

    const respawn = (self: Entity) => {
        self.solid = Solid.Trigger;
        // Reset model, etc.
    };

    return {
        classname: flagItem.id,
        solid: Solid.Trigger,
        model: flagItem.team === 'red' ? 'players/male/flag1.md2' : 'players/male/flag2.md2',
        // Note: Models might need adjustment based on how Q2 handles skins for flags
        // Original: "players/male/flag1.md2" (red) "players/male/flag2.md2" (blue)
        // Usually it's just one model with skin change, but Q2 uses separate models for dropped flags often?
        // Checking g_ctf.c: SP_item_flag_team1 sets ent->s.modelindex = gi.modelindex ("players/male/flag1.md2");

        touch: (self, other) => {
            if (!other || !other.client) {
                return;
            }

            if (pickupFlag(other.client, flagItem, game.time * 1000)) {
                // Sound: CTF specific?
                // g_ctf.c: CTFPickup_Flag calls CTFTeam_GetFlagMsg which prints messages and plays sounds.
                // For now, basic pickup sound.
                game.sound?.(other, 0, 'ctf/flagpk.wav', 1, 1, 0);
                // Note: sound might need to be precached or verified.

                game.centerprintf?.(other, `You got the ${flagItem.name}`);

                // Flags don't disappear like normal items, they attach to player?
                // Or if at base, they disappear.
                // In Q2 CTF, the flag entity on the ground disappears (solid=NOT, modelindex=0)
                // and the player gets a flag icon and effects.

                self.solid = Solid.Not;
                self.model = undefined; // Hide it

                // In CTF, the flag entity stays alive to track state (DROPPED, CARRIED, AT_BASE).
                // If picked up from base, it goes to CARRIED.
                // If picked up from dropped, it goes to CARRIED.

                // For MVP, just hide it. State management comes in next task.
            }
        },
        think: (self, context) => {
            // Flag think logic (return timer, etc.)
            // For now, nothing.
        }
    };
}
