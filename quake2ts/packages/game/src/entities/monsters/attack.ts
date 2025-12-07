import { angleVectors, addVec3, scaleVec3, normalizeVec3, subtractVec3, Vec3, ZERO_VEC3, vectorToAngles, ServerCommand, TempEntity, CONTENTS_SOLID, CONTENTS_MONSTER, CONTENTS_PLAYER, CONTENTS_DEADMONSTER, MASK_SHOT } from '@quake2ts/shared';
import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { T_Damage, Damageable, DamageApplicationResult } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { DamageMod } from '../../combat/damageMods.js';
import type { EntitySystem } from '../system.js';
import { createBlasterBolt, createGrenade, createRocket, createBfgBall, createIonRipper, createBlueBlaster, createFlechette, createHeatSeekingMissile } from '../projectiles.js';
import { MulticastType } from '../../imports.js';

function getDamageScale(skill: number): number {
  if (skill >= 3) return 1.5;
  if (skill === 2) return 1.25;
  if (skill === 0) return 0.75;
  return 1.0;
}

function getSpreadScale(skill: number): number {
  if (skill >= 3) return 0.5;
  if (skill === 2) return 0.7;
  if (skill === 0) return 1.5;
  return 1.0;
}

function adjustDamage(self: Entity, damage: number, context: EntitySystem): number {
  if (self.svflags & ServerFlags.Monster) {
    return Math.floor(damage * getDamageScale(context.skill));
  }
  return damage;
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

  // Scale spread based on difficulty
  const spreadScale = (self.svflags & ServerFlags.Monster) ? getSpreadScale(context.skill) : 1.0;
  const scaledHSpread = hspread * spreadScale;
  const scaledVSpread = vspread * spreadScale;

  if (scaledHSpread > 0 || scaledVSpread > 0) {
    const angles = vectorToAngles(dir);
    const { right, up } = angleVectors(angles);

    const r = context.rng.crandom() * scaledHSpread;
    const u = context.rng.crandom() * scaledVSpread;

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
      adjustDamage(self, damage, context),
      kick,
      DamageFlags.BULLET | DamageFlags.NO_ARMOR,
      mod,
      context.timeSeconds,
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
    createBlasterBolt(context, self, start, dir, adjustDamage(self, damage, context), speed, mod);
}

export function monster_fire_blueblaster(
    self: Entity,
    start: Vec3,
    dir: Vec3,
    damage: number,
    speed: number,
    flashtype: number,
    effect: number,
    context: EntitySystem
): void {
    createBlueBlaster(context, self, start, dir, adjustDamage(self, damage, context), speed);
}

export function monster_fire_ionripper(
    self: Entity,
    start: Vec3,
    dir: Vec3,
    damage: number,
    speed: number,
    flashtype: number,
    effect: number,
    context: EntitySystem
): void {
    createIonRipper(context, self, start, dir, adjustDamage(self, damage, context), speed);
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
    createGrenade(context, self, start, aim, adjustDamage(self, damage, context), speed);
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
    createRocket(context, self, start, dir, adjustDamage(self, damage, context), 120, speed);
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
    createBfgBall(context, self, start, dir, adjustDamage(self, damage, context), speed, damage_radius);
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
            adjustDamage(self, damage, context),
            kick,
            DamageFlags.ENERGY | DamageFlags.NO_ARMOR,
            DamageMod.RAILGUN,
            context.timeSeconds,
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
            adjustDamage(self, damage, context),
            kick,
            0,
            DamageMod.UNKNOWN,
            context.timeSeconds,
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
  createHeatSeekingMissile(context, self, start, dir, adjustDamage(self, damage, context), speed, flashtype, turn_fraction);
}

// Laser Beam Logic
function dabeam_update(self: Entity, context: EntitySystem): void {
  const start = { ...self.origin };
  const end = addVec3(start, scaleVec3(self.movedir, 2048));

  // Simulating piercing logic:
  // We trace, damage if monster/player, and continue if we hit a monster/player.
  // If we hit world or non-living, we stop.

  let currentStart = { ...start };
  const MAX_PIERCE = 16;
  const pierced: Entity[] = [];
  const piercedSolidities: Solid[] = [];

  try {
      for (let i = 0; i < MAX_PIERCE; i++) {
        const tr = context.trace(currentStart, end, ZERO_VEC3, ZERO_VEC3, self, CONTENTS_SOLID | CONTENTS_MONSTER | CONTENTS_PLAYER | CONTENTS_DEADMONSTER);

        if (!tr.ent || tr.fraction >= 1.0) {
            break;
        }

        if (self.dmg > 0 && tr.ent.takedamage && tr.ent !== self.owner) {
             T_Damage(tr.ent as unknown as Damageable, self as unknown as Damageable, self.owner as unknown as Damageable, self.movedir, tr.endpos, ZERO_VEC3, self.dmg, 0, DamageFlags.ENERGY, DamageMod.TARGET_LASER, context.timeSeconds);
        }

        // Draw sparks if we hit something that isn't a monster/player
        // (simplified check)
        if (tr.ent && tr.ent.solid === Solid.Bsp) {
             context.multicast(tr.endpos, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.LASER_SPARKS, 10, tr.endpos, tr.plane?.normal || ZERO_VEC3, self.skin);

             // Stop here
             // Update self.origin to endpos for next frame?
             // self.old_origin = addVec3(tr.endpos, scaleVec3(tr.plane?.normal || ZERO_VEC3, 1)); // C++ does this
             // But 'dabeam_update' in C++ updates self.s.old_origin, which is visual interpolation?
             // Here we just use it for whatever.
             break;
        }

        // If we hit a monster/player, we pierce through
        if (tr.ent && (tr.ent.takedamage || tr.ent.client)) {
             pierced.push(tr.ent);
             piercedSolidities.push(tr.ent.solid);
             tr.ent.solid = Solid.Not;
             currentStart = { ...tr.endpos };
             continue;
        }

        break; // Hit something else (e.g. static entity that doesn't take damage)
      }
  } finally {
      // Restore solids
      for (let i = 0; i < pierced.length; i++) {
          pierced[i].solid = piercedSolidities[i];
      }
  }

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
    // Checking AI_MEDIC (0x40 in aiflags? need to verify flag value)
    // Actually we can check classname or assume caller knows.
    // For now, using default colors.
    beam.skin = 0xf2f2f0f0;

    beam.think = (ent, ctx) => {
      // Execute postthink logic
      if (ent.postthink) {
        ent.postthink(ent, ctx);
      }
      // Check expiration
      if (ctx.timeSeconds >= ent.timestamp) {
         beam_think(ent, ctx);
      } else {
         ent.nextthink = ctx.timeSeconds + 0.1;
      }
    };
    beam.postthink = (ent, ctx) => {
      update_func(ent, ctx);
      dabeam_update(ent, ctx);
    };

    if (secondary) self.beam2 = beam;
    else self.beam = beam;
  }

  beam.timestamp = context.timeSeconds + 0.2;
  beam.nextthink = context.timeSeconds + 0.01; // Run think very soon to update

  // Call update immediately
  update_func(beam, context);
  dabeam_update(beam, context);
}

export function monster_fire_flechette(
  self: Entity,
  start: Vec3,
  dir: Vec3,
  damage: number,
  speed: number,
  flashtype: number,
  context: EntitySystem
): void {
    createFlechette(context, self, start, dir, adjustDamage(self, damage, context), speed);
}
