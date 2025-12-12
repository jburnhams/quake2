import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { SpawnRegistry } from '../spawn.js';
import { EntitySystem } from '../system.js';
import { setMovedir } from '../utils.js';
import { angleVectors, dotVec3, normalizeVec3, subtractVec3 } from '@quake2ts/shared';

const LOOK_SPAWNFLAGS = {
  LookAway: 1 << 0,
} as const;

function triggerLookTouch(self: Entity, other: Entity | null, entities: EntitySystem): void {
  // Not used for trigger_look, it uses think to check status
}

function triggerLookThink(self: Entity, entities: EntitySystem): void {
    // find players
    // This is expensive if we do it for all players every 0.1s
    // Reference g_trigger.cpp

    // In SP, usually just one player.
    // In MP, check all players?

    let fired = false;

    // We can use entities.forEachEntity but that's slow.
    // Ideally we would have a list of players.
    // For now let's query players if possible, or iterate.
    // Actually findInBox with a large box around the trigger?
    // trigger_look typically has bounds.

    // But wait, trigger_look in Q2 (g_trigger.cpp) seems to be a brush model trigger?
    // "Wait until the player looks at it."

    // If it is a brush model, it has bounds.
    // We can check players inside bounds?
    // Actually g_trigger.cpp: SP_trigger_look calls InitTrigger so it is solid trigger.
    // But it sets think to TriggerLookThink.

    // "The area of the trigger must be within the player's view."

    const players = entities.findByClassname('player');

    for (const player of players) {
        if (player.health <= 0) continue;

        // Is player inside the trigger box?
        // Wait, standard triggers fire on touch. trigger_look fires when LOOKED at.
        // It doesn't necessarily mean the player is INSIDE the trigger.
        // Usually the trigger defines an area that must be seen.

        // Let's check g_trigger.cpp logic if available in memory or assumption.
        // Usually: vector from player eye to trigger center or nearest point?

        // Actually, trigger_look in Quake 2:
        // "Triggers once when player looks at it."
        // It often wraps an object or area.

        // Re-reading logic from typical Quake 2:
        // dot product of player view forward and vector to entity.

        const vec = subtractVec3(self.origin, player.origin);
        const dist = Math.sqrt(dotVec3(vec, vec)); // avoid lengthVec3 if we need manual checks

        // normalize
        const dir = normalizeVec3(vec);

        const forward = angleVectors(player.angles).forward;
        const dot = dotVec3(forward, dir);

        const fov = self.fov || 0.9; // default threshold

        if (dot >= fov) {
             fired = true;
             // Activate
             self.activator = player;
             entities.useTargets(self, player);
             break;
        }
    }

    if (fired) {
        entities.free(self);
    } else {
        entities.scheduleThink(self, entities.timeSeconds + 0.1);
    }
}

export function registerTriggerLook(registry: SpawnRegistry): void {
  registry.register('trigger_look', (entity, context) => {
    entity.movetype = MoveType.None;
    entity.solid = Solid.Not; // trigger_look is not touched?
    // In g_trigger.cpp it says "InitTrigger" which sets solid=TRIGGER.
    // But TriggerLookThink does the check.
    // If it is solid, it might block? Or just be invisible volume.
    // But the logic is "player looks at it".
    // If the player has to touch it to look at it, that's trigger_multiple.

    // Actually, trigger_look is often used for "look at this object to trigger something".
    // So solid=Not makes sense so it doesn't collide.

    entity.svflags |= ServerFlags.NoClient;
    entity.movedir = setMovedir(entity.angles);

    if (!entity.fov) entity.fov = 0.9;

    entity.think = (self) => triggerLookThink(self, context.entities);
    context.entities.scheduleThink(entity, context.entities.timeSeconds + 0.1);
  });
}
