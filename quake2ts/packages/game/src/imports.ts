import type { Vec3, CollisionPlane } from '@quake2ts/shared';
import type { Entity } from './entities/entity.js';

export interface GameTraceResult {
  allsolid: boolean;
  startsolid: boolean;
  fraction: number;
  endpos: Vec3;
  plane: CollisionPlane | null;
  surfaceFlags: number;
  contents: number;
  ent: Entity | null;
}

export type TraceFunction = (
  start: Vec3,
  mins: Vec3 | null,
  maxs: Vec3 | null,
  end: Vec3,
  passent: Entity | null,
  contentmask: number
) => GameTraceResult;

export type PointContentsFunction = (point: Vec3) => number;

export interface GameImports {
  trace: TraceFunction;

  pointcontents: PointContentsFunction;

  linkentity(ent: Entity): void;
}
