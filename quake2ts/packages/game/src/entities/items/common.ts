import { Entity, Solid, ServerFlags } from '../entity.js';
import { GameExports, MulticastType } from '../../index.js';
import { ServerCommand, TempEntity } from '@quake2ts/shared';

// Helper to handle what happens when an item is picked up
export function handleItemPickup(game: GameExports, self: Entity, other: Entity, respawnTime: number = 30) {
    if (!game.deathmatch) {
        // In SP, item is removed
        game.entities.free(self);
        return;
    }

    // In DM, item respawns
    // Hide model
    self.solid = Solid.Not;
    // We need to preserve the modelindex to restore it.
    // We can assume the entity properties (self.model) are enough to look it up again,
    // or we store it. Since self.modelindex is overwritten, we rely on the respawn closure
    // capturing the original index OR re-resolving it.
    // However, simpler is to just hide it via effects or svflags if the engine supports it.
    // Setting modelindex = 0 hides it effectively.
    // We'll store the original index in a temp property if needed, but since we use a factory
    // pattern where 'respawn' is defined in the closure of creation, we can capture it there.
    // But here we are in a helper.
    // Let's assume the entity has 'model' property set correctly.

    self.modelindex = 0;
    self.svflags |= ServerFlags.NoClient;

    self.nextthink = game.time + respawnTime;
    game.entities.scheduleThink(self, self.nextthink);
}

// Helper to create the respawn callback
export function createItemRespawnFunction(game: GameExports, originalModel: string) {
    // Resolve index once or lazy?
    // Better to resolve inside function in case it changed (unlikely).
    // Or capture it.
    let cachedIndex = 0;

    return (self: Entity) => {
        if (!cachedIndex) {
            cachedIndex = game.entities.modelIndex(originalModel);
        }

        self.solid = Solid.Trigger;
        self.modelindex = cachedIndex;
        self.svflags &= ~ServerFlags.NoClient;

        // Play respawn effect/sound
        // Q2 uses EV_ITEM_RESPAWN. We use TELEPORT_EFFECT as a visual approximation + Sound.
        // Also play the sound "items/respawn.wav"

        game.multicast(self.origin, MulticastType.Pvs, ServerCommand.sound, 0, "items/respawn.wav", 1, 0, 0);
        game.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.TELEPORT_EFFECT, self.origin);
    };
}
