/**
 * MOVETYPE_STEP: monsters and objects that rest on the ground, ported from the rerelease
 * g_phys.cpp (SV_CheckVelocity, SV_FlyMove, SV_AddGravity, SV_AddRotationalFriction,
 * SV_Physics_Step). Monsters freefall when they have no ground entity; otherwise their
 * movement is done in discrete steps by the AI (M_MoveStep), and this only applies friction,
 * keeps them on the ground and runs their think.
 */
import { slideMove, type PmoveTraceResult, type Vec3 } from '@quake2ts/shared';
import { Entity, EntityFlags, ServerFlags } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { AIFlags } from '../ai/constants.js';
import { M_CatagorizePosition, M_CheckGround, M_WorldEffects } from '../ai/monsterStart.js';
import { getClipMask } from './pusher.js';

const SV_MAXVELOCITY = 2000;
const SV_STOPSPEED = 100;
const SV_FRICTION = 6;
const SV_WATERFRICTION = 1;
const STOP_EPSILON_OVERCLIP = 1.01;
const WATER_WAIST = 2;
const WATER_UNDER = 3;

const isZero = (v: Vec3) => !v.x && !v.y && !v.z;

/** SV_CheckVelocity: bound velocity to sv_maxvelocity. */
export function checkVelocity(ent: Entity): void {
  const v = ent.velocity;
  const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (speed > SV_MAXVELOCITY) {
    const s = SV_MAXVELOCITY / speed;
    ent.velocity = { x: v.x * s, y: v.y * s, z: v.z * s };
  }
}

/** G_Impact: two entities have touched, so run their touch functions. */
function impact(e1: Entity, e2: Entity, tr: PmoveTraceResult): void {
  const plane = tr.planeNormal ? { normal: tr.planeNormal, dist: 0, type: 0, signbits: 0 } : null;
  if (e1.touch && (e1.solid !== 0 || e1.flags & EntityFlags.AlwaysTouch)) e1.touch(e1, e2, plane as any, null);
  if (e2.touch && (e2.solid !== 0 || e2.flags & EntityFlags.AlwaysTouch)) e2.touch(e2, e1, plane as any, null);
}

/** SV_FlyMove: the basic solid body movement clip that slides along multiple planes. */
export function flyMove(ent: Entity, time: number, mask: number, sys: EntitySystem): void {
  ent.groundentity = null;

  // PM_StepSlideMove_Generic, recording every trace that hit something (PM_RecordTrace).
  const touches: PmoveTraceResult[] = [];
  const result = slideMove({
    origin: ent.origin,
    velocity: ent.velocity,
    frametime: time,
    overbounce: STOP_EPSILON_OVERCLIP,
    mins: ent.mins,
    maxs: ent.maxs,
    trace: (start, end, mins, maxs) => {
      const tr = sys.trace(start, mins ?? ent.mins, maxs ?? ent.maxs, end, ent, mask);
      const out: PmoveTraceResult = {
        fraction: tr.fraction,
        endpos: tr.endpos,
        allsolid: tr.allsolid,
        startsolid: tr.startsolid,
        planeNormal: tr.plane?.normal,
        contents: tr.contents,
        surfaceFlags: tr.surfaceFlags,
        ent: tr.ent ?? undefined,
      };
      if ((tr.allsolid || tr.fraction < 1) && tr.ent && !touches.some((t) => t.ent === tr.ent)) touches.push(out);
      return out;
    },
  });
  ent.origin = result.origin;
  ent.velocity = result.velocity;

  for (const tr of touches) {
    const other = tr.ent as Entity;
    if (tr.planeNormal && tr.planeNormal.z > 0.7) {
      ent.groundentity = other;
      ent.groundentity_linkcount = other.linkcount;
    }
    impact(ent, other, tr);
    // The impact function asked for the velocity to be killed.
    if (ent.flags & EntityFlags.KillVelocity) {
      ent.flags &= ~EntityFlags.KillVelocity;
      ent.velocity = { x: 0, y: 0, z: 0 };
    }
  }
}

/** SV_AddGravity */
export function addGravity(ent: Entity, levelGravity: number, frametime: number): void {
  const s = ent.gravity * levelGravity * frametime;
  ent.velocity = {
    x: ent.velocity.x + ent.gravityVector.x * s,
    y: ent.velocity.y + ent.gravityVector.y * s,
    z: ent.velocity.z + ent.gravityVector.z * s,
  };
}

/** SV_AddRotationalFriction */
function addRotationalFriction(ent: Entity, frametime: number): void {
  ent.angles = {
    x: ent.angles.x + ent.avelocity.x * frametime,
    y: ent.angles.y + ent.avelocity.y * frametime,
    z: ent.angles.z + ent.avelocity.z * frametime,
  };
  const adjustment = frametime * SV_STOPSPEED * SV_FRICTION;
  const damp = (v: number) => (v > 0 ? Math.max(0, v - adjustment) : Math.min(0, v + adjustment));
  ent.avelocity = { x: damp(ent.avelocity.x), y: damp(ent.avelocity.y), z: damp(ent.avelocity.z) };
}

/** Scales one axis of speed down by friction, as SV_Physics_Step does for each case. */
function damped(speed: number, frametime: number, friction: number): number {
  const control = speed < SV_STOPSPEED ? SV_STOPSPEED : speed;
  const newspeed = Math.max(0, speed - frametime * control * friction);
  return newspeed / speed;
}

/** SV_Physics_Step */
export function physicsStep(ent: Entity, sys: EntitySystem, levelGravity: number): void {
  const frametime = sys.frameTimeSeconds;
  const mask = getClipMask(ent);

  // Airborne monsters should always check for ground.
  if (!ent.groundentity) M_CheckGround(ent, mask, sys);

  const wasonground = !!ent.groundentity;

  checkVelocity(ent);

  if (!isZero(ent.avelocity)) addRotationalFriction(ent, frametime);

  if (Number.isNaN(ent.velocity.x) || Number.isNaN(ent.velocity.y) || Number.isNaN(ent.velocity.z))
    ent.velocity = { x: 0, y: 0, z: 0 };

  // Add gravity except for flying monsters and swimming monsters who are in the water.
  if (!wasonground && !(ent.flags & EntityFlags.Fly) && !(ent.flags & EntityFlags.Swim && ent.waterlevel > WATER_WAIST)) {
    if (ent.waterlevel !== WATER_UNDER) addGravity(ent, levelGravity, frametime);
  }

  const alternateFly = (ent.monsterinfo?.aiflags ?? 0) & AIFlags.AlternateFly;

  // Friction for flying monsters that have been given vertical velocity.
  if (ent.flags & EntityFlags.Fly && ent.velocity.z !== 0 && !alternateFly) {
    ent.velocity = { ...ent.velocity, z: ent.velocity.z * damped(Math.abs(ent.velocity.z), frametime, SV_FRICTION / 3) };
  }

  // Friction for swimming monsters that have been given vertical velocity.
  if (ent.flags & EntityFlags.Swim && ent.velocity.z !== 0 && !alternateFly) {
    const f = SV_WATERFRICTION * ent.waterlevel;
    ent.velocity = { ...ent.velocity, z: ent.velocity.z * damped(Math.abs(ent.velocity.z), frametime, f) };
  }

  if (!isZero(ent.velocity)) {
    // Apply friction.
    if ((wasonground || ent.flags & (EntityFlags.Swim | EntityFlags.Fly)) && !alternateFly) {
      const v = ent.velocity;
      const speed = Math.sqrt(v.x * v.x + v.y * v.y);
      if (speed) {
        // Paril: lower friction for dead monsters
        const friction = ent.deadflag ? SV_FRICTION * 0.5 : SV_FRICTION;
        const s = damped(speed, frametime, friction);
        ent.velocity = { x: v.x * s, y: v.y * s, z: v.z };
      }
    }

    flyMove(ent, frametime, mask, sys);
    // G_TouchProjectiles is not ported yet (projectiles are not solid to monsters' moves).
    M_CheckGround(ent, mask, sys);
    sys.linkentity(ent);

    // PGM: reset this every time they move; G_TouchTriggers sets it back if appropriate.
    ent.gravity = 1;

    sys.touchTriggers(ent);
    if (!ent.inUse) return;
  }

  if (!ent.inUse) return;

  if (ent.svflags & ServerFlags.Monster) {
    M_CatagorizePosition(ent, ent.origin, sys);
    M_WorldEffects(ent, sys);
    // [Paril-KEX] last minute hack to fix Stalker upside down gravity
    if (wasonground !== !!ent.groundentity) ent.monsterinfo.physics_change?.(ent, sys);
  }

  // Regular thinking.
  sys.runThink(ent);
}
