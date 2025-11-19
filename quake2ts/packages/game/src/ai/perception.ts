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
  readonly entity: Entity | null;
}

export type TraceFunction = (start: Vec3, end: Vec3, ignore: Entity, mask: TraceMask) => TraceResult;

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

export function visible(
  self: Entity,
  other: Entity,
  trace: TraceFunction,
  options?: { throughGlass?: boolean },
): boolean {
  if ((other.flags & FL_NOVISIBLE) !== 0) {
    return false;
  }

  const start: Vec3 = { x: self.origin.x, y: self.origin.y, z: self.origin.z + self.viewheight };
  const end: Vec3 = { x: other.origin.x, y: other.origin.y, z: other.origin.z + other.viewheight };

  const mask = options?.throughGlass ? TraceMask.Opaque : TraceMask.Opaque | TraceMask.Window;
  const result = trace(start, end, self, mask);
  return result.fraction === 1 || result.entity === other;
}
