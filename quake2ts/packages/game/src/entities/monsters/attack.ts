import { angleVectors, addVec3, scaleVec3, normalizeVec3, subtractVec3, Vec3, ZERO_VEC3, vectorToAngles, ServerCommand, TempEntity, CONTENTS_SOLID, CONTENTS_MONSTER, CONTENTS_PLAYER, CONTENTS_DEADMONSTER, MASK_SHOT } from '@quake2ts/shared';
import { Entity, MoveType, Solid } from '../entity.js';
import { T_Damage, Damageable, DamageApplicationResult } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { DamageMod } from '../../combat/damageMods.js';
import type { EntitySystem } from '../system.js';
import { createBlasterBolt, createGrenade, createRocket, createBfgBall } from '../projectiles.js';
import { MulticastType } from '../../imports.js';

function crandom(): number {
  return 2 * Math.random() - 1;
}

// Renamed to force cache invalidation/TS resolution
export function monster_fire_bullet_v2(
  self: Entity,
  start: Vec3,
  dir: Vec3,
  damage: number,
  kick: number,
  hspread: number,
  vspread: number,
  flashtype: number,
  context: EntitySystem,
  mod: DamageMod = DamageMod.UNKNOWN
): void {
  let direction = dir;

  if (hspread > 0 || vspread > 0) {
    const angles = vectorToAngles(dir);
    const { right, up } = angleVectors(angles);

    const r = crandom() * hspread;
    const u = crandom() * vspread;

    direction = {
      x: dir.x + right.x * r + up.x * u,
      y: dir.y + right.y * r + up.y * u,
      z: dir.z + right.z * r + up.z * u,
    };
    direction = normalizeVec3(direction);
  }

  // Fire bullet
  const end = addVec3(start, scaleVec3(direction, 8192));

  const tr = context.trace(start, end, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);

  if (!tr.ent || tr.fraction === 1.0) {
    return;
  }

  // Apply damage
  T_Damage(
      tr.ent as unknown as Damageable,
      self as unknown as Damageable,
      self as unknown as Damageable,
      direction,
      tr.endpos,
      tr.plane?.normal || ZERO_VEC3,
      damage,
      kick,
      DamageFlags.BULLET | DamageFlags.NO_ARMOR,
      mod
  );
}

// Alias for existing code
export const monster_fire_bullet = monster_fire_bullet_v2;

export function monster_fire_shotgun(
  self: Entity,
  start: Vec3,
  aimdir: Vec3,
  damage: number,
  kick: number,
  hspread: number,
  vspread: number,
  count: number,
  flashtype: number,
  context: EntitySystem,
  mod: DamageMod = DamageMod.SHOTGUN
): void {
  for (let i = 0; i < count; i++) {
    monster_fire_bullet(self, start, aimdir, damage, kick, hspread, vspread, flashtype, context, mod);
  }
}

export function monster_fire_blaster(
    self: Entity,
    start: Vec3,
    dir: Vec3,
    damage: number,
    speed: number,
    flashtype: number,
    effect: number,
    context: EntitySystem,
    mod: DamageMod = DamageMod.BLASTER
): void {
    createBlasterBolt(context, self, start, dir, damage, speed, mod);
}

export function monster_fire_grenade(
    self: Entity,
    start: Vec3,
    aim: Vec3,
    damage: number,
    speed: number,
    flashtype: number,
    context: EntitySystem
): void {
    createGrenade(context, self, start, aim, damage, speed);
}

export function monster_fire_rocket(
    self: Entity,
    start: Vec3,
    dir: Vec3,
    damage: number,
    speed: number,
    flashtype: number,
    context: EntitySystem
): void {
    createRocket(context, self, start, dir, damage, speed);
}

export function monster_fire_bfg(
    self: Entity,
    start: Vec3,
    dir: Vec3,
    damage: number,
    speed: number,
    kick: number,
    damage_radius: number,
    flashtype: number,
    context: EntitySystem
): void {
    // BFG ball logic from createBfgBall signature:
    // createBfgBall(context: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number, damageRadius: number)
    createBfgBall(context, self, start, dir, damage, speed, damage_radius);
}

export function monster_fire_railgun(
    self: Entity,
    start: Vec3,
    aim: Vec3,
    damage: number,
    kick: number,
    flashtype: number,
    context: EntitySystem
): void {
    const end = addVec3(start, scaleVec3(aim, 8192));
    const tr = context.trace(start, end, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);

    // Create rail trail
    context.multicast(start, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.RAILTRAIL, start, tr.endpos);

    if (tr.ent && tr.ent.takedamage) {
        T_Damage(
            tr.ent as unknown as Damageable,
            self as unknown as Damageable,
            self as unknown as Damageable,
            aim,
            tr.endpos,
            ZERO_VEC3,
            damage,
            kick,
            DamageFlags.ENERGY | DamageFlags.NO_ARMOR,
            DamageMod.RAILGUN
        );
    }
}

export function monster_fire_hit(
    self: Entity,
    aim: Vec3,
    damage: number,
    kick: number,
    context: EntitySystem
): boolean {
    if (!self.enemy) return false;

    // 1. Get the direction the monster is facing
    const { forward } = angleVectors(self.angles);

    // 2. Calculate start position (adjust for viewheight)
    const start = { ...self.origin };
    start.z += self.viewheight || 0;

    // 3. Calculate end position based on range (aim.x is usually the range)
    const range = aim.x > 0 ? aim.x : 80; // Default to 80 if 0 passed
    const end = addVec3(start, scaleVec3(forward, range));

    // 4. Trace along that line
    const tr = context.trace(start, end, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);

    // 5. Check if we hit the enemy
    if (tr.ent === self.enemy || (tr.ent && tr.ent.takedamage)) {
        const dir = normalizeVec3(subtractVec3(tr.endpos, start));
        T_Damage(
            tr.ent as unknown as Damageable,
            self as unknown as Damageable,
            self as unknown as Damageable,
            dir,
            tr.endpos,
            tr.plane?.normal || ZERO_VEC3,
            damage,
            kick,
            0,
            DamageMod.UNKNOWN
        );
        return true;
    }
    return false;
}

export function monster_fire_heat(
  self: Entity,
  start: Vec3,
  dir: Vec3,
  damage: number,
  speed: number,
  flashtype: number,
  turn_fraction: number,
  context: EntitySystem
): void {
  // Implementation of heat seeking projectile - placeholder for now, usually rocket with seeking
  // For now just fire a rocket
  monster_fire_rocket(self, start, dir, damage, speed, flashtype, context);
}

// Laser Beam Logic
function dabeam_update(self: Entity, context: EntitySystem): void {
  const start = { ...self.origin };
  const end = addVec3(start, scaleVec3(self.movedir, 2048));

  const tr = context.trace(start, end, ZERO_VEC3, ZERO_VEC3, self, CONTENTS_SOLID | CONTENTS_MONSTER | CONTENTS_PLAYER | CONTENTS_DEADMONSTER);

  if (self.dmg > 0 && tr.ent && tr.ent.takedamage && tr.ent !== self.owner) {
     T_Damage(tr.ent as unknown as Damageable, self as unknown as Damageable, self.owner as unknown as Damageable, self.movedir, tr.endpos, ZERO_VEC3, self.dmg, 0, DamageFlags.ENERGY, DamageMod.TARGET_LASER);
  }

  // Draw sparks if we hit something that isn't a monster/player
  // (simplified check)
  if (tr.ent && tr.ent.solid === Solid.Bsp) {
     context.multicast(tr.endpos, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.LASER_SPARKS, 10, tr.endpos, tr.plane?.normal || ZERO_VEC3, self.skin);
  }

  // Update position
  // self.old_origin = addVec3(tr.endpos, scaleVec3(tr.plane?.normal || ZERO_VEC3, 1)); // Original does this
  context.linkentity(self);
}

function beam_think(self: Entity, context: EntitySystem): void {
  // Cleanup beam references on owner
  if (self.owner) {
    if (self.owner.beam === self) self.owner.beam = null;
    if (self.owner.beam2 === self) self.owner.beam2 = null;
  }
  context.free(self);
}

export function monster_fire_dabeam(
  self: Entity,
  damage: number,
  secondary: boolean,
  update_func: (beam: Entity, context: EntitySystem) => void,
  context: EntitySystem
): void {
  let beam = secondary ? self.beam2 : self.beam;

  if (!beam || !beam.inUse) {
    beam = context.spawn();
    beam.classname = 'laser_beam';
    beam.movetype = MoveType.None;
    beam.solid = Solid.Not;
    beam.renderfx |= 0x00000008; // RF_BEAM
    beam.modelindex = 1; // MODELINDEX_WORLD ?
    beam.owner = self;
    beam.dmg = damage;
    beam.frame = 2; // Beam width?

    // Check medic for color
    // 0xf2f2f0f0 (red-ish/orange?) vs 0xf3f3f1f1
    if (self.monsterinfo.aiflags & 0x40) { // AI_MEDIC (placeholder flag check)
      beam.skin = 0xf3f3f1f1;
    } else {
      beam.skin = 0xf2f2f0f0;
    }

    beam.think = (ent, ctx) => {
      // Execute postthink logic
      if (ent.postthink) {
        ent.postthink(ent, ctx);
      }
      // Check expiration
      if (ctx.timeSeconds >= ent.timestamp) {
         beam_think(ent, ctx);
      } else {
         ent.nextthink = ctx.timeSeconds + 0.1; // Update 10hz? or faster?
      }
    };
    beam.postthink = (ent, ctx) => {
      update_func(ent, ctx);
      dabeam_update(ent, ctx);
    };

    // Set timestamp for expiration (managed by logic usually, but here we set a short expiration that gets extended?)
    // In C++, nextthink is set to level.time + 200ms. If updated, it extends?
    // Actually in C++, monster_fire_dabeam sets nextthink to level.time + 200ms.
    // If not called again, it dies.

    if (secondary) self.beam2 = beam;
    else self.beam = beam;
  }

  beam.timestamp = context.timeSeconds + 0.2;
  beam.nextthink = context.timeSeconds + 0.01; // Run think very soon to update

  // Call update immediately
  update_func(beam, context);
  dabeam_update(beam, context);
}
