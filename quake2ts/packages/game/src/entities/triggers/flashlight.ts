import { Entity, EntityFlags, ServerFlags, Solid } from '../entity.js';
import { EntitySystem } from '../system.js';
import { RenderFx } from '@quake2ts/shared';
import { SpawnRegistry } from '../spawn.js';

export const registerTriggerFlashlight = (registry: SpawnRegistry) => {
  registry.register('trigger_flashlight', (self: Entity, context) => {
    // "style" default to 0, set to 1 to always turn flashlight on, 2 to always turn off
    self.solid = Solid.Trigger;
    self.movetype = 0; // MOVETYPE_NONE
    self.svflags |= ServerFlags.NoClient;

    self.touch = (self: Entity, other: Entity | null, plane?: any, surf?: any) => {
        if (!other || !other.client) return;

        const style = self.style || 0;
        let sound = '';

        if (style === 0) {
            if ((other.flags & EntityFlags.Flashlight)) {
                other.flags &= ~EntityFlags.Flashlight;
                sound = 'items/flashlight_off.wav';
            } else {
                other.flags |= EntityFlags.Flashlight;
                sound = 'items/flashlight_on.wav';
            }
        } else if (style === 1) {
            if (!(other.flags & EntityFlags.Flashlight)) {
                 other.flags |= EntityFlags.Flashlight;
                 sound = 'items/flashlight_on.wav';
            }
        } else if (style === 2) {
            if (other.flags & EntityFlags.Flashlight) {
                other.flags &= ~EntityFlags.Flashlight;
                sound = 'items/flashlight_off.wav';
            }
        }

        // Update renderfx for client visual
        if (other.flags & EntityFlags.Flashlight) {
            other.renderfx |= RenderFx.Flashlight;
        } else {
            other.renderfx &= ~RenderFx.Flashlight;
        }

        if (sound) {
            // gi.sound(ent, CHAN_AUTO, gi.soundindex(...), 1.f, ATTN_STATIC, 0);
            context.entities.sound(other, 0, sound, 1, 3, 0); // 3 = ATTN_STATIC
        }
    };

    context.entities.linkentity(self);
  });
};
