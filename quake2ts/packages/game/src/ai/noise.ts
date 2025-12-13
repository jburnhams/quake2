import { Entity, MoveType, Solid, EntityFlags, ServerFlags } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';

export const PNOISE_SELF = 0;
export const PNOISE_WEAPON = 1;
export const PNOISE_IMPACT = 2;

/*
=================
player_noise

Each player has one of these attached to them.
It is the point that monsters look at when they hear the player.
=================
*/
export function player_noise(ent: Entity, context: EntitySystem) {
    ent.classname = 'player_noise';
    ent.movetype = MoveType.None;
    ent.solid = Solid.Not;
    ent.svflags |= ServerFlags.NoClient;
    ent.mins = { x: -8, y: -8, z: -8 };
    ent.maxs = { x: 8, y: 8, z: 8 };
    ent.owner = null; // Will be set when spawned
}

/*
=================
PlayerNoise

Updates the player_noise entity for the given player.
Reference: rerelease/p_weapon.cpp PlayerNoise
=================
*/
export function PlayerNoise(who: Entity, where: { x: number; y: number; z: number }, type: number, context: EntitySystem): void {
    if (!who || !who.client) {
        return;
    }

    if (who.flags & EntityFlags.NoTarget) {
        return;
    }

    if (!who.client.player_noise_entity) {
        // Create it if it doesn't exist
        const noise = context.spawn();
        player_noise(noise, context);
        noise.owner = who;
        who.client.player_noise_entity = noise;
    }

    const noise = who.client.player_noise_entity;
    noise.origin = { ...where };
    context.linkentity(noise);

    // Update awareness
    const awareness = context.targetAwareness;
    if (!awareness) return;

    if (type === PNOISE_WEAPON) {
        if (awareness.soundEntity === noise) {
            awareness.soundEntityFrame = awareness.frameNumber;
        } else {
            awareness.sound2Entity = awareness.soundEntity;
            awareness.sound2EntityFrame = awareness.soundEntityFrame;
            awareness.soundEntity = noise;
            awareness.soundEntityFrame = awareness.frameNumber;
        }
    } else if (type === PNOISE_SELF) {
        if (awareness.sightEntity === noise) {
            awareness.sightEntityFrame = awareness.frameNumber;
        } else {
            awareness.sightClient = noise;
        }
    }
}
