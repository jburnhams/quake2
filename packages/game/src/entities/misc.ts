import type { SpawnRegistry, SpawnFunction } from './spawn.js';
import { MoveType, Solid, ServerFlags, Entity, EntityFlags, CollisionSurface, DeadFlag } from './entity.js';
import { EntitySystem } from './system.js';
import { DamageMod } from '../combat/damageMods.js';
import { closestPointToBox, CollisionPlane, Vec3 } from '@quake2ts/shared';
import { EntityEffects } from './enums.js';
import { T_Damage } from '../combat/damage.js';
import { M_CatagorizePosition, M_WorldEffects, M_droptofloor } from '../ai/monsterStart.js';
import { M_walkmove, vectoyaw } from '../ai/m_move.js';
import { registerMiscViper, registerMiscViperBomb, registerMiscStroggShip, registerMiscBigViper } from './misc/flyers.js';
import { registerMiscViperMissile } from './misc/viperMissile.js';
import { registerMiscSatelliteDish, registerMiscBlackhole, registerMiscEasterTank, registerMiscEasterChick, registerMiscEasterChick2 } from './misc/decorative.js';
import { registerFuncClock, registerTargetString, registerTargetCharacter, registerMiscFlare, registerMiscHologram, registerMiscFireball, registerInfoLandmark, registerInfoWorldText, registerMiscPlayerMannequin, registerMiscModel } from './misc/more_misc.js';


// ============================================================================
// FUNC OBJECT
// ============================================================================

const SPAWNFLAGS_OBJECT_TRIGGER_SPAWN = 1;
const SPAWNFLAGS_OBJECT_ANIMATED = 2;
const SPAWNFLAGS_OBJECT_ANIMATED_FAST = 4;

function func_object_touch(self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: CollisionSurface | null) {
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

    // Cast other/self to any to bypass strict function covariance check between Entity and Damageable
    // TODO: Fix Entity vs Damageable type hierarchy for callbacks
    T_Damage(other as any, self as any, self as any, {x:0, y:0, z:0}, point, plane?.normal || {x:0, y:0, z:1}, damage, 1, 0, DamageMod.CRUSH, time);
}

export const SP_func_object: SpawnFunction = (entity, context) => {
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
// GIBS
// ============================================================================

function gib_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, mod: DamageMod) {
    // G_FreeEdict(self); // If using context.free, we need context.
    // We can attach a free helper via closure in spawn function?
    // Or just set think to free.
    // For now, let's assume system handles garbage collection if health <= 0 eventually or think function kills it.
    // Replicating: if (mod == MOD_CRUSH) G_FreeEdict(self);
    // Since we don't have full context here easily without a factory closure, we skip logic for now.
}

/** SP_misc_gib_arm, _leg and _head */
function spawn_gib(entity: Entity, model: string, context: { entities: EntitySystem }) {
    context.entities.setModel(entity, model);
    entity.solid = Solid.Not;
    entity.effects |= EntityEffects.Gib;
    entity.takedamage = true;
    entity.die = gib_die;
    entity.movetype = MoveType.Toss;
    entity.deadflag = DeadFlag.Dead;

    const rng = context.entities.rng;
    const x = rng.frandomMax(200);
    const y = rng.frandomMax(200);
    const z = rng.frandomMax(200);
    entity.avelocity = { x, y, z };

    entity.think = (self) => context.entities.free(self);
    context.entities.scheduleThink(entity, context.entities.timeSeconds + 10);
    context.entities.linkentity(entity);
}

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

  // SP_misc_explobox: a barrel. It steps (it can be pushed and falls), starts a frame later by
  // dropping to the floor, and then checks its water every frame (barrel_start, barrel_think).
  // Shooting it (barrel_delay, burn and explode) is still to port.
  registry.register('misc_explobox', (self, context) => {
    const sys = context.entities;
    if (sys.deathmatch) {
      // auto-remove for deathmatch
      context.free(self);
      return;
    }
    sys.modelIndex('models/objects/debris1/tris.md2');
    sys.modelIndex('models/objects/debris2/tris.md2');
    sys.modelIndex('models/objects/debris3/tris.md2');
    sys.soundIndex('weapons/bfg__l1a.wav');

    self.solid = Solid.BoundingBox;
    self.movetype = MoveType.Step;
    self.model = 'models/objects/barrels/tris.md2';
    self.modelindex = sys.modelIndex(self.model);
    self.mins = { x: -16, y: -16, z: 0 };
    self.maxs = { x: 16, y: 16, z: 40 };
    if (!self.mass) self.mass = 50;
    if (!self.health) self.health = 10;
    if (!self.dmg) self.dmg = 150;
    self.takedamage = true;
    // (FL_TRAP is bit 32 of the rerelease's 64-bit flags, past the port's 32)

    // barrel_touch: something standing on the ground pushes it
    self.touch = (barrel, other, _plane, _surf) => {
      if (!other || !other.groundentity || other.groundentity === barrel) return;
      const ratio = other.mass / barrel.mass;
      const v = { x: barrel.origin.x - other.origin.x, y: barrel.origin.y - other.origin.y, z: barrel.origin.z - other.origin.z };
      M_walkmove(barrel, vectoyaw(v), 20 * ratio * sys.frameTimeSeconds, sys);
    };

    // PGM - change so barrels will think and hence, blow up
    const barrelThink = (barrel: Entity) => {
      // the think needs to be first since later stuff may override.
      barrel.think = barrelThink;
      barrel.nextthink = sys.timeSeconds + sys.frameTimeSeconds;
      M_CatagorizePosition(barrel, barrel.origin, sys);
      barrel.flags |= EntityFlags.ImmuneSlime;
      barrel.air_finished = sys.timeSeconds + 100;
      M_WorldEffects(barrel, sys);
    };
    self.think = (barrel) => {
      // barrel_start
      M_droptofloor(barrel, sys);
      barrel.think = barrelThink;
      barrel.nextthink = sys.timeSeconds + sys.frameTimeSeconds;
    };
    self.nextthink = sys.timeSeconds + 0.05;
    sys.linkentity(self);
  });

  // SP_misc_banner: the origin is the bottom of the banner, which waves through 16 frames at 10 Hz.
  registry.register('misc_banner', (entity, context) => {
    const sys = context.entities;
    entity.movetype = MoveType.None;
    entity.solid = Solid.Not;
    entity.modelindex = sys.modelIndex('models/objects/banner/tris.md2');
    entity.frame = sys.rng.irandom(16);
    sys.linkentity(entity);

    entity.think = (self) => {
      self.frame = (self.frame + 1) % 16;
      self.nextthink = sys.timeSeconds + 0.1;
    };
    entity.nextthink = sys.timeSeconds + 0.1;
  });

  // g_misc.c SP_misc_deadsoldier: a corpse; shots and dead-monster masks hit it, players walk over it.
  registry.register('misc_deadsoldier', (entity, context) => {
    if (context.entities.deathmatch) {
      // auto-remove for deathmatch
      context.free(entity);
      return;
    }
    entity.movetype = MoveType.None;
    entity.solid = Solid.BoundingBox;
    entity.model = 'models/deadbods/dude/tris.md2';
    entity.modelindex = context.entities.modelIndex(entity.model);
    entity.mins = { x: -16, y: -16, z: 0 };
    // ON_BACK ON_STOMACH BACK_DECAP FETAL_POS SIT_DECAP IMPALED; defaults to frame 0
    const poses = [2, 4, 8, 16, 32];
    const pose = poses.findIndex((flag) => entity.spawnflags & flag);
    entity.frame = pose < 0 ? 0 : pose + 1;
    entity.maxs = { x: 16, y: 16, z: 16 };
    entity.deadflag = DeadFlag.Dead;
    // (takedamage and misc_deadsoldier_die come with the gibs, which are not ported yet)
    // nb: SVF_MONSTER is here so it bleeds
    entity.svflags |= ServerFlags.Monster | ServerFlags.DeadMonster;
    context.entities.linkentity(entity);
  });

  registry.register('misc_gib_arm', (entity, context) => {
    spawn_gib(entity, "models/objects/gibs/arm/tris.md2", context);
  });

  registry.register('misc_gib_leg', (entity, context) => {
    spawn_gib(entity, "models/objects/gibs/leg/tris.md2", context);
  });

  registry.register('misc_gib_head', (entity, context) => {
    spawn_gib(entity, "models/objects/gibs/head/tris.md2", context);
  });

  registry.register('func_object', SP_func_object);
  registerMiscViper(registry);
  registerMiscViperBomb(registry);
  registerMiscViperMissile(registry);
  registerMiscStroggShip(registry);
  registerMiscBigViper(registry);
  registerMiscSatelliteDish(registry);
  registerMiscBlackhole(registry);
  registerMiscEasterTank(registry);
  registerMiscEasterChick(registry);
  registerMiscEasterChick2(registry);
  registerFuncClock(registry);
  registerTargetString(registry);
  registerTargetCharacter(registry);
  registerMiscFlare(registry);
  registerMiscHologram(registry);
  registerMiscFireball(registry);
  registerInfoLandmark(registry);
  registerInfoWorldText(registry);
  registerMiscPlayerMannequin(registry);
  registerMiscModel(registry);
}
