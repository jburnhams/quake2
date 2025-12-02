import type { SpawnRegistry, SpawnFunction } from './spawn.js';
import { MoveType, Solid, ServerFlags, Entity } from './entity.js';
import { EntitySystem } from './system.js';
import { DamageMod } from '../combat/damageMods.js';
import { closestPointToBox } from '@quake2ts/shared';
import { T_Damage } from '../combat/damage.js';

// ============================================================================
// FUNC OBJECT
// ============================================================================

const SPAWNFLAGS_OBJECT_TRIGGER_SPAWN = 1;
const SPAWNFLAGS_OBJECT_ANIMATED = 2;
const SPAWNFLAGS_OBJECT_ANIMATED_FAST = 4;

function func_object_touch(self: Entity, other: Entity | null, plane?: any, surf?: any) {
    if (!other || !self.dmg) return;
    if (other === self) return;

    // only squash thing we fall on top of
    if (plane && plane.normal && plane.normal.z < 1.0) {
        return;
    }

    if (!other.takedamage) return;

    // We assume self.dmg is set.
    const damage = self.dmg || 100;
    const point = closestPointToBox(other.origin, self.absmin, self.absmax);

    // Since we don't have direct access to 'context.timeSeconds' here for T_Damage,
    // we use 0 or current time if available on self?
    // Entity doesn't store current time.
    // However, T_Damage uses time for powerup checks (quad/invuln).
    // func_object is not a player, so attacker=self means no quad bonus.
    // So time=0 is safe for damage calculation here.
    const time = 0;

    // We also lack access to multicast for effects, so we pass undefined.

    T_Damage(other as any, self as any, self as any, {x:0, y:0, z:0}, point, plane?.normal || {x:0, y:0, z:1}, damage, 1, 0, DamageMod.CRUSH, time);
}

const func_object: SpawnFunction = (entity, context) => {
    // Adjust bounds
    entity.mins = {
        x: entity.mins.x + 1,
        y: entity.mins.y + 1,
        z: entity.mins.z + 1
    };
    entity.maxs = {
        x: entity.maxs.x - 1,
        y: entity.maxs.y - 1,
        z: entity.maxs.z - 1
    };

    if (!entity.dmg) entity.dmg = 100;

    const func_object_release = (self: Entity, ctx: EntitySystem) => {
        self.movetype = MoveType.Toss;
        self.touch = func_object_touch;
    };

    // Need to bind context for think
    const thinkWrapper = (self: Entity) => func_object_release(self, context.entities);

    if (!(entity.spawnflags & SPAWNFLAGS_OBJECT_TRIGGER_SPAWN)) {
        entity.solid = Solid.Bsp;
        entity.movetype = MoveType.Push;
        entity.think = thinkWrapper;
        // 20_hz = 0.05s. Rounding to 0.1s tick? Let's use 0.1s.
        context.entities.scheduleThink(entity, context.entities.timeSeconds + 0.1);
    } else {
        entity.solid = Solid.Not;
        entity.movetype = MoveType.Push;
        entity.use = (self, other, activator) => {
            self.solid = Solid.Bsp;
            self.svflags &= ~ServerFlags.NoClient;
            self.use = undefined;
            func_object_release(self, context.entities);
            context.entities.killBox(self);
        };
        entity.svflags |= ServerFlags.NoClient;
    }

    if (entity.spawnflags & SPAWNFLAGS_OBJECT_ANIMATED) {
        // entity.effects |= EF_ANIM_ALL;
    }

    // entity.clipmask = MASK_MONSTERSOLID; // Not fully supported in TS types yet?
    // entity.flags |= FL_NO_STANDING;

    // linkentity done by system
};

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerMiscSpawns(registry: SpawnRegistry) {
  registry.register('misc_teleporter', (entity) => {
    // Simplified, full implementation in teleporter.c
  });

  registry.register('misc_teleporter_dest', (entity) => {
    // Simplified, just a destination marker
  });

  registry.register('misc_explobox', (entity) => {
    entity.solid = Solid.Bsp;
    entity.movetype = MoveType.None;
    // Full implementation in g_misc.c
  });

  registry.register('misc_banner', (entity) => {
    entity.movetype = MoveType.None;
    entity.solid = Solid.Not;
    // Banners are decorative
  });

  registry.register('misc_deadsoldier', (entity) => {
    entity.movetype = MoveType.None;
    entity.solid = Solid.Bsp;
    // Decorative
  });

  // Example gib registration, others would follow a similar pattern
  registry.register('misc_gib_arm', (entity) => {
    entity.movetype = MoveType.Toss;
    entity.solid = Solid.Not;
    // Decorative
  });

  registry.register('func_object', func_object);
}
