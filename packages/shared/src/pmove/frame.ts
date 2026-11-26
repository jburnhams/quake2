/**
 * One frame of player movement: a line-for-line port of `Pmove` in the rerelease's
 * `p_move.cpp` (lines 1568-1708) and the PM_* functions it calls.
 *
 * Why one file, written against the C and not built from the pure helpers beside it: the
 * helpers drifted (ground moves turned by full pitch, swimming from upmove, no pm_time, no
 * ladders or water jumps, no stuck fix), and the frame-by-frame differential test in
 * `oracle/tests/pmove.oracle.test.ts`, which runs the C file itself, is the only judge of
 * what is right. Keep this in the C's order, including its quirks (each one is marked), so
 * the next difference the oracle finds is easy to place.
 *
 * The C works in 32-bit floats, so this does too: every operation is rounded with Math.fround
 * (F), as SSE does. Ties decide real outcomes (a landing that steps up or not, a box that
 * starts inside DIST_EPSILON of a wall), and doubles broke them the other way.
 */
import type { Vec3 } from '../math/vec3.js';
import {
  CONTENTS_CURRENT_0,
  CONTENTS_CURRENT_180,
  CONTENTS_CURRENT_270,
  CONTENTS_CURRENT_90,
  CONTENTS_CURRENT_DOWN,
  CONTENTS_CURRENT_UP,
  CONTENTS_LADDER,
  CONTENTS_NO_WATERJUMP,
  CONTENTS_PLAYER,
  MASK_CURRENT,
  MASK_DEADSOLID,
  MASK_PLAYERSOLID,
  MASK_SOLID,
  MASK_WATER,
  SURF_SLICK,
} from '../bsp/contents.js';
import { PlayerButton, PmFlag, PmType } from './constants.js';
import type { PmoveImports, PmoveState, PmoveTraceResult } from './types.js';
import type { PmoveTuning } from './tuning.js';

/** MAXTOUCH in game.h. */
const MAX_TOUCH = 32;
/** MIN_STEP_NORMAL: can't step up onto very steep slopes. */
const MIN_STEP_NORMAL = 0.7;
const MAX_CLIP_PLANES = 5;
/** STOP_EPSILON in q_vec3.h. */
const STOP_EPSILON = 0.1;
const PM_LADDERMOD = 0.5;
const TIME_FLAGS = PmFlag.TimeWaterJump | PmFlag.TimeLand | PmFlag.TimeTeleport | PmFlag.TimeTrick;
const PITCH = 0;
const YAW = 1;
const ROLL = 2;
const WATER_NONE = 0;
const WATER_FEET = 1;
const WATER_WAIST = 2;
const WATER_UNDER = 3;

type V = [number, number, number];

const F = Math.fround;

const v3 = (v: Vec3): V => [F(v.x), F(v.y), F(v.z)];
const toVec = (v: V): Vec3 => ({ x: v[0], y: v[1], z: v[2] });
const dot = (a: V, b: V) => F(F(F(a[0] * b[0]) + F(a[1] * b[1])) + F(a[2] * b[2]));
const length = (a: V) => F(Math.sqrt(dot(a, a)));
const add = (a: V, b: V): V => [F(a[0] + b[0]), F(a[1] + b[1]), F(a[2] + b[2])];
const sub = (a: V, b: V): V => [F(a[0] - b[0]), F(a[1] - b[1]), F(a[2] - b[2])];
const scale = (a: V, s: number): V => [F(a[0] * s), F(a[1] * s), F(a[2] * s)];
const cross = (a: V, b: V): V => [
  F(F(a[1] * b[2]) - F(a[2] * b[1])),
  F(F(a[2] * b[0]) - F(a[0] * b[2])),
  F(F(a[0] * b[1]) - F(a[1] * b[0])),
];
const set = (out: V, a: V) => {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
};
/** vec3_t::normalize: scales in place and returns the old length. */
function normalize(a: V): number {
  const len = length(a);
  if (len) {
    const inv = F(1 / len);
    a[0] = F(a[0] * inv);
    a[1] = F(a[1] * inv);
    a[2] = F(a[2] * inv);
  }
  return len;
}
/** PIf * 2 / 360 in q_vec3.h's AngleVectors, a float constant. */
const DEG2RAD = F(F(F(Math.PI) * 2) / 360);
/** AngleVectors (q_vec3.h), with sinf and cosf. */
function vectors(angles: V): { forward: V; right: V } {
  let a = F(angles[YAW] * DEG2RAD);
  const sy = F(Math.sin(a));
  const cy = F(Math.cos(a));
  a = F(angles[PITCH] * DEG2RAD);
  const sp = F(Math.sin(a));
  const cp = F(Math.cos(a));
  a = F(angles[ROLL] * DEG2RAD);
  const sr = F(Math.sin(a));
  const cr = F(Math.cos(a));
  return {
    forward: [F(cp * cy), F(cp * sy), -sp],
    right: [
      F(F(F(F(-1 * sr) * sp) * cy) + F(F(-1 * cr) * -sy)),
      F(F(F(F(-1 * sr) * sp) * sy) + F(F(-1 * cr) * cy)),
      F(F(-1 * sr) * cp),
    ],
  };
}

/** A trace as the movement code sees it, with the plane as a tuple. */
interface Tr {
  allsolid: boolean;
  startsolid: boolean;
  fraction: number;
  endpos: V;
  normal: V;
  contents: number;
  surfaceFlags: number;
  ent: unknown;
  raw: PmoveTraceResult;
}

type TraceFn = (start: V, mins: V, maxs: V, end: V) => Tr;

/** The touch list (touch_list_t): what the move ran into, once each. */
function recordTrace(touch: PmoveTraceResult[], tr: Tr) {
  if (touch.length === MAX_TOUCH) return;
  // An import that gives no entity (the world, in a caller that does not name it) is not listed.
  if (tr.ent === undefined) return;
  for (const t of touch) if (t.ent === tr.ent) return;
  touch.push(tr.raw);
}

/** PM_ClipVelocity: slide off the impacting plane. */
function clipVelocity(inp: V, normal: V, overbounce: number): V {
  const backoff = F(dot(inp, normal) * overbounce);
  const out: V = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    out[i] = F(inp[i] - F(normal[i] * backoff));
    if (out[i] > -STOP_EPSILON && out[i] < STOP_EPSILON) out[i] = 0;
  }
  return out;
}

const SIDE_CHECKS: ReadonlyArray<{ normal: V; mins: V; maxs: V }> = [
  { normal: [0, 0, 1], mins: [-1, -1, 0], maxs: [1, 1, 0] },
  { normal: [0, 0, -1], mins: [-1, -1, 0], maxs: [1, 1, 0] },
  { normal: [1, 0, 0], mins: [0, -1, -1], maxs: [0, 1, 1] },
  { normal: [-1, 0, 0], mins: [0, -1, -1], maxs: [0, 1, 1] },
  { normal: [0, 1, 0], mins: [-1, 0, -1], maxs: [1, 0, 1] },
  { normal: [0, -1, 0], mins: [-1, 0, -1], maxs: [1, 0, 1] },
];

/** Result of G_FixStuckObject_Generic. */
export const enum StuckResult {
  GoodPosition,
  Fixed,
  NoGoodPosition,
}

/** G_FixStuckObject_Generic (p_move.cpp:10-150): find the nearest side to push a stuck box out of. */
function fixStuckObject(origin: V, ownMins: V, ownMaxs: V, trace: TraceFn): StuckResult {
  if (!trace(origin, ownMins, ownMaxs, origin).startsolid) return StuckResult.GoodPosition;

  const good: { distance: number; origin: V }[] = [];

  for (let sn = 0; sn < SIDE_CHECKS.length; sn++) {
    const side = SIDE_CHECKS[sn];
    const start: V = [origin[0], origin[1], origin[2]];
    const mins: V = [0, 0, 0];
    const maxs: V = [0, 0, 0];

    for (let n = 0; n < 3; n++) {
      if (side.normal[n] < 0) start[n] = F(start[n] + ownMins[n]);
      else if (side.normal[n] > 0) start[n] = F(start[n] + ownMaxs[n]);

      if (side.mins[n] === -1) mins[n] = ownMins[n];
      else if (side.mins[n] === 1) mins[n] = ownMaxs[n];

      if (side.maxs[n] === -1) maxs[n] = ownMins[n];
      else if (side.maxs[n] === 1) maxs[n] = ownMaxs[n];
    }

    let tr = trace(start, mins, maxs, start);
    let epsilonFix = -1;
    let epsilonDir = 0;

    if (tr.startsolid) {
      for (let e = 0; e < 3; e++) {
        if (side.normal[e] !== 0) continue;
        const ep: V = [start[0], start[1], start[2]];
        ep[e] = F(ep[e] + 1);
        tr = trace(ep, mins, maxs, ep);
        if (!tr.startsolid) {
          set(start, ep);
          epsilonFix = e;
          epsilonDir = 1;
          break;
        }
        ep[e] = F(ep[e] - 2);
        tr = trace(ep, mins, maxs, ep);
        if (!tr.startsolid) {
          set(start, ep);
          epsilonFix = e;
          epsilonDir = -1;
          break;
        }
      }
    }

    if (tr.startsolid) continue;

    const opposite: V = [origin[0], origin[1], origin[2]];
    const other = SIDE_CHECKS[sn ^ 1];
    for (let n = 0; n < 3; n++) {
      if (other.normal[n] < 0) opposite[n] = F(opposite[n] + ownMins[n]);
      else if (other.normal[n] > 0) opposite[n] = F(opposite[n] + ownMaxs[n]);
    }
    if (epsilonFix >= 0) opposite[epsilonFix] = F(opposite[epsilonFix] + epsilonDir);

    tr = trace(start, mins, maxs, opposite);
    if (tr.startsolid) continue;

    const end = add(tr.endpos, scale(side.normal, 0.125));
    const delta = sub(end, opposite);
    const newOrigin = add(origin, delta);
    if (epsilonFix >= 0) newOrigin[epsilonFix] = F(newOrigin[epsilonFix] + epsilonDir);

    tr = trace(newOrigin, ownMins, ownMaxs, newOrigin);
    if (tr.startsolid) continue;

    good.push({ origin: newOrigin, distance: dot(delta, delta) });
  }

  if (good.length) {
    // Quirk: std::sort(&good[0], &good[n - 1]) leaves the last candidate out of the sort, so
    // it is chosen only when it is the only one. Insertion sort (under 16 items) is stable.
    let best = 0;
    for (let i = 1; i < good.length - 1; i++) if (good[i].distance < good[best].distance) best = i;
    set(origin, good[best].origin);
    return StuckResult.Fixed;
  }
  return StuckResult.NoGoodPosition;
}

/**
 * Runs one Pmove frame. `state` is pm->s plus the command; the result carries pm->s and the
 * outputs (bounds, view height and angles, water, ground, touch list, jump sound, impact).
 */
export function pmoveFrame(state: PmoveState, imports: PmoveImports, tune: PmoveTuning, defaultMsec: number): PmoveState {
  // ---- pm (in/out) ----
  let pmType = state.pmType;
  let pmFlags = state.pmFlags;
  let pmTime = state.pmTime ?? 0;
  const gravity = state.gravity;
  const deltaAngles: V = v3(state.delta_angles ?? { x: 0, y: 0, z: 0 });
  const msec = state.cmd.msec ?? defaultMsec;
  const buttons = state.cmd.buttons;
  let forwardmove = state.cmd.forwardmove;
  let sidemove = state.cmd.sidemove;
  let cmdButtons: number = buttons;
  const cmdAngles: V = v3(state.cmd.angles);
  const sOrigin: V = v3(state.origin);
  let sVelocity: V = v3(state.velocity);
  let viewheight = 0;
  let viewangles: V = [0, 0, 0];
  const mins: V = v3(state.mins);
  const maxs: V = v3(state.maxs);
  let groundEntity: unknown = null;
  let onGround = false;
  let groundPlaneNormal: V = [0, 0, 0];
  let watertype = 0;
  let waterlevel = WATER_NONE;
  let jumpSound = false;
  let stepClip = false;
  let impactDelta = 0;
  const touch: PmoveTraceResult[] = [];

  // ---- pml (locals, zeroed each frame) ----
  const origin: V = [sOrigin[0], sOrigin[1], sOrigin[2]];
  const velocity: V = [sVelocity[0], sVelocity[1], sVelocity[2]];
  let forward: V = [0, 0, 0];
  let right: V = [0, 0, 0];
  const frametime = F(msec * F(0.001)); // msec * 0.001f
  let groundSurfaceFlags = 0;
  let groundContents = 0;
  const previousOrigin: V = [sOrigin[0], sOrigin[1], sOrigin[2]];
  const startVelocity: V = [velocity[0], velocity[1], velocity[2]];

  const stepSize = tune.stepSize;

  const wrap = (raw: PmoveTraceResult): Tr => ({
    allsolid: raw.allsolid,
    startsolid: raw.startsolid,
    fraction: raw.fraction,
    endpos: v3(raw.endpos),
    normal: raw.planeNormal ? v3(raw.planeNormal) : [0, 0, 0],
    contents: raw.contents ?? 0,
    surfaceFlags: raw.surfaceFlags ?? 0,
    ent: raw.ent,
    raw,
  });

  /** pm->trace: the world and entities, with an explicit mask. */
  const rawTrace = (start: V, tmins: V, tmaxs: V, end: V, mask: number): Tr =>
    wrap(imports.trace(toVec(start), toVec(end), toVec(tmins), toVec(tmaxs), mask));

  /** PM_Trace: the player's own mask unless one is given; a spectator clips on the world only. */
  const pmTrace = (start: V, tmins: V, tmaxs: V, end: V, mask = 0): Tr => {
    if (pmType === PmType.Spectator) {
      if (imports.clip) return wrap(imports.clip(toVec(start), toVec(end), toVec(tmins), toVec(tmaxs), MASK_SOLID));
      return rawTrace(start, tmins, tmaxs, end, MASK_SOLID);
    }
    if (mask === 0) {
      if (pmType === PmType.Dead || pmType === PmType.Gib) mask = MASK_DEADSOLID;
      else mask = MASK_PLAYERSOLID;
      if (pmFlags & PmFlag.IgnorePlayerCollision) mask &= ~CONTENTS_PLAYER;
    }
    return rawTrace(start, tmins, tmaxs, end, mask);
  };
  const pmTraceAuto: TraceFn = (start, tmins, tmaxs, end) => pmTrace(start, tmins, tmaxs, end);

  /** PM_StepSlideMove_Generic (p_move.cpp:251-394). */
  const stepSlideMoveGeneric = (o: V, vel: V, ft: number, tmins: V, tmaxs: V, tl: PmoveTraceResult[], hasTime: boolean, traceFn: TraceFn) => {
    const planes: V[] = [];
    const primal: V = [vel[0], vel[1], vel[2]];
    let timeLeft = ft;

    for (let bump = 0; bump < 4; bump++) {
      const end: V = [F(o[0] + F(timeLeft * vel[0])), F(o[1] + F(timeLeft * vel[1])), F(o[2] + F(timeLeft * vel[2]))];
      const tr = traceFn(o, tmins, tmaxs, end);

      if (tr.allsolid) {
        vel[2] = 0; // don't build up falling damage
        recordTrace(tl, tr);
        return;
      }

      // (The surface2 / plane2 curved-surface fix needs a second plane, which cmodel traces
      // do not report, so it never runs here.)

      if (tr.fraction > 0) {
        set(o, tr.endpos);
        planes.length = 0;
      }

      if (tr.fraction === 1) break;

      recordTrace(tl, tr);
      timeLeft = F(timeLeft - F(timeLeft * tr.fraction));

      if (planes.length >= MAX_CLIP_PLANES) {
        set(vel, [0, 0, 0]);
        break;
      }

      let i: number;
      for (i = 0; i < planes.length; i++) {
        if (dot(tr.normal, planes[i]) > 0.99) {
          // Quirk: nudges pml.origin, not the origin being moved (the same thing except in
          // the water jump simulation).
          origin[0] = F(origin[0] + F(tr.normal[0] * F(0.01)));
          origin[1] = F(origin[1] + F(tr.normal[1] * F(0.01)));
          fixStuckObject(origin, tmins, tmaxs, traceFn);
          break;
        }
      }
      if (i < planes.length) continue;

      planes.push([tr.normal[0], tr.normal[1], tr.normal[2]]);

      let j = 0;
      for (i = 0; i < planes.length; i++) {
        set(vel, clipVelocity(vel, planes[i], 1.01));
        for (j = 0; j < planes.length; j++) {
          if (j !== i && dot(vel, planes[j]) < 0) break;
        }
        if (j === planes.length) break;
      }

      if (i === planes.length) {
        // go along the crease
        if (planes.length !== 2) {
          set(vel, [0, 0, 0]);
          break;
        }
        const dir = cross(planes[0], planes[1]);
        set(vel, scale(dir, dot(dir, vel)));
      }

      if (dot(vel, primal) <= 0) {
        set(vel, [0, 0, 0]);
        break;
      }
    }

    if (hasTime) set(vel, primal);
  };

  const stepSlideMoveInner = () => stepSlideMoveGeneric(origin, velocity, frametime, mins, maxs, touch, pmTime !== 0, pmTraceAuto);

  /** PM_StepSlideMove (p_move.cpp:406-494). */
  const stepSlideMove = () => {
    const startO: V = [origin[0], origin[1], origin[2]];
    const startV: V = [velocity[0], velocity[1], velocity[2]];

    stepSlideMoveInner();

    const downO: V = [origin[0], origin[1], origin[2]];
    const downV: V = [velocity[0], velocity[1], velocity[2]];

    let up: V = [startO[0], startO[1], F(startO[2] + stepSize)];
    let tr = pmTrace(startO, mins, maxs, up);
    if (tr.allsolid) return; // can't step up

    const stepHeight = F(tr.endpos[2] - startO[2]);

    set(origin, tr.endpos);
    set(velocity, startV);

    stepSlideMoveInner();

    let down: V = [origin[0], origin[1], F(origin[2] - stepHeight)];
    const originalDown: V = [down[0], down[1], down[2]];
    if (startO[2] < down[2]) down[2] = F(startO[2] - 1);

    tr = pmTrace(origin, mins, maxs, down);
    if (!tr.allsolid) {
      const real = pmTrace(origin, mins, maxs, originalDown);
      set(origin, real.endpos);
      if (velocity[2] > 0) stepClip = true;
    }

    up = [origin[0], origin[1], origin[2]];

    const sq = (a: number, b: number) => F(F(a - b) * F(a - b));
    const downDist = F(sq(downO[0], startO[0]) + sq(downO[1], startO[1]));
    const upDist = F(sq(up[0], startO[0]) + sq(up[1], startO[1]));

    if (downDist > upDist || tr.normal[2] < MIN_STEP_NORMAL) {
      set(origin, downO);
      set(velocity, downV);
    } else {
      velocity[2] = downV[2];
    }

    // step down stairs and slopes
    if (
      pmFlags & PmFlag.OnGround &&
      !(pmFlags & PmFlag.OnLadder) &&
      (waterlevel < WATER_WAIST || (!(cmdButtons & PlayerButton.Jump) && velocity[2] <= 0))
    ) {
      down = [origin[0], origin[1], F(origin[2] - stepSize)];
      tr = pmTrace(origin, mins, maxs, down);
      if (tr.fraction < 1) set(origin, tr.endpos);
    }
  };

  /** PM_Friction (p_move.cpp:503-544). */
  const friction = () => {
    const speed = length(velocity);
    if (speed < 1) {
      velocity[0] = 0;
      velocity[1] = 0;
      return;
    }
    let drop = 0;
    if ((onGround && !(groundSurfaceFlags & SURF_SLICK)) || pmFlags & PmFlag.OnLadder) {
      const control = speed < tune.stopSpeed ? tune.stopSpeed : speed;
      drop = F(drop + F(F(control * tune.friction) * frametime));
    }
    if (waterlevel && !(pmFlags & PmFlag.OnLadder)) drop = F(drop + F(F(F(speed * tune.waterFriction) * waterlevel) * frametime));
    let newspeed = F(speed - drop);
    if (newspeed < 0) newspeed = 0;
    newspeed = F(newspeed / speed);
    velocity[0] = F(velocity[0] * newspeed);
    velocity[1] = F(velocity[1] * newspeed);
    velocity[2] = F(velocity[2] * newspeed);
  };

  /** PM_Accelerate. */
  const accelerate = (wishdir: V, wishspeed: number, accel: number) => {
    const addspeed = F(wishspeed - dot(velocity, wishdir));
    if (addspeed <= 0) return;
    let accelspeed = F(F(accel * frametime) * wishspeed);
    if (accelspeed > addspeed) accelspeed = addspeed;
    for (let i = 0; i < 3; i++) velocity[i] = F(velocity[i] + F(accelspeed * wishdir[i]));
  };

  /** PM_AirAccelerate: the wished speed is capped at 30 for the add, not for the rate. */
  const airAccelerate = (wishdir: V, wishspeed: number, accel: number) => {
    const wishspd = wishspeed > 30 ? 30 : wishspeed;
    const addspeed = F(wishspd - dot(velocity, wishdir));
    if (addspeed <= 0) return;
    let accelspeed = F(F(accel * wishspeed) * frametime);
    if (accelspeed > addspeed) accelspeed = addspeed;
    for (let i = 0; i < 3; i++) velocity[i] = F(velocity[i] + F(accelspeed * wishdir[i]));
  };

  /** PM_AddCurrents (p_move.cpp:647-777): ladders, water currents, conveyors. */
  const addCurrents = (wishvel: V) => {
    if (pmFlags & PmFlag.OnLadder) {
      if (cmdButtons & (PlayerButton.Jump | PlayerButton.Crouch)) {
        const ladderSpeed = waterlevel >= WATER_WAIST ? tune.maxSpeed : 200;
        if (cmdButtons & PlayerButton.Jump) wishvel[2] = ladderSpeed;
        else if (cmdButtons & PlayerButton.Crouch) wishvel[2] = -ladderSpeed;
      } else if (forwardmove) {
        const ladderSpeed = Math.min(Math.max(forwardmove, -200), 200);
        if (forwardmove > 0) {
          wishvel[2] = viewangles[PITCH] < 15 ? ladderSpeed : -ladderSpeed;
        } else if (forwardmove < 0) {
          if (!onGround) wishvel[0] = wishvel[1] = 0;
          wishvel[2] = ladderSpeed;
        }
      } else {
        wishvel[2] = 0;
      }

      if (!onGround) {
        if (sidemove) {
          let ladderSpeed = Math.min(Math.max(sidemove, -150), 150);
          if (waterlevel < WATER_WAIST) ladderSpeed = F(ladderSpeed * PM_LADDERMOD);
          const flat: V = [forward[0], forward[1], 0];
          normalize(flat);
          const spot = add(origin, flat);
          const tr = pmTrace(origin, mins, maxs, spot, CONTENTS_LADDER);
          if (tr.fraction !== 1 && tr.contents & CONTENTS_LADDER) {
            const r = cross(tr.normal, [0, 0, 1]);
            wishvel[0] = wishvel[1] = 0;
            set(wishvel, add(wishvel, scale(r, -ladderSpeed)));
          }
        } else {
          if (wishvel[0] < -25) wishvel[0] = -25;
          else if (wishvel[0] > 25) wishvel[0] = 25;
          if (wishvel[1] < -25) wishvel[1] = -25;
          else if (wishvel[1] > 25) wishvel[1] = 25;
        }
      }
    }

    if (watertype & MASK_CURRENT) {
      const v: V = [0, 0, 0];
      if (watertype & CONTENTS_CURRENT_0) v[0] += 1;
      if (watertype & CONTENTS_CURRENT_90) v[1] += 1;
      if (watertype & CONTENTS_CURRENT_180) v[0] -= 1;
      if (watertype & CONTENTS_CURRENT_270) v[1] -= 1;
      if (watertype & CONTENTS_CURRENT_UP) v[2] += 1;
      if (watertype & CONTENTS_CURRENT_DOWN) v[2] -= 1;
      let s = tune.waterSpeed;
      if (waterlevel === WATER_FEET && onGround) s = F(s / 2);
      set(wishvel, add(wishvel, scale(v, s)));
    }

    if (onGround) {
      const v: V = [0, 0, 0];
      if (groundContents & CONTENTS_CURRENT_0) v[0] += 1;
      if (groundContents & CONTENTS_CURRENT_90) v[1] += 1;
      if (groundContents & CONTENTS_CURRENT_180) v[0] -= 1;
      if (groundContents & CONTENTS_CURRENT_270) v[1] -= 1;
      if (groundContents & CONTENTS_CURRENT_UP) v[2] += 1;
      if (groundContents & CONTENTS_CURRENT_DOWN) v[2] -= 1;
      set(wishvel, add(wishvel, scale(v, 100)));
    }
  };

  /** PM_WaterMove (p_move.cpp:785-836): swimming steers by the full view and the jump and crouch buttons. */
  const waterMove = () => {
    const wishvel: V = [0, 0, 0];
    for (let i = 0; i < 3; i++) wishvel[i] = F(F(forward[i] * forwardmove) + F(right[i] * sidemove));

    if (!forwardmove && !sidemove && !(cmdButtons & (PlayerButton.Jump | PlayerButton.Crouch))) {
      if (!onGround) wishvel[2] = F(wishvel[2] - 60); // drift towards bottom
    } else if (cmdButtons & PlayerButton.Crouch) {
      wishvel[2] = F(wishvel[2] - F(tune.waterSpeed * 0.5));
    } else if (cmdButtons & PlayerButton.Jump) {
      wishvel[2] = F(wishvel[2] + F(tune.waterSpeed * 0.5));
    }

    addCurrents(wishvel);

    const wishdir: V = [wishvel[0], wishvel[1], wishvel[2]];
    let wishspeed = normalize(wishdir);

    if (wishspeed > tune.maxSpeed) {
      set(wishvel, scale(wishvel, F(tune.maxSpeed / wishspeed)));
      wishspeed = tune.maxSpeed;
    }
    wishspeed = F(wishspeed * 0.5);

    if (pmFlags & PmFlag.Ducked && wishspeed > tune.duckSpeed) {
      set(wishvel, scale(wishvel, F(tune.duckSpeed / wishspeed)));
      wishspeed = tune.duckSpeed;
    }

    accelerate(wishdir, wishspeed, tune.waterAccelerate);
    stepSlideMove();
  };

  /** PM_AirMove (p_move.cpp:844-923): walking (on the ground), ladders and falling. */
  const airMove = () => {
    const wishvel: V = [F(F(forward[0] * forwardmove) + F(right[0] * sidemove)), F(F(forward[1] * forwardmove) + F(right[1] * sidemove)), 0];

    addCurrents(wishvel);

    const wishdir: V = [wishvel[0], wishvel[1], wishvel[2]];
    let wishspeed = normalize(wishdir);

    const maxspeed = pmFlags & PmFlag.Ducked ? tune.duckSpeed : tune.maxSpeed;
    if (wishspeed > maxspeed) {
      set(wishvel, scale(wishvel, F(maxspeed / wishspeed)));
      wishspeed = maxspeed;
    }

    if (pmFlags & PmFlag.OnLadder) {
      accelerate(wishdir, wishspeed, tune.accelerate);
      if (!wishvel[2]) {
        if (velocity[2] > 0) {
          velocity[2] = F(velocity[2] - F(gravity * frametime));
          if (velocity[2] < 0) velocity[2] = 0;
        } else {
          velocity[2] = F(velocity[2] + F(gravity * frametime));
          if (velocity[2] > 0) velocity[2] = 0;
        }
      }
      stepSlideMove();
    } else if (onGround) {
      velocity[2] = 0; // before the accel
      accelerate(wishdir, wishspeed, tune.accelerate);
      if (gravity > 0) velocity[2] = 0;
      else velocity[2] = F(velocity[2] - F(gravity * frametime));
      if (!velocity[0] && !velocity[1]) return;
      stepSlideMove();
    } else {
      // pm_config.airaccel (sv_airaccelerate): 0, the default, is plain acceleration at 1.
      if (tune.airAccelerate) airAccelerate(wishdir, wishspeed, tune.airAccelerate);
      else accelerate(wishdir, wishspeed, 1);
      if (pmType !== PmType.Grapple) velocity[2] = F(velocity[2] - F(gravity * frametime));
      stepSlideMove();
    }
  };

  /** PM_GetWaterLevel (p_move.cpp:929-961). */
  const getWaterLevel = (position: V): { level: number; type: number } => {
    let level = WATER_NONE;
    let type = 0;
    const sample2 = Math.trunc(viewheight - mins[2]);
    const sample1 = Math.trunc(sample2 / 2);
    const point: V = [position[0], position[1], F(F(position[2] + mins[2]) + 1)];
    let cont = imports.pointcontents(toVec(point));
    if (cont & MASK_WATER) {
      type = cont;
      level = WATER_FEET;
      // Quirk: the deeper samples are taken at pml.origin, not at `position`.
      point[2] = F(F(origin[2] + mins[2]) + sample1);
      cont = imports.pointcontents(toVec(point));
      if (cont & MASK_WATER) {
        level = WATER_WAIST;
        point[2] = F(F(origin[2] + mins[2]) + sample2);
        cont = imports.pointcontents(toVec(point));
        if (cont & MASK_WATER) level = WATER_UNDER;
      }
    }
    return { level, type };
  };

  /** PM_CatagorizePosition (p_move.cpp:968-1057): ground, landing, water. */
  const categorizePosition = () => {
    const point: V = [origin[0], origin[1], F(origin[2] - 0.25)];

    if (velocity[2] > 180 || pmType === PmType.Grapple) {
      pmFlags &= ~PmFlag.OnGround;
      groundEntity = null;
      onGround = false;
    } else {
      const tr = pmTrace(origin, mins, maxs, point);
      groundPlaneNormal = tr.normal;
      groundSurfaceFlags = tr.surfaceFlags;
      groundContents = tr.contents;

      let slanted = tr.fraction < 1 && tr.normal[2] < 0.7;
      if (slanted) {
        const slant = pmTrace(origin, mins, maxs, add(origin, tr.normal));
        if (slant.fraction < 1 && !slant.startsolid) slanted = false;
      }

      if (tr.fraction === 1 || (slanted && !tr.startsolid)) {
        groundEntity = null;
        onGround = false;
        pmFlags &= ~PmFlag.OnGround;
      } else {
        groundEntity = tr.ent;
        onGround = true;

        if (pmFlags & PmFlag.TimeWaterJump) {
          pmFlags &= ~TIME_FLAGS;
          pmTime = 0;
        }

        if (!(pmFlags & PmFlag.OnGround)) {
          // just hit the ground
          if (!tune.n64Physics && velocity[2] >= 100 && groundPlaneNormal[2] >= 0.9 && !(pmFlags & PmFlag.Ducked)) {
            pmFlags |= PmFlag.TimeTrick;
            pmTime = 64;
          }
          const clipped = clipVelocity(velocity, groundPlaneNormal, 1.01);
          impactDelta = F(startVelocity[2] - clipped[2]);
          pmFlags |= PmFlag.OnGround;
          if (tune.n64Physics || pmFlags & PmFlag.Ducked) {
            pmFlags |= PmFlag.TimeLand;
            pmTime = 128;
          }
        }
      }
      recordTrace(touch, tr);
    }

    const w = getWaterLevel(origin);
    waterlevel = w.level;
    watertype = w.type;
  };

  /** PM_CheckJump (p_move.cpp:1064-1103). */
  const checkJump = () => {
    if (pmFlags & PmFlag.TimeLand) return;
    if (!(cmdButtons & PlayerButton.Jump)) {
      pmFlags &= ~PmFlag.JumpHeld;
      return;
    }
    if (pmFlags & PmFlag.JumpHeld) return;
    if (pmType === PmType.Dead) return;
    if (waterlevel >= WATER_WAIST) {
      groundEntity = null;
      onGround = false;
      return;
    }
    if (!onGround) return;

    pmFlags |= PmFlag.JumpHeld;
    jumpSound = true;
    groundEntity = null;
    onGround = false;
    pmFlags &= ~PmFlag.OnGround;

    const jumpHeight = tune.jumpSpeed;
    velocity[2] = F(velocity[2] + jumpHeight);
    if (velocity[2] < jumpHeight) velocity[2] = jumpHeight;
  };

  /** PM_CheckSpecialMovement (p_move.cpp:1110-1213): ladders and jumping out of water. */
  const checkSpecialMovement = () => {
    if (pmTime) return;

    pmFlags &= ~PmFlag.OnLadder;

    const flat: V = [forward[0], forward[1], 0];
    normalize(flat);

    let spot = add(origin, flat);
    let tr = pmTrace(origin, mins, maxs, spot, CONTENTS_LADDER);
    if (tr.fraction < 1 && tr.contents & CONTENTS_LADDER && waterlevel < WATER_WAIST) pmFlags |= PmFlag.OnLadder;

    if (!gravity) return;

    if (!(cmdButtons & PlayerButton.Jump) && forwardmove <= 0) return;

    if (waterlevel !== WATER_WAIST) return;
    if (watertype & CONTENTS_NO_WATERJUMP) return;

    spot = add(origin, scale(flat, 40));
    tr = pmTrace(origin, mins, maxs, spot, MASK_SOLID);
    if (tr.fraction === 1 || tr.normal[2] >= 0.7) return;

    const wjVel = scale(flat, 50);
    wjVel[2] = 350;
    const wjOrigin: V = [origin[0], origin[1], origin[2]];
    const touches: PmoveTraceResult[] = [];
    const time = F(0.1);
    let hasTime = true;
    const steps = Math.min(50, Math.trunc(F(10 * F(800 / gravity))));
    for (let i = 0; i < steps; i++) {
      wjVel[2] = F(wjVel[2] - F(gravity * time));
      if (wjVel[2] < 0) hasTime = false;
      stepSlideMoveGeneric(wjOrigin, wjVel, time, mins, maxs, touches, hasTime, pmTraceAuto);
    }

    tr = pmTrace(wjOrigin, mins, maxs, sub(wjOrigin, [0, 0, 2]), MASK_SOLID);
    if (tr.fraction === 1 || tr.normal[2] < 0.7 || tr.endpos[2] < origin[2]) return;

    if (onGround && Math.abs(F(origin[2] - tr.endpos[2])) <= stepSize) return;

    const w = getWaterLevel(tr.endpos);
    if (w.level >= WATER_WAIST) return;

    set(velocity, scale(flat, 50));
    velocity[2] = 350;
    pmFlags |= PmFlag.TimeWaterJump;
    pmTime = 2048;
  };

  /** PM_FlyMove (p_move.cpp:1220-1307): noclip and spectators. */
  const flyMove = (doclip: boolean) => {
    viewheight = doclip ? 0 : 22;

    const speed = length(velocity);
    if (speed < 1) {
      set(velocity, [0, 0, 0]);
    } else {
      const fr = F(tune.friction * 1.5);
      const control = speed < tune.stopSpeed ? tune.stopSpeed : speed;
      let newspeed = F(speed - F(F(control * fr) * frametime));
      if (newspeed < 0) newspeed = 0;
      newspeed = F(newspeed / speed);
      set(velocity, scale(velocity, newspeed));
    }

    normalize(forward);
    normalize(right);

    const wishvel: V = [0, 0, 0];
    for (let i = 0; i < 3; i++) wishvel[i] = F(F(forward[i] * forwardmove) + F(right[i] * sidemove));
    if (cmdButtons & PlayerButton.Jump) wishvel[2] = F(wishvel[2] + F(tune.waterSpeed * 0.5));
    if (cmdButtons & PlayerButton.Crouch) wishvel[2] = F(wishvel[2] - F(tune.waterSpeed * 0.5));

    const wishdir: V = [wishvel[0], wishvel[1], wishvel[2]];
    let wishspeed = normalize(wishdir);
    if (wishspeed > tune.maxSpeed) wishspeed = tune.maxSpeed;
    wishspeed = F(wishspeed * 2);

    const addspeed = F(wishspeed - dot(velocity, wishdir));
    if (addspeed > 0) {
      let accelspeed = F(F(tune.accelerate * frametime) * wishspeed);
      if (accelspeed > addspeed) accelspeed = addspeed;
      for (let i = 0; i < 3; i++) velocity[i] = F(velocity[i] + F(accelspeed * wishdir[i]));
    }

    if (doclip) stepSlideMove();
    else set(origin, add(origin, scale(velocity, frametime)));
  };

  /** PM_SetDimensions (p_move.cpp:1314-1341). */
  const setDimensions = () => {
    mins[0] = -16;
    mins[1] = -16;
    maxs[0] = 16;
    maxs[1] = 16;
    if (pmType === PmType.Gib) {
      mins[2] = 0;
      maxs[2] = 16;
      viewheight = 8;
      return;
    }
    mins[2] = -24;
    if (pmFlags & PmFlag.Ducked || pmType === PmType.Dead) {
      maxs[2] = 4;
      viewheight = -2;
    } else {
      maxs[2] = 32;
      viewheight = 22;
    }
  };

  /** PM_AboveWater: no floor within 8 units, but water. Uses pm->trace directly. */
  const aboveWater = () => {
    const below = sub(origin, [0, 0, 8]);
    if (rawTrace(origin, mins, maxs, below, MASK_SOLID).fraction < 1) return false;
    return rawTrace(origin, mins, maxs, below, MASK_WATER).fraction < 1;
  };

  /** PM_CheckDuck (p_move.cpp:1355-1410). Returns whether the flags changed. */
  const checkDuck = () => {
    if (pmType === PmType.Gib) return false;
    let changed = false;
    if (pmType === PmType.Dead) {
      if (!(pmFlags & PmFlag.Ducked)) {
        pmFlags |= PmFlag.Ducked;
        changed = true;
      }
    } else if (
      cmdButtons & PlayerButton.Crouch &&
      (onGround || (waterlevel <= WATER_FEET && !aboveWater())) &&
      !(pmFlags & PmFlag.OnLadder) &&
      !tune.n64Physics
    ) {
      if (!(pmFlags & PmFlag.Ducked)) {
        const tr = pmTrace(origin, mins, [maxs[0], maxs[1], 4], origin);
        if (!tr.allsolid) {
          pmFlags |= PmFlag.Ducked;
          changed = true;
        }
      }
    } else if (pmFlags & PmFlag.Ducked) {
      const tr = pmTrace(origin, mins, [maxs[0], maxs[1], 32], origin);
      if (!tr.allsolid) {
        pmFlags &= ~PmFlag.Ducked;
        changed = true;
      }
    }
    if (!changed) return false;
    setDimensions();
    return true;
  };

  /** PM_DeadMove: extra friction on the ground. */
  const deadMove = () => {
    if (!onGround) return;
    const f = F(length(velocity) - 20);
    if (f <= 0) set(velocity, [0, 0, 0]);
    else {
      normalize(velocity);
      set(velocity, scale(velocity, f));
    }
  };

  /** PM_GoodPosition: pm->s.origin is not in a solid. */
  const goodPosition = () => {
    if (pmType === PmType.NoClip) return true;
    return !pmTrace(sOrigin, mins, maxs, sOrigin).allsolid;
  };

  /** PM_SnapPosition: write pml back to pm->s, unsticking if needed. */
  const snapPosition = () => {
    sVelocity = [velocity[0], velocity[1], velocity[2]];
    set(sOrigin, origin);
    if (goodPosition()) return;
    if (fixStuckObject(sOrigin, mins, maxs, pmTraceAuto) === StuckResult.NoGoodPosition) set(sOrigin, previousOrigin);
  };

  /** PM_InitialSnapPosition: try the 26 neighbours a unit away. */
  const initialSnapPosition = () => {
    const offset = [0, -1, 1];
    const base: V = [sOrigin[0], sOrigin[1], sOrigin[2]];
    for (let z = 0; z < 3; z++) {
      sOrigin[2] = F(base[2] + offset[z]);
      for (let y = 0; y < 3; y++) {
        sOrigin[1] = F(base[1] + offset[y]);
        for (let x = 0; x < 3; x++) {
          sOrigin[0] = F(base[0] + offset[x]);
          if (goodPosition()) {
            set(origin, sOrigin);
            set(previousOrigin, sOrigin);
            return;
          }
        }
      }
    }
  };

  /** PM_ClampAngles (p_move.cpp:1417-1437). */
  const clampAngles = () => {
    if (pmFlags & PmFlag.TimeTeleport) {
      viewangles = [0, F(cmdAngles[YAW] + deltaAngles[YAW]), 0];
    } else {
      viewangles = add(cmdAngles, deltaAngles);
      if (viewangles[PITCH] > 89 && viewangles[PITCH] < 180) viewangles[PITCH] = 89;
      else if (viewangles[PITCH] < 271 && viewangles[PITCH] >= 180) viewangles[PITCH] = 271;
    }
    ({ forward, right } = vectors(viewangles));
  };

  const result = (): PmoveState => ({
    ...state,
    pmType,
    pmFlags,
    pmTime,
    origin: toVec(sOrigin),
    velocity: toVec(sVelocity),
    viewAngles: toVec(viewangles),
    viewHeight: viewheight,
    mins: toVec(mins),
    maxs: toVec(maxs),
    waterlevel,
    watertype,
    onGround: onGround,
    groundEntity: onGround ? groundEntity : null,
    groundPlaneNormal: toVec(groundPlaneNormal),
    jumpSound,
    stepClip,
    impactDelta,
    touch,
  });

  // ---- Pmove (p_move.cpp:1568-1708) ----
  clampAngles();

  if (pmType === PmType.Spectator || pmType === PmType.NoClip) {
    pmFlags = 0;
    if (pmType === PmType.Spectator) {
      mins[0] = -8;
      mins[1] = -8;
      maxs[0] = 8;
      maxs[1] = 8;
      mins[2] = -8;
      maxs[2] = 8;
    }
    flyMove(pmType === PmType.Spectator);
    snapPosition();
    return result();
  }

  if (pmType >= PmType.Dead) {
    forwardmove = 0;
    sidemove = 0;
    cmdButtons &= ~(PlayerButton.Jump | PlayerButton.Crouch);
  }

  if (pmType === PmType.Freeze) return result(); // no movement at all

  setDimensions();
  categorizePosition();
  if (state.snapInitial) initialSnapPosition();
  if (checkDuck()) categorizePosition();
  if (pmType === PmType.Dead) deadMove();
  checkSpecialMovement();

  // drop timing counter
  if (pmTime) {
    if (msec >= pmTime) {
      pmFlags &= ~TIME_FLAGS;
      pmTime = 0;
    } else {
      pmTime -= msec;
    }
  }

  if (pmFlags & PmFlag.TimeTeleport) {
    // teleport pause stays exactly in place
  } else if (pmFlags & PmFlag.TimeWaterJump) {
    // waterjump has no control, but falls
    velocity[2] = F(velocity[2] - F(gravity * frametime));
    if (velocity[2] < 0) {
      pmFlags &= ~TIME_FLAGS;
      pmTime = 0;
    }
    stepSlideMove();
  } else {
    checkJump();
    friction();
    if (waterlevel >= WATER_WAIST) {
      waterMove();
    } else {
      const angles: V = [viewangles[0], viewangles[1], viewangles[2]];
      if (angles[PITCH] > 180) angles[PITCH] = F(angles[PITCH] - 360);
      angles[PITCH] = F(angles[PITCH] / 3);
      ({ forward, right } = vectors(angles));
      airMove();
    }
  }

  categorizePosition();

  if (pmFlags & PmFlag.TimeTrick) checkJump();

  snapPosition();
  return result();
}
