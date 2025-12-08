import { Entity, MoveType, Solid, EntityFlags } from '../entities/entity.js';
import { GameImports } from '../imports.js';
import {
  addVec3,
  scaleVec3,
  clipVelocityVec3,
  Vec3,
  subtractVec3,
  rotatePointAroundVector,
  vectorToAngles
} from '@quake2ts/shared';
import type { EntitySystem } from '../entities/system.js';
import { CheckGround } from '../ai/movement.js';
import { resolveImpact, checkTriggers } from './collision.js';

// Physics constants derived from Quake 2 source
const WATER_FRICTION = 2.0;
const WATER_GRAVITY_SCALE = 0.1;
const OVERBOUNCE_BOUNCE = 1.6;
const OVERBOUNCE_WALLBOUNCE = 2.0;

/**
 * Runs gravity for an entity.
 * Handles normal gravity and water movement physics.
 * Based on G_RunObject in g_phys.c
 */
export function runGravity(ent: Entity, gravity: Vec3, frametime: number): void {
  if (ent.movetype === MoveType.Toss || ent.movetype === MoveType.Bounce || ent.movetype === MoveType.WallBounce) {
    // Basic null checks before using vectors
    if (!ent.velocity) ent.velocity = { x: 0, y: 0, z: 0 };
    if (!ent.origin) ent.origin = { x: 0, y: 0, z: 0 };

    if (ent.waterlevel > 1) {
      // Water physics: apply friction and reduced gravity
      const speed = Math.sqrt(ent.velocity.x * ent.velocity.x + ent.velocity.y * ent.velocity.y + ent.velocity.z * ent.velocity.z);
      if (speed > 1) {
        const newspeed = speed - frametime * speed * WATER_FRICTION;
        if (newspeed < 0) {
            ent.velocity = { x: 0, y: 0, z: 0 };
        } else {
            const scale = newspeed / speed;
            ent.velocity = scaleVec3(ent.velocity, scale);
        }
      }

      ent.velocity = addVec3(ent.velocity, scaleVec3(gravity, ent.gravity * frametime * WATER_GRAVITY_SCALE));
      ent.origin = addVec3(ent.origin, scaleVec3(ent.velocity, frametime));
    } else {
      ent.velocity = addVec3(ent.velocity, scaleVec3(gravity, ent.gravity * frametime));
      ent.origin = addVec3(ent.origin, scaleVec3(ent.velocity, frametime));
    }
  }
}

export function runBouncing(ent: Entity, system: EntitySystem, imports: GameImports, frametime: number): void {
  if (ent.movetype !== MoveType.Bounce && ent.movetype !== MoveType.WallBounce) {
    return;
  }

  // Basic null checks
  if (!ent.velocity) ent.velocity = { x: 0, y: 0, z: 0 };
  if (!ent.origin) ent.origin = { x: 0, y: 0, z: 0 };

  const end = addVec3(ent.origin, scaleVec3(ent.velocity, frametime));
  const traceResult = imports.trace(ent.origin, ent.mins, ent.maxs, end, ent, ent.clipmask);

  if (traceResult.fraction < 1.0) {
    ent.origin = traceResult.endpos;
    if (traceResult.ent) {
      resolveImpact(ent, traceResult, system);
    } else {
      // Hit world
      if (ent.touch) {
        const surf = traceResult.surfaceFlags ? { name: '', flags: traceResult.surfaceFlags, value: 0 } : null;
        ent.touch(ent, system.world, traceResult.plane, surf);
      }
    }
  }

  if (traceResult.fraction > 0 && traceResult.fraction < 1 && traceResult.plane) {
    // Determine overbounce factor based on movement type
    // SV_Physics_Toss in sv_phys.c uses 1.6 for Bounce and 2.0 for WallBounce
    let overbounce = OVERBOUNCE_BOUNCE;
    if (ent.movetype === MoveType.WallBounce) {
      overbounce = OVERBOUNCE_WALLBOUNCE;
    }

    const clipped = clipVelocityVec3(ent.velocity, traceResult.plane.normal, overbounce);
    ent.velocity = clipped;

    // WallBounce also updates angles to face the new direction
    if (ent.movetype === MoveType.WallBounce) {
      ent.angles = vectorToAngles(ent.velocity);
    }
  }
}

export function runStep(
  ent: Entity,
  system: EntitySystem,
  imports: GameImports,
  gravity: Vec3,
  frametime: number,
): void {
  // SV_Physics_Step

  // Basic null checks
  if (!ent.velocity) ent.velocity = { x: 0, y: 0, z: 0 };
  if (!ent.origin) ent.origin = { x: 0, y: 0, z: 0 };

  // If not flying or swimming, apply gravity
  const isFlying = (ent.flags & (EntityFlags.Fly | EntityFlags.Swim)) !== 0;
  if (!isFlying) {
    // SV_AddGravity
    ent.velocity = addVec3(ent.velocity, scaleVec3(gravity, ent.gravity * frametime));
  }

  // Move velocity
  // SV_CheckVelocity: if velocity is small, zero it out? Not implemented in Q2 rerelease for step?
  // SV_FlyMove

  // Q2 physics loop for step movement often clips against world
  let timeLeft = frametime;
  let velocity = { ...ent.velocity };

  // We allow a few bounces/slides
  for (let i = 0; i < 4; i++) {
    const move = scaleVec3(velocity, timeLeft);
    const end = addVec3(ent.origin, move);

    const trace = imports.trace(ent.origin, ent.mins, ent.maxs, end, ent, ent.clipmask);

    if (trace.allsolid) {
      // Trapped?
      ent.velocity = { x: 0, y: 0, z: 0 };
      return;
    }

    if (trace.startsolid) {
      // Move up?
      ent.velocity = { x: 0, y: 0, z: 0 };
      return;
    }

    ent.origin = trace.endpos;

    if (trace.fraction === 1) {
      break; // Moved the whole distance
    }

    // Hit something
    if (trace.ent) {
      resolveImpact(ent, trace, system);
    }

    timeLeft -= timeLeft * trace.fraction;

    if (trace.plane) {
      velocity = clipVelocityVec3(velocity, trace.plane.normal, 1.0); // No overbounce for steps usually? Q2 uses OVERCLIP 1.01 usually
      // Actually SV_FlyMove uses NO_OVERCLIP by default unless specified.
    }

    // If velocity is very small, stop?
    const speed = velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z;
    if (speed < 1) {
      velocity = { x: 0, y: 0, z: 0 };
      break;
    }
  }

  ent.velocity = velocity;
  imports.linkentity(ent);

  checkTriggers(ent, system);
  CheckGround(ent, system);
}

export function runProjectileMovement(ent: Entity, imports: GameImports, frametime: number): void {
  if (ent.movetype !== MoveType.FlyMissile) {
    return;
  }

  // Basic null checks
  if (!ent.velocity) ent.velocity = { x: 0, y: 0, z: 0 };
  if (!ent.origin) ent.origin = { x: 0, y: 0, z: 0 };

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

      // If standing on pusher, we might also rotate
      if (ent.groundentity === pusher) {
        // Rotation handling:
        // 1. Calculate position relative to pusher's OLD origin
        // 2. Rotate that relative vector by the angular move
        // 3. Add to pusher's NEW origin (which is effectively doing translation + rotation)
        // Note: We already applied translation (move) above, so ent.origin is currently
        // (OldPos + move).
        // We want: NewPos = PusherNewPos + Rotate(OldPos - PusherOldPos)
        // Since PusherNewPos = PusherOldPos + move
        // NewPos = PusherOldPos + move + Rotate(OldPos - PusherOldPos)
        // Current ent.origin = OldPos + move
        // So we need to adjust it.
        // Let's recalculate from scratch to be safe.

        const pusherOldOrigin = pushed[0].origin;
        const pusherNewOrigin = pusher.origin; // Already moved
        const entOldOrigin = pushed[pushed.length - 1].origin; // We just pushed it

        let relPos = subtractVec3(entOldOrigin, pusherOldOrigin);

        // Apply rotations. Order: Yaw (Z), Pitch (Y), Roll (X)
        // Q2 angles are Pitch, Yaw, Roll.
        // amove.x = pitch delta, amove.y = yaw delta, amove.z = roll delta.

        if (amove.y !== 0) {
          relPos = rotatePointAroundVector({ x: 0, y: 0, z: 1 }, relPos, amove.y);
        }
        if (amove.x !== 0) {
          relPos = rotatePointAroundVector({ x: 0, y: 1, z: 0 }, relPos, amove.x);
        }
        if (amove.z !== 0) {
          relPos = rotatePointAroundVector({ x: 1, y: 0, z: 0 }, relPos, amove.z);
        }

        ent.origin = addVec3(pusherNewOrigin, relPos);

        // Also rotate the entity's facing angles
        ent.angles = {
          x: ent.angles.x + amove.x,
          y: ent.angles.y + amove.y,
          z: ent.angles.z + amove.z
        };
      }

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
