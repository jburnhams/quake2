import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';

function badAreaTouch(self: Entity, other: Entity | null) {
    if (!other) return;
    if (other.takedamage) {
        // Mark as invalid/dangerous spot for AI
        // In full game this might push AI away or just be used for navigation cost
    }
}

export function registerBadArea(registry: SpawnRegistry): void {
    registry.register('bad_area', (entity, context) => {
        entity.movetype = MoveType.None;
        entity.solid = Solid.Trigger;
        entity.touch = badAreaTouch;

        // Auto-remove if lifespan is set (handled by caller logic usually, but here for safety)
        if (entity.nextthink) {
            entity.think = (self) => {
                context.entities.free(self);
            };
        }
    });
}
