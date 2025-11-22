import { Entity, MoveType, Solid } from '../entities/entity.js';
import { GameImports } from '../imports.js';
import { addVec3, scaleVec3, clipVelocityVec3, Vec3 } from '@quake2ts/shared';
import type { EntitySystem } from '../entities/system.js';

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

function testEntityPosition(ent: Entity, imports: GameImports): boolean {
  // Use trace to check if the entity is stuck in a solid
  // When start equals end, trace returns immediately with startsolid/allsolid if it overlaps
  const trace = imports.trace(ent.origin, ent.mins, ent.maxs, ent.origin, ent, ent.clipmask);
  if (trace.startsolid || trace.allsolid) {
    return false;
  }
  return true;
}

export function runPush(
  pusher: Entity,
  system: EntitySystem,
  imports: GameImports,
  frametime: number,
): boolean {
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

  // 1. Calculate the swept bounding box of the pusher to find potential collisions
  // We need to encompass the entire movement
  const mins = {
    x: Math.min(pusher.absmin.x, pusher.absmin.x + move.x) - 2.0, // Expand slightly? Quake2 does 'mins - move - 2' logic implicitly via box check
    y: Math.min(pusher.absmin.y, pusher.absmin.y + move.y) - 2.0,
    z: Math.min(pusher.absmin.z, pusher.absmin.z + move.z) - 2.0,
  };

  const maxs = {
    x: Math.max(pusher.absmax.x, pusher.absmax.x + move.x) + 2.0,
    y: Math.max(pusher.absmax.y, pusher.absmax.y + move.y) + 2.0,
    z: Math.max(pusher.absmax.z, pusher.absmax.z + move.z) + 2.0,
  };

  // We keep track of everything we moved so we can revert if blocked
  const pushed: { ent: Entity; origin: Vec3; angles: Vec3; ground: Entity | null }[] = [];

  // Save pusher state
  pushed.push({
    ent: pusher,
    origin: { ...pusher.origin },
    angles: { ...pusher.angles },
    ground: pusher.groundentity,
  });

  // Move the pusher
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

  if (!testEntityPosition(pusher, imports)) {
    // Pusher itself is stuck
    pusher.origin = pushed[0].origin;
    pusher.angles = pushed[0].angles;
    imports.linkentity(pusher);
    return false;
  }

  // Find entities that need to be pushed
  // We scan all entities to see if they are in the swept box
  // This is potentially expensive but matches Quake 2 logic (SV_Push)
  const candidates: Entity[] = [];
  system.forEachEntity((check) => {
    if (check === pusher) return;
    if (check.solid === Solid.Not || check.solid === Solid.Trigger) return;
    if (
      check.absmin.x >= maxs.x ||
      check.absmax.x <= mins.x ||
      check.absmin.y >= maxs.y ||
      check.absmax.y <= mins.y ||
      check.absmin.z >= maxs.z ||
      check.absmax.z <= mins.z
    ) {
      return;
    }
    candidates.push(check);
  });

  // Now try to move the candidates
  for (const ent of candidates) {
    // Determine if we should push this entity
    // If it's standing on us, we push it
    // If we move into it, we push it

    // For now, simple box intersection test after pusher move (which we just did)
    // NOTE: In Q2, there is logic for "standing on" (groundentity) vs "pushed by"
    // Entities standing on the pusher move with it regardless of collision (e.g. elevators)

    let moveEntity = false;

    if (ent.groundentity === pusher) {
      moveEntity = true;
      // If we are rotating, the entity standing on us needs to rotate around our origin
      // This is complex, simplified for now to just translation
    } else {
        // Check intersection with new pusher position
        // If pusher's new absbox intersects ent's absbox, we push
        // We need to re-link pusher to get accurate absbox (done above)
        // Wait, 'linkentity' updates absmin/absmax.
        if (
            ent.absmin.x < pusher.absmax.x &&
            ent.absmax.x > pusher.absmin.x &&
            ent.absmin.y < pusher.absmax.y &&
            ent.absmax.y > pusher.absmin.y &&
            ent.absmin.z < pusher.absmax.z &&
            ent.absmax.z > pusher.absmin.z
        ) {
            moveEntity = true;
        }
    }

    if (moveEntity) {
      pushed.push({
        ent,
        origin: { ...ent.origin },
        angles: { ...ent.angles },
        ground: ent.groundentity,
      });

      // Move the entity
      ent.origin = {
        x: ent.origin.x + move.x,
        y: ent.origin.y + move.y,
        z: ent.origin.z + move.z,
      };

      // If standing on pusher, we might also rotate (TODO: amove support for riders)

      imports.linkentity(ent);

      // Check if this entity is now stuck
      if (!testEntityPosition(ent, imports)) {
        // It is stuck. Can we unstick it? Or is it blocked?
        // In Q2, if it's a player, we might try to nudge them?
        // But generally, this counts as a block.

        if (pusher.blocked) {
            pusher.blocked(pusher, ent);
        }

        // If the blocker is still there (wasn't destroyed by the blocked callback), revert
        // We check if the blocker is still valid and in the way.
        // Simplified: check if it's still solid and alive (if it had health)
        if (ent.solid !== Solid.Not && (!ent.health || ent.health > 0)) {
             // Blocked! Revert all.
             for (let i = pushed.length - 1; i >= 0; i--) {
                 const p = pushed[i];
                 p.ent.origin = p.origin;
                 p.ent.angles = p.angles;
                 p.ent.groundentity = p.ground,
                 imports.linkentity(p.ent);
             }
             return false;
        }
      }
    }
  }

  return true;
}
