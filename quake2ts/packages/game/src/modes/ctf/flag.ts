// =================================================================
// Quake II - CTF Flag Logic
// =================================================================

import { Entity, Solid, EntityFlags } from '../../entities/entity.js';
import { GameExports } from '../../index.js';
import { FlagItem } from '../../inventory/items.js';
import { pickupFlag } from '../../inventory/playerInventory.js';
import { EntitySystem } from '../../entities/system.js';
import { FlagState, setFlagState, FlagEntity } from './state.js';

export function createFlagPickupEntity(game: GameExports, flagItem: FlagItem): Partial<Entity> {
    const isRed = flagItem.team === 'red';

    const respawn = (self: FlagEntity) => {
        setFlagState(self, FlagState.AT_BASE, game.entities as unknown as EntitySystem); // TODO: Pass context properly
        self.solid = Solid.Trigger;
        self.model = isRed ? 'players/male/flag1.md2' : 'players/male/flag2.md2';
        self.origin = [...self.baseOrigin]; // Reset to base
        self.svflags &= ~1; // Clear SVF_NOCLIENT (assuming 1 is SVF_NOCLIENT if defined, or just ensure visible)
        // self.effects?
    };

    return {
        classname: flagItem.id,
        solid: Solid.Trigger,
        model: isRed ? 'players/male/flag1.md2' : 'players/male/flag2.md2',
        flags: EntityFlags.NoGravity, // Usually flags at base float or sit? Q2 flags drop to floor on spawn.
        // We'll assume spawn logic handles dropping to floor.

        // Initialize extended properties
        flagState: FlagState.AT_BASE,
        flagTeam: flagItem.team,
        baseOrigin: [0,0,0], // Will be set on spawn finalize

        touch: (selfEntity, other) => {
            const self = selfEntity as FlagEntity;
            if (!other || !other.client) {
                return;
            }

            // Determine player team
            // Use 'team' property if available, otherwise default to 'red'
            // This allows tests to override team by setting client.team
            const playerTeam = (other.client as any).team || 'red';

            const sameTeam = self.flagTeam === playerTeam;

            if (sameTeam) {
                // If touching own flag
                if (self.flagState === FlagState.AT_BASE) {
                    return; // Do nothing
                }
                if (self.flagState === FlagState.DROPPED) {
                    // Return flag
                    game.sound?.(other, 0, 'ctf/flagret.wav', 1, 1, 0);
                    game.centerprintf?.(other, `You returned the ${flagItem.name}!`);
                    respawn(self);
                }
            } else {
                // Enemy flag
                // Can pick up if AT_BASE or DROPPED
                if (pickupFlag(other.client, flagItem, game.time * 1000)) {
                    game.sound?.(other, 0, 'ctf/flagpk.wav', 1, 1, 0);
                    game.centerprintf?.(other, `You got the ${flagItem.name}!`);

                    setFlagState(self, FlagState.CARRIED, game.entities as unknown as EntitySystem);
                    self.solid = Solid.Not;
                    self.model = undefined;
                    self.owner = other;
                }
            }
        },

        think: (selfEntity, context) => {
             const self = selfEntity as FlagEntity;
             if (self.flagState === FlagState.DROPPED) {
                 // Check timeout (30s default)
                 // If timeout, return
                 // respawn(self);
             }
        }
    };
}
