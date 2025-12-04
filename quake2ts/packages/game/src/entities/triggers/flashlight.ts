import { Entity, MoveType, Solid, EntityFlags, ServerFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { lengthVec3, normalizeVec3 } from '@quake2ts/shared';
import { setMovedir } from '../utils.js';

const SPAWNFLAG_FLASHLIGHT_CLIPPED = 1;

function P_ToggleFlashlight(player: Entity, on: boolean, context: EntitySystem) {
    if (on) {
        player.flags |= EntityFlags.Flashlight;
        // In Rerelease this also sets EF_FLASHLIGHT on s.effects
        // For now we just set the flag and play sound
        context.sound(player, 0, 'items/flashlight_on.wav', 1, 3, 0); // CHAN_AUTO, ATTN_STATIC
    } else {
        player.flags &= ~EntityFlags.Flashlight;
        // Clear EF_FLASHLIGHT
        context.sound(player, 0, 'items/flashlight_off.wav', 1, 3, 0);
    }
}

function trigger_flashlight_touch(self: Entity, other: Entity | null, context: EntitySystem) {
    if (!other || !other.client) return;

    if (self.spawnflags & SPAWNFLAG_FLASHLIGHT_CLIPPED) {
        // Clipping check omitted for MVP (requires complex trace)
    }

    if (self.style === 1) {
        P_ToggleFlashlight(other, true, context);
    } else if (self.style === 2) {
        P_ToggleFlashlight(other, false, context);
    } else {
        const lenSq = lengthVec3(other.velocity); // Actually we need squared length or check length > 32
        // lengthVec3 returns length. 32*32 = 1024.
        if (lenSq * lenSq > 1024) { // Oops, lengthVec3 returns magnitude.
             if (lenSq > 32) {
                 const forward = normalizeVec3(other.velocity);
                 const dot = forward.x * self.movedir.x + forward.y * self.movedir.y + forward.z * self.movedir.z;
                 P_ToggleFlashlight(other, dot > 0, context);
             }
        }
    }
}

export function registerTriggerFlashlight(registry: any) {
    registry.register('trigger_flashlight', (entity: Entity, context: any) => {
        if (entity.angles.y === 0) {
            entity.angles = { ...entity.angles, y: 360 };
        }

        // InitTrigger logic
        entity.solid = Solid.Trigger;
        entity.movetype = MoveType.None;
        entity.svflags |= ServerFlags.NoClient;

        entity.movedir = setMovedir(entity.angles);
        entity.angles = { x: 0, y: 0, z: 0 };

        entity.movedir = { ...entity.movedir, z: entity.height || 0 }; // st.height

        if (entity.spawnflags & SPAWNFLAG_FLASHLIGHT_CLIPPED) {
            entity.svflags |= 2048; // SVF_HULL ?
        }

        context.entities.linkentity(entity);

        entity.touch = (self, other) => trigger_flashlight_touch(self, other, context.entities);
    });
}
