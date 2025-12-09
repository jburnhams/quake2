import { Entity, MoveType } from '../entities/entity.js';
import { GameImports } from '../imports.js';
import { addVec3, scaleVec3, clipVelocityVec3, Vec3 } from '@quake2ts/shared';

export function runGravity(ent: Entity, gravity: Vec3, frametime: number): void {
  if (ent.movetype === MoveType.Toss) {
    ent.velocity = addVec3(ent.velocity, scaleVec3(gravity, ent.gravity * frametime));
    ent.origin = addVec3(ent.origin, scaleVec3(ent.velocity, frametime));
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

export function runPush(pusher: Entity, imports: GameImports, frametime: number): void {
  const move = {
    x: pusher.velocity.x * frametime,
    y: pusher.velocity.y * frametime,
    z: pusher.velocity.z * frametime,
  };

  const amove = {
    x: pusher.avelocity.x * frametime,
    y: pusher.avelocity.y * frametime,
    z: pusher.avelocity.z * frametime,
  };

  const mins = {
    x: pusher.absmin.x + move.x,
    y: pusher.absmin.y + move.y,
    z: pusher.absmin.z + move.z,
  };

  const maxs = {
    x: pusher.absmax.x + move.x,
    y: pusher.absmax.y + move.y,
    z: pusher.absmax.z + move.z,
  };

  const pushed: { ent: Entity, origin: Vec3, angles: Vec3 }[] = [];

  pushed.push({ ent: pusher, origin: { ...pusher.origin }, angles: { ...pusher.angles } });

  pusher.origin = {
    x: pusher.origin.x + move.x,
    y: pusher.origin.y + move.y,
    z: pusher.origin.z + move.z,
  };

  pusher.angles = {
    x: pusher.angles.x + amove.x,
    y: pusher.angles.y + amove.y,
    z: pusher.angles.z + amove.z,
  };

  imports.linkentity(pusher);

  // TODO: implement the rest of the function
}
