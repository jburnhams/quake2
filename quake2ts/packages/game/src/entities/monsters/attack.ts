import { angleVectors, addVec3, scaleVec3, normalizeVec3, Vec3, ZERO_VEC3, vectorToAngles } from '@quake2ts/shared';
import { Entity } from '../entity.js';
import { T_Damage, Damageable, DamageApplicationResult } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { DamageMod } from '../../combat/damageMods.js';
import type { EntitySystem } from '../system.js';
import { createBlasterBolt, createGrenade } from '../projectiles.js';

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
