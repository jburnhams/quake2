import type { Vec3 } from '@quake2ts/shared';
import { angleVectors, dotVec3, normalizeVec3, subtractVec3 } from '@quake2ts/shared';
import { distanceBetweenBoxesSquared } from '@quake2ts/shared';
import type { Entity } from '../entities/entity.js';
import { FL_NOVISIBLE, RANGE_MELEE, RANGE_MID, RANGE_NEAR, SPAWNFLAG_MONSTER_AMBUSH, TraceMask } from './constants.js';

export enum RangeCategory {
  Melee = 'melee',
  Near = 'near',
  Mid = 'mid',
  Far = 'far',
}

export interface TraceResult {
  readonly fraction: number;
  readonly ent: Entity | null;
}

export type TraceFunction = (
  start: Vec3,
  mins: Vec3 | null,
  maxs: Vec3 | null,
  end: Vec3,
  passent: Entity | null,
  contentmask: number
) => TraceResult;

function absBounds(entity: Entity): { mins: Vec3; maxs: Vec3 } {
  return {
    mins: {
      x: entity.origin.x + entity.mins.x,
      y: entity.origin.y + entity.mins.y,
      z: entity.origin.z + entity.mins.z,
    },
    maxs: {
      x: entity.origin.x + entity.maxs.x,
      y: entity.origin.y + entity.maxs.y,
      z: entity.origin.z + entity.maxs.z,
    },
  };
}

export function rangeTo(self: Entity, other: Entity): number {
  const a = absBounds(self);
  const b = absBounds(other);
  const distanceSquared = distanceBetweenBoxesSquared(a.mins, a.maxs, b.mins, b.maxs);
  return Math.sqrt(distanceSquared);
}

export function classifyRange(distance: number): RangeCategory {
  if (distance <= RANGE_MELEE) {
    return RangeCategory.Melee;
  }
  if (distance <= RANGE_NEAR) {
    return RangeCategory.Near;
  }
  if (distance <= RANGE_MID) {
    return RangeCategory.Mid;
  }
  return RangeCategory.Far;
}

export function infront(self: Entity, other: Entity): boolean {
  const { forward } = angleVectors(self.angles);
  const direction = normalizeVec3(subtractVec3(other.origin, self.origin));
  const dot = dotVec3(direction, forward);

  if (
    (self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH) !== 0 &&
    self.trail_time === 0 &&
    self.enemy === null
  ) {
    return dot > 0.15;
  }

  return dot > -0.3;
}

export interface VisibleOptions {
    throughGlass?: boolean;
    timeSeconds?: number;
    random?: () => number;
}

export function visible(
  self: Entity,
  other: Entity,
  trace: TraceFunction,
  options?: VisibleOptions,
): boolean {
  if ((other.flags & FL_NOVISIBLE) !== 0) {
    return false;
  }

  // Invisibility handling
  if (other.client && options?.timeSeconds !== undefined) {
      // HACKFLAG_ATTACK_PLAYER handling skipped as it's obscure/debug

      // If invisible
      if (other.client.invisible_time && other.client.invisible_time > options.timeSeconds) {
          // If fade time has NOT passed, we are completely invisible
          if (other.client.invisibility_fade_time && options.timeSeconds < other.client.invisibility_fade_time) {
              return false;
          }

          // Otherwise, random chance based on alpha (fading in/out?)
          // In Q2: if (random() > other->s.alpha) return false;
          // other.alpha is usually 0..1. If alpha is low (invisible), chance is high to return false.
          // Wait, alpha 0 means invisible. alpha 1 means visible.
          // If random() (0..1) > alpha, then return false.
          // e.g. alpha = 0.1. random()=0.5 -> return false (not seen).
          // e.g. alpha = 0.9. random()=0.5 -> return true (seen).
          // Assuming other.alpha is managed correctly by the fade logic in PlayerThink or ClientThink.

          // Note: Entity.alpha is used. Player invisibility usually sets renderfx/effects but also alpha for transparency.
          // We assume other.alpha is set. Default might be 0? No, default alpha is 0 which usually implies Opaque in Quake/GL unless a flag is set.
          // But for this logic, we should rely on what `p_client.c` does for alpha.
          // In Q2 `G_SetClientEffects` handles alpha.

          if (options.random) {
             // If alpha is 0 (default), this always returns false if random > 0?
             // We need to be careful. If alpha is 0 but it means "default opaque", we shouldn't use it.
             // But if invisible_time is active, alpha SHOULD be low.
             if (other.alpha !== undefined) {
                  if (options.random() > other.alpha) {
                      return false;
                  }
             }
          }
      }
  }

  const start: Vec3 = { x: self.origin.x, y: self.origin.y, z: self.origin.z + self.viewheight };
  const end: Vec3 = { x: other.origin.x, y: other.origin.y, z: other.origin.z + other.viewheight };

  const mask = options?.throughGlass ? TraceMask.Opaque : TraceMask.Opaque | TraceMask.Window;
  const result = trace(start, null, null, end, self, mask);
  return result.fraction === 1 || result.ent === other;
}
