import { angleVectors, addVec3, scaleVec3, normalizeVec3, subtractVec3, Vec3, ZERO_VEC3, vectorToAngles, ServerCommand, TempEntity } from '@quake2ts/shared';
import { Entity } from '../entity.js';
import { T_Damage, Damageable, DamageApplicationResult } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { DamageMod } from '../../combat/damageMods.js';
import type { EntitySystem } from '../system.js';
import { createBlasterBolt, createGrenade, createRocket } from '../projectiles.js';
import { MulticastType } from '../../imports.js';

function crandom(): number {
  return 2 * Math.random() - 1;
}

export function monster_fire_bullet(
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

  const tr = context.trace(start, null, null, end, self, 0x1 | 0x20000000); // MASK_SHOT

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
    const tr = context.trace(start, null, null, end, self, 0x1 | 0x20000000); // MASK_SHOT

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
    const tr = context.trace(start, end, ZERO_VEC3, ZERO_VEC3, self, 0x1 | 0x20000000); // MASK_SHOT

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
