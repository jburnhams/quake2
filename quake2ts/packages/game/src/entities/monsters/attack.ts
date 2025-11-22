import { angleVectors, addVec3, scaleVec3, normalizeVec3, Vec3, ZERO_VEC3 } from '@quake2ts/shared';
import { Entity } from '../entity.js';
import { T_Damage, Damageable, DamageApplicationResult } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { DamageMod } from '../../combat/damageMods.js';
import type { EntitySystem } from '../system.js';

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
  // TODO: Apply spread (crandom)
  // For now, just use dir

  // Fire bullet
  const end = addVec3(start, scaleVec3(dir, 8192));

  const tr = context.trace(start, null, null, end, self, 0x1 | 0x20000000); // MASK_SHOT

  if (!tr.ent || tr.fraction === 1.0) {
    return;
  }

  // Apply damage
  T_Damage(
      tr.ent as unknown as Damageable,
      self as unknown as Damageable,
      self as unknown as Damageable,
      dir,
      tr.endpos,
      tr.plane?.normal || ZERO_VEC3,
      damage,
      kick,
      DamageFlags.BULLET | DamageFlags.NO_ARMOR, // Usually monsters ignore armor? Or maybe not.
      mod
  );
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
    // Create projectile
    // This is a placeholder, we need to look at how blaster bolts are created in projectiles.ts or implement here.
    // projectiles.ts doesn't have blaster yet, so we might need to add it.
    // For now, we will skip implementation until we add blaster support.
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
    // We can reuse createGrenade from projectiles.ts
    // But we need to import it.
}
