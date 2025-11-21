import { Entity, MoveType } from '../entities/entity.js';
import { GameImports } from '../imports.js';
import { addVec3, scaleVec3, clipVelocityVec3 } from '@quake2ts/shared';

export function runGravity(ent: Entity, gravity: Vec3, frametime: number): void {
  if (ent.movetype === MoveType.Toss) {
    ent.velocity = addVec3(ent.velocity, scaleVec3(gravity, ent.gravity * frametime));
  }
}

export function runBouncing(ent: Entity, imports: GameImports, frametime: number): void {
  if (ent.movetype !== MoveType.Bounce) {
    return;
  }

  const end = addVec3(ent.origin, scaleVec3(ent.velocity, frametime));
  const traceResult = imports.trace(ent.origin, ent.mins, ent.maxs, end, ent, ent.clipmask);

  if (traceResult.fraction < 1.0) {
    ent.origin = traceResult.endpos;
  }

  if (traceResult.fraction > 0 && traceResult.fraction < 1 && traceResult.plane) {
    const clipped = clipVelocityVec3(ent.velocity, traceResult.plane.normal, 1.01);
    ent.velocity = scaleVec3(clipped, ent.bounce);
  }
}

export function runProjectileMovement(ent: Entity, imports: GameImports, frametime: number): void {
  if (ent.movetype !== MoveType.FlyMissile) {
    return;
  }

  const end = addVec3(ent.origin, scaleVec3(ent.velocity, frametime));
  const traceResult = imports.trace(ent.origin, ent.mins, ent.maxs, end, ent, ent.clipmask);

  ent.origin = traceResult.endpos;
}
