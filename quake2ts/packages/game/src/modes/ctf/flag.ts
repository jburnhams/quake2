// =================================================================
// Quake II - CTF Flag Logic
// =================================================================

import { Entity, Solid, MoveType } from '../../entities/entity.js';
import { GameExports } from '../../index.js';
import { FlagItem } from '../../inventory/items.js';
import { pickupFlag } from '../../inventory/playerInventory.js';
import { EntitySystem } from '../../entities/system.js';
import { FlagState, setFlagState, FlagEntity } from './state.js';
import { Vec3 } from '@quake2ts/shared';

export function createFlagPickupEntity(game: GameExports, flagItem: FlagItem): Partial<Entity> {
    const isRed = flagItem.team === 'red';

    const respawn = (self: FlagEntity) => {
        setFlagState(self, FlagState.AT_BASE, game.entities as unknown as EntitySystem);
        self.solid = Solid.Trigger;
        self.model = isRed ? 'players/male/flag1.md2' : 'players/male/flag2.md2';
        self.origin = { ...self.baseOrigin }; // Reset to base
        self.svflags &= ~1;
    };

    return {
        classname: flagItem.id,
        solid: Solid.Trigger,
        model: isRed ? 'players/male/flag1.md2' : 'players/male/flag2.md2',
        movetype: MoveType.None, // Base flag is stationary

        // Initialize extended properties
        // We cast this object to Partial<Entity> which includes FlagEntity props if we extend definition
        // or we just assign them dynamically.
        // For type safety, we might need to cast to any here or define these props on Entity.
        // Since we can't easily modify Entity definition right now without a big refactor,
        // we assume runtime extensions are allowed or these are custom fields.
        flagState: FlagState.AT_BASE,
        flagTeam: flagItem.team,
        baseOrigin: { x: 0, y: 0, z: 0 },

        touch: (selfEntity, other) => {
            const self = selfEntity as FlagEntity;
            if (!other || !other.client) {
                return;
            }

            // Determine player team
            const playerTeam = (other.client as any).team || 'red';

            const sameTeam = self.flagTeam === playerTeam;

            if (sameTeam) {
                // If touching own flag
                if (self.flagState === FlagState.AT_BASE) {
                    return; // Do nothing
                }
                if (self.flagState === FlagState.DROPPED) {
                    // Return flag
                    // Hook for returning flag? Maybe distinct from pickup.
                    // game.entities.scriptHooks.onFlagReturn?.(other, self.flagTeam);

                    game.sound?.(other, 0, 'ctf/flagret.wav', 1, 1, 0);
                    game.centerprintf?.(other, `You returned the ${flagItem.name}!`);
                    respawn(self);
                }
            } else {
                // Enemy flag
                // Can pick up if AT_BASE or DROPPED
                if (pickupFlag(other.client, flagItem, game.time * 1000)) {
                    // Trigger pickup hook
                    game.entities.scriptHooks.onPickup?.(other, flagItem.id);

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
                 // Check timeout (30s default) is handled by nextthink in drop.ts
             }
        }
    } as Partial<Entity>;
}
