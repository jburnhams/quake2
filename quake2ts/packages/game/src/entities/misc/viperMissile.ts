import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { normalizeVec3, scaleVec3, subtractVec3, addVec3, distance } from '@quake2ts/shared';
import { G_PickTarget } from '../utils.js';
import { createRocket } from '../projectiles.js';
import { DamageMod } from '../../combat/damageMods.js';

// ============================================================================
// MISC VIPER MISSILE
// ============================================================================

function misc_viper_missile_use(self: Entity, other: Entity | null, activator: Entity | null, context: EntitySystem) {
    if (!self.target) return;

    // self.s.angles used for direction if target not found?
    // The code calculates direction to target.

    // self->enemy = G_Find(NULL, FOFS(targetname), self->target);
    const target = G_PickTarget(self.target, context);
    if (!target) return;

    self.enemy = target;
    const start = self.origin;
    const dir = normalizeVec3(subtractVec3(target.origin, start));

    // monster_fire_rocket(self, start, dir, self->dmg, 500, MZ2_CHICK_ROCKET_1);
    // Use createRocket directly or monster_fire_rocket if available (usually internal to monsters)
    createRocket(context, self, start, dir, self.dmg || 250, 500, DamageMod.ROCKET);

    self.think = (ent) => context.free(ent);
    self.nextthink = context.timeSeconds + 0.1;
}

export function registerMiscViperMissile(registry: SpawnRegistry) {
    registry.register('misc_viper_missile', (entity: Entity, context: any) => {
        entity.movetype = MoveType.None;
        entity.solid = Solid.Not;
        entity.mins = { x: -8, y: -8, z: -8 };
        entity.maxs = { x: 8, y: 8, z: 8 };

        if (!entity.dmg) entity.dmg = 250;

        entity.modelindex = context.entities.modelIndex("models/objects/bomb/tris.md2");

        entity.use = (self, other, activator) => misc_viper_missile_use(self, other, activator ?? null, context.entities);
        entity.svflags |= ServerFlags.NoClient;

        context.entities.linkentity(entity);
    });
}
