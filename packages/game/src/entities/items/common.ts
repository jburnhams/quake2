import { Entity, Solid, ServerFlags } from '../entity.js';
import { GameExports, MulticastType } from '../../index.js';
import { ServerCommand, TempEntity } from '@quake2ts/shared';
import { doRespawn } from './spawnItem.js';

// Helper to handle what happens when an item is picked up
export function handleItemPickup(game: GameExports, self: Entity, other: Entity, respawnTime: number = 30) {
    // Trigger script hook
    game.hooks?.onPickup(other, self);

    if (!game.deathmatch) {
        // In SP, item is removed
        game.entities.free(self);
        return;
    }

    // SetRespawn: hidden and not touchable until DoRespawn brings it back. The model stays, as
    // NoClient already hides it, and the think is DoRespawn: spawnItem's own think (droptofloor)
    // would leave the item hidden.
    self.svflags |= ServerFlags.NoClient;
    self.solid = Solid.Not;
    self.nextthink = game.time + respawnTime;
    self.think = (e) => doRespawn(e, game.entities);
    game.entities.linkentity(self);
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
