/**
 * qcommon/pmove.c, id's 3.21 player movement, in the C's 32-bit floats.
 *
 * id linked this one file into both the client (prediction) and the server (the game's
 * ClientThink), so the two moved a player identically; the client and server ports here share it
 * for the same reason. The rerelease's p_move.cpp, which ../pmove follows, changed a good deal
 * (sub-unit origins, step smoothing, ladders); this is the 1997 code as it shipped.
 *
 * Every float operation rounds with f (Math.fround), as x86-64's SSE does; a C double literal (0.25,
 * 0.125, 0.001, 0.1, 0.7, 360.0/65536) promotes its expression to double, and those are left
 * unrounded until the store. The oracle (oracle/tests/pmove321.oracle.test.ts) runs this and id's
 * pmove.c on the same traces and compares every field of every frame.
 */
import { angleVectors, crossProduct, dot, f, short2angle, vectorLength, vectorNormalize, type Vec3 } from './qmath.js';

// q_shared.h
export const PM_NORMAL = 0;
export const PM_SPECTATOR = 1;
export const PM_DEAD = 2;
export const PM_GIB = 3;
export const PM_FREEZE = 4;

export const PMF_DUCKED = 1;
export const PMF_JUMP_HELD = 2;
export const PMF_ON_GROUND = 4;
export const PMF_TIME_WATERJUMP = 8;
export const PMF_TIME_LAND = 16;
export const PMF_TIME_TELEPORT = 32;
export const PMF_NO_PREDICTION = 64;

const CONTENTS_SOLID = 1;
const CONTENTS_LAVA = 8;
const CONTENTS_SLIME = 16;
const CONTENTS_WATER = 32;
const MASK_WATER = CONTENTS_WATER | CONTENTS_LAVA | CONTENTS_SLIME;
const CONTENTS_CURRENT_0 = 0x40000;
const CONTENTS_CURRENT_90 = 0x80000;
const CONTENTS_CURRENT_180 = 0x100000;
const CONTENTS_CURRENT_270 = 0x200000;
const CONTENTS_CURRENT_UP = 0x400000;
const CONTENTS_CURRENT_DOWN = 0x800000;
const MASK_CURRENT = CONTENTS_CURRENT_0 | CONTENTS_CURRENT_90 | CONTENTS_CURRENT_180 | CONTENTS_CURRENT_270 | CONTENTS_CURRENT_UP | CONTENTS_CURRENT_DOWN;
const CONTENTS_LADDER = 0x20000000;
const SURF_SLICK = 0x2;

export const MAXTOUCH = 32;
const PITCH = 0;
const YAW = 1;
const ROLL = 2;

/** pmove_state_t: what crosses the wire. Origin and velocity in eighths of a unit (shorts). */
export interface PmoveState {
  pm_type: number;
  origin: [number, number, number];
  velocity: [number, number, number];
  /** byte */
  pm_flags: number;
  /** byte, in 8 ms units */
  pm_time: number;
  gravity: number;
  delta_angles: [number, number, number];
}

/** usercmd_t */
export interface UserCmd {
  msec: number;
  buttons: number;
  angles: [number, number, number];
  forwardmove: number;
  sidemove: number;
  upmove: number;
  impulse: number;
  lightlevel: number;
}

export interface PmSurface {
  readonly flags: number;
  readonly value: number;
}

/** trace_t, with the entity it hit (null only when nothing was hit: the world is an entity). */
export interface PmTrace<E> {
  readonly allsolid: boolean;
  readonly startsolid: boolean;
  readonly fraction: number;
  readonly endpos: readonly number[];
  readonly plane: { readonly normal: readonly number[]; readonly dist: number; readonly type: number; readonly signbits: number };
  readonly surface: PmSurface | null;
  readonly contents: number;
  readonly ent: E | null;
}

/** pmove_t: the state and command in, the results out, and the world through two callbacks. */
export interface Pmove<E> {
  s: PmoveState;
  cmd: UserCmd;
  snapinitial: boolean;
  // results
  numtouch: number;
  touchents: E[];
  viewangles: Vec3;
  viewheight: number;
  mins: Vec3;
  maxs: Vec3;
  groundentity: E | null;
  watertype: number;
  waterlevel: number;
  trace(start: readonly number[], mins: readonly number[], maxs: readonly number[], end: readonly number[]): PmTrace<E>;
  pointcontents(point: readonly number[]): number;
}

/** The movement parameters: pmove.c's globals, which nothing in 3.21 changes. */
export interface PmoveParams {
  stopspeed: number;
  maxspeed: number;
  duckspeed: number;
  accelerate: number;
  airaccelerate: number;
  wateraccelerate: number;
  friction: number;
  waterfriction: number;
  waterspeed: number;
}

export const PMOVE_PARAMS: Readonly<PmoveParams> = {
  stopspeed: 100,
  maxspeed: 300,
  duckspeed: 100,
  accelerate: 10,
  airaccelerate: 0,
  wateraccelerate: 10,
  friction: 6,
  waterfriction: 1,
  waterspeed: 400,
};

/** A pmove_t with zeroed results, for a state and a command. */
export function newPmove<E>(s: PmoveState, cmd: UserCmd, world: Pick<Pmove<E>, 'trace' | 'pointcontents'>, snapinitial = false): Pmove<E> {
  return {
    s,
    cmd,
    snapinitial,
    numtouch: 0,
    touchents: [],
    viewangles: [0, 0, 0],
    viewheight: 0,
    mins: [0, 0, 0],
    maxs: [0, 0, 0],
    groundentity: null,
    watertype: 0,
    waterlevel: 0,
    trace: world.trace,
    pointcontents: world.pointcontents,
  };
}

const STEPSIZE = 18;
const STOP_EPSILON = 0.1;
const MIN_STEP_NORMAL = 0.7;
const MAX_CLIP_PLANES = 5;

/** a value stored to a C short */
const short = (n: number) => (n << 16) >> 16;

/** pml_t: pmove.c's locals, zeroed for every move. */
interface Pml<E> {
  origin: Vec3;
  velocity: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  frametime: number;
  groundsurface: PmSurface | null;
  groundplane: PmTrace<E>['plane'] | null;
  groundcontents: number;
  previous_origin: [number, number, number];
  ladder: boolean;
}

/** PM_ClipVelocity: slide off the impacting surface. */
function clipVelocity(inv: readonly number[], normal: readonly number[], out: number[], overbounce: number): void {
  const backoff = f(dot(inv, normal) * overbounce);
  for (let i = 0; i < 3; i++) {
    const change = f(normal[i] * backoff);
    out[i] = f(inv[i] - change);
    if (out[i] > -STOP_EPSILON && out[i] < STOP_EPSILON) out[i] = 0;
  }
}

/** One Pmove: pmove.c's file-scope state is this object's. */
class Mover<E> {
  readonly pml: Pml<E>;

  constructor(
    readonly pm: Pmove<E>,
    readonly p: PmoveParams,
  ) {
    this.pml = {
      origin: [0, 0, 0],
      velocity: [0, 0, 0],
      forward: [0, 0, 0],
      right: [0, 0, 0],
      up: [0, 0, 0],
      frametime: 0,
      groundsurface: null,
      groundplane: null,
      groundcontents: 0,
      previous_origin: [0, 0, 0],
      ladder: false,
    };
  }

  private touch(ent: E | null): void {
    const pm = this.pm;
    if (pm.numtouch < MAXTOUCH && ent) {
      pm.touchents[pm.numtouch] = ent;
      pm.numtouch++;
    }
  }

  /** PM_StepSlideMove_ */
  private stepSlideMove_(): void {
    const { pm, pml } = this;
    const numbumps = 4;
    const primal_velocity: Vec3 = [...pml.velocity];
    let numplanes = 0;
    const planes: Vec3[] = [];
    let time_left = pml.frametime;
    const end: Vec3 = [0, 0, 0];

    for (let bumpcount = 0; bumpcount < numbumps; bumpcount++) {
      for (let i = 0; i < 3; i++) end[i] = f(pml.origin[i] + f(time_left * pml.velocity[i]));

      const trace = pm.trace(pml.origin, pm.mins, pm.maxs, end);

      if (trace.allsolid) {
        // entity is trapped in another solid
        pml.velocity[2] = 0; // don't build up falling damage
        return;
      }

      if (trace.fraction > 0) {
        // actually covered some distance
        pml.origin = [trace.endpos[0], trace.endpos[1], trace.endpos[2]];
        numplanes = 0;
      }

      if (trace.fraction === 1) break; // moved the entire distance

      // save entity for contact
      this.touch(trace.ent);

      time_left = f(time_left - f(time_left * trace.fraction));

      // slide along this plane
      if (numplanes >= MAX_CLIP_PLANES) {
        // this shouldn't really happen
        pml.velocity = [0, 0, 0];
        break;
      }

      planes[numplanes] = [trace.plane.normal[0], trace.plane.normal[1], trace.plane.normal[2]];
      numplanes++;

      // modify original_velocity so it parallels all of the clip planes
      let i: number;
      for (i = 0; i < numplanes; i++) {
        clipVelocity(pml.velocity, planes[i], pml.velocity, f(1.01));
        let j: number;
        for (j = 0; j < numplanes; j++)
          if (j !== i) {
            if (dot(pml.velocity, planes[j]) < 0) break; // not ok
          }
        if (j === numplanes) break;
      }

      if (i !== numplanes) {
        // go along this plane
      } else {
        // go along the crease
        if (numplanes !== 2) {
          pml.velocity = [0, 0, 0];
          break;
        }
        const dir = crossProduct(planes[0], planes[1]);
        const d = dot(dir, pml.velocity);
        pml.velocity = [f(dir[0] * d), f(dir[1] * d), f(dir[2] * d)];
      }

      // if velocity is against the original velocity, stop dead
      // to avoid tiny occilations in sloping corners
      if (dot(pml.velocity, primal_velocity) <= 0) {
        pml.velocity = [0, 0, 0];
        break;
      }
    }

    if (pm.s.pm_time) pml.velocity = [...primal_velocity];
  }

  /** PM_StepSlideMove */
  private stepSlideMove(): void {
    const { pm, pml } = this;
    const start_o: Vec3 = [...pml.origin];
    const start_v: Vec3 = [...pml.velocity];

    this.stepSlideMove_();

    const down_o: Vec3 = [...pml.origin];
    const down_v: Vec3 = [...pml.velocity];

    let up: Vec3 = [...start_o];
    up[2] = f(up[2] + STEPSIZE);

    let trace = pm.trace(up, pm.mins, pm.maxs, up);
    if (trace.allsolid) return; // can't step up

    // try sliding above
    pml.origin = [...up];
    pml.velocity = [...start_v];

    this.stepSlideMove_();

    // push down the final amount
    const down: Vec3 = [...pml.origin];
    down[2] = f(down[2] - STEPSIZE);
    trace = pm.trace(pml.origin, pm.mins, pm.maxs, down);
    if (!trace.allsolid) pml.origin = [trace.endpos[0], trace.endpos[1], trace.endpos[2]];

    up = [...pml.origin];

    // decide which one went farther
    const sq = (a: number, b: number) => f(f(a - b) * f(a - b));
    const down_dist = f(sq(down_o[0], start_o[0]) + sq(down_o[1], start_o[1]));
    const up_dist = f(sq(up[0], start_o[0]) + sq(up[1], start_o[1]));

    if (down_dist > up_dist || trace.plane.normal[2] < MIN_STEP_NORMAL) {
      pml.origin = down_o;
      pml.velocity = down_v;
      return;
    }
    //!! Special case
    // if we were walking along a plane, then we need to copy the Z over
    pml.velocity[2] = down_v[2];
  }

  /** PM_Friction: both ground friction and water friction. */
  private friction(): void {
    const { pm, pml, p } = this;
    const vel = pml.velocity;

    const speed = f(Math.sqrt(f(f(f(vel[0] * vel[0]) + f(vel[1] * vel[1])) + f(vel[2] * vel[2]))));
    if (speed < 1) {
      vel[0] = 0;
      vel[1] = 0;
      return;
    }

    let drop = 0;

    // apply ground friction
    if ((pm.groundentity && pml.groundsurface && !(pml.groundsurface.flags & SURF_SLICK)) || pml.ladder) {
      const friction = f(p.friction);
      const control = speed < p.stopspeed ? f(p.stopspeed) : speed;
      drop = f(drop + f(f(control * friction) * pml.frametime));
    }

    // apply water friction
    if (pm.waterlevel && !pml.ladder) drop = f(drop + f(f(f(speed * f(p.waterfriction)) * pm.waterlevel) * pml.frametime));

    // scale the velocity
    let newspeed = f(speed - drop);
    if (newspeed < 0) newspeed = 0;
    newspeed = f(newspeed / speed);

    vel[0] = f(vel[0] * newspeed);
    vel[1] = f(vel[1] * newspeed);
    vel[2] = f(vel[2] * newspeed);
  }

  /** PM_Accelerate */
  private accelerate(wishdir: readonly number[], wishspeed: number, accel: number): void {
    const pml = this.pml;
    const currentspeed = dot(pml.velocity, wishdir);
    const addspeed = f(wishspeed - currentspeed);
    if (addspeed <= 0) return;
    let accelspeed = f(f(accel * pml.frametime) * wishspeed);
    if (accelspeed > addspeed) accelspeed = addspeed;

    for (let i = 0; i < 3; i++) pml.velocity[i] = f(pml.velocity[i] + f(accelspeed * wishdir[i]));
  }

  /** PM_AirAccelerate */
  private airAccelerate(wishdir: readonly number[], wishspeed: number, accel: number): void {
    const pml = this.pml;
    let wishspd = wishspeed;
    if (wishspd > 30) wishspd = 30;
    const currentspeed = dot(pml.velocity, wishdir);
    const addspeed = f(wishspd - currentspeed);
    if (addspeed <= 0) return;
    let accelspeed = f(f(accel * wishspeed) * pml.frametime);
    if (accelspeed > addspeed) accelspeed = addspeed;

    for (let i = 0; i < 3; i++) pml.velocity[i] = f(pml.velocity[i] + f(accelspeed * wishdir[i]));
  }

  /** PM_AddCurrents */
  private addCurrents(wishvel: number[]): void {
    const { pm, pml, p } = this;

    // account for ladders
    if (pml.ladder && Math.abs(pml.velocity[2]) <= 200) {
      if (pm.viewangles[PITCH] <= -15 && pm.cmd.forwardmove > 0) wishvel[2] = 200;
      else if (pm.viewangles[PITCH] >= 15 && pm.cmd.forwardmove > 0) wishvel[2] = -200;
      else if (pm.cmd.upmove > 0) wishvel[2] = 200;
      else if (pm.cmd.upmove < 0) wishvel[2] = -200;
      else wishvel[2] = 0;

      // limit horizontal speed when on a ladder
      if (wishvel[0] < -25) wishvel[0] = -25;
      else if (wishvel[0] > 25) wishvel[0] = 25;

      if (wishvel[1] < -25) wishvel[1] = -25;
      else if (wishvel[1] > 25) wishvel[1] = 25;
    }

    // add water currents
    if (pm.watertype & MASK_CURRENT) {
      const v = [0, 0, 0];
      if (pm.watertype & CONTENTS_CURRENT_0) v[0] += 1;
      if (pm.watertype & CONTENTS_CURRENT_90) v[1] += 1;
      if (pm.watertype & CONTENTS_CURRENT_180) v[0] -= 1;
      if (pm.watertype & CONTENTS_CURRENT_270) v[1] -= 1;
      if (pm.watertype & CONTENTS_CURRENT_UP) v[2] += 1;
      if (pm.watertype & CONTENTS_CURRENT_DOWN) v[2] -= 1;

      let s = f(p.waterspeed);
      if (pm.waterlevel === 1 && pm.groundentity) s = f(s / 2);

      for (let i = 0; i < 3; i++) wishvel[i] = f(wishvel[i] + f(s * v[i]));
    }

    // add conveyor belt velocities
    if (pm.groundentity) {
      const v = [0, 0, 0];
      const gc = pml.groundcontents;
      if (gc & CONTENTS_CURRENT_0) v[0] += 1;
      if (gc & CONTENTS_CURRENT_90) v[1] += 1;
      if (gc & CONTENTS_CURRENT_180) v[0] -= 1;
      if (gc & CONTENTS_CURRENT_270) v[1] -= 1;
      if (gc & CONTENTS_CURRENT_UP) v[2] += 1;
      if (gc & CONTENTS_CURRENT_DOWN) v[2] -= 1;

      for (let i = 0; i < 3; i++) wishvel[i] = f(wishvel[i] + f(100 * v[i])); // pm->groundentity->speed
    }
  }

  /** PM_WaterMove */
  private waterMove(): void {
    const { pm, pml, p } = this;
    let wishvel: Vec3 = [0, 0, 0];

    // user intentions
    for (let i = 0; i < 3; i++) wishvel[i] = f(f(pml.forward[i] * pm.cmd.forwardmove) + f(pml.right[i] * pm.cmd.sidemove));

    if (!pm.cmd.forwardmove && !pm.cmd.sidemove && !pm.cmd.upmove) wishvel[2] = f(wishvel[2] - 60); // drift towards bottom
    else wishvel[2] = f(wishvel[2] + pm.cmd.upmove);

    this.addCurrents(wishvel);

    const wishdir: Vec3 = [...wishvel];
    let wishspeed = vectorNormalize(wishdir);

    if (wishspeed > p.maxspeed) {
      const scale = f(f(p.maxspeed) / wishspeed);
      wishvel = [f(wishvel[0] * scale), f(wishvel[1] * scale), f(wishvel[2] * scale)];
      wishspeed = f(p.maxspeed);
    }
    wishspeed = f(wishspeed * 0.5);

    this.accelerate(wishdir, wishspeed, f(p.wateraccelerate));

    this.stepSlideMove();
  }

  /** PM_AirMove */
  private airMove(): void {
    const { pm, pml, p } = this;
    const fmove = pm.cmd.forwardmove;
    const smove = pm.cmd.sidemove;
    let wishvel: Vec3 = [0, 0, 0];

    for (let i = 0; i < 2; i++) wishvel[i] = f(f(pml.forward[i] * fmove) + f(pml.right[i] * smove));
    wishvel[2] = 0;

    this.addCurrents(wishvel);

    const wishdir: Vec3 = [...wishvel];
    let wishspeed = vectorNormalize(wishdir);

    // clamp to server defined max speed
    const maxspeed = f(pm.s.pm_flags & PMF_DUCKED ? p.duckspeed : p.maxspeed);

    if (wishspeed > maxspeed) {
      const scale = f(maxspeed / wishspeed);
      wishvel = [f(wishvel[0] * scale), f(wishvel[1] * scale), f(wishvel[2] * scale)];
      wishspeed = maxspeed;
    }

    if (pml.ladder) {
      this.accelerate(wishdir, wishspeed, f(p.accelerate));
      if (!wishvel[2]) {
        if (pml.velocity[2] > 0) {
          pml.velocity[2] = f(pml.velocity[2] - f(pm.s.gravity * pml.frametime));
          if (pml.velocity[2] < 0) pml.velocity[2] = 0;
        } else {
          pml.velocity[2] = f(pml.velocity[2] + f(pm.s.gravity * pml.frametime));
          if (pml.velocity[2] > 0) pml.velocity[2] = 0;
        }
      }
      this.stepSlideMove();
    } else if (pm.groundentity) {
      // walking on ground
      pml.velocity[2] = 0; //!!! this is before the accel
      this.accelerate(wishdir, wishspeed, f(p.accelerate));

      // PGM	-- fix for negative trigger_gravity fields
      if (pm.s.gravity > 0) pml.velocity[2] = 0;
      else pml.velocity[2] = f(pml.velocity[2] - f(pm.s.gravity * pml.frametime));

      if (!pml.velocity[0] && !pml.velocity[1]) return;
      this.stepSlideMove();
    } else {
      // not on ground, so little effect on velocity
      if (p.airaccelerate) this.airAccelerate(wishdir, wishspeed, f(p.accelerate));
      else this.accelerate(wishdir, wishspeed, 1);
      // add gravity
      pml.velocity[2] = f(pml.velocity[2] - f(pm.s.gravity * pml.frametime));
      this.stepSlideMove();
    }
  }

  /** PM_CatagorizePosition: groundentity, watertype and waterlevel. */
  private categorizePosition(): void {
    const { pm, pml } = this;

    // see if standing on something solid
    const point: Vec3 = [pml.origin[0], pml.origin[1], f(pml.origin[2] - 0.25)];
    if (pml.velocity[2] > 180) {
      //!!ZOID changed from 100 to 180 (ramp accel)
      pm.s.pm_flags &= ~PMF_ON_GROUND & 0xff;
      pm.groundentity = null;
    } else {
      const trace = pm.trace(pml.origin, pm.mins, pm.maxs, point);
      pml.groundplane = trace.plane;
      pml.groundsurface = trace.surface;
      pml.groundcontents = trace.contents;

      if (!trace.ent || (trace.plane.normal[2] < 0.7 && !trace.startsolid)) {
        pm.groundentity = null;
        pm.s.pm_flags &= ~PMF_ON_GROUND & 0xff;
      } else {
        pm.groundentity = trace.ent;

        // hitting solid ground will end a waterjump
        if (pm.s.pm_flags & PMF_TIME_WATERJUMP) {
          pm.s.pm_flags &= ~(PMF_TIME_WATERJUMP | PMF_TIME_LAND | PMF_TIME_TELEPORT) & 0xff;
          pm.s.pm_time = 0;
        }

        if (!(pm.s.pm_flags & PMF_ON_GROUND)) {
          // just hit the ground
          pm.s.pm_flags |= PMF_ON_GROUND;
          // don't do landing time if we were just going down a slope
          if (pml.velocity[2] < -200) {
            pm.s.pm_flags |= PMF_TIME_LAND;
            // don't allow another jump for a little while
            if (pml.velocity[2] < -400) pm.s.pm_time = 25;
            else pm.s.pm_time = 18;
          }
        }
      }

      this.touch(trace.ent);
    }

    // get waterlevel, accounting for ducking
    pm.waterlevel = 0;
    pm.watertype = 0;

    const sample2 = Math.trunc(f(pm.viewheight - pm.mins[2]));
    const sample1 = Math.trunc(sample2 / 2);

    point[2] = f(f(pml.origin[2] + pm.mins[2]) + 1);
    let cont = pm.pointcontents(point);

    if (cont & MASK_WATER) {
      pm.watertype = cont;
      pm.waterlevel = 1;
      point[2] = f(f(pml.origin[2] + pm.mins[2]) + sample1);
      cont = pm.pointcontents(point);
      if (cont & MASK_WATER) {
        pm.waterlevel = 2;
        point[2] = f(f(pml.origin[2] + pm.mins[2]) + sample2);
        cont = pm.pointcontents(point);
        if (cont & MASK_WATER) pm.waterlevel = 3;
      }
    }
  }

  /** PM_CheckJump */
  private checkJump(): void {
    const { pm, pml } = this;
    if (pm.s.pm_flags & PMF_TIME_LAND) return; // hasn't been long enough since landing to jump again

    if (pm.cmd.upmove < 10) {
      // not holding jump
      pm.s.pm_flags &= ~PMF_JUMP_HELD & 0xff;
      return;
    }

    // must wait for jump to be released
    if (pm.s.pm_flags & PMF_JUMP_HELD) return;

    if (pm.s.pm_type === PM_DEAD) return;

    if (pm.waterlevel >= 2) {
      // swimming, not jumping
      pm.groundentity = null;

      if (pml.velocity[2] <= -300) return;

      if (pm.watertype === CONTENTS_WATER) pml.velocity[2] = 100;
      else if (pm.watertype === CONTENTS_SLIME) pml.velocity[2] = 80;
      else pml.velocity[2] = 50;
      return;
    }

    if (pm.groundentity === null) return; // in air, so no effect

    pm.s.pm_flags |= PMF_JUMP_HELD;

    pm.groundentity = null;
    pml.velocity[2] = f(pml.velocity[2] + 270);
    if (pml.velocity[2] < 270) pml.velocity[2] = 270;
  }

  /** PM_CheckSpecialMovement: ladders and jumping out of water. */
  private checkSpecialMovement(): void {
    const { pm, pml } = this;
    if (pm.s.pm_time) return;

    pml.ladder = false;

    // check for ladder
    const flatforward: Vec3 = [pml.forward[0], pml.forward[1], 0];
    vectorNormalize(flatforward);

    let spot: Vec3 = [f(pml.origin[0] + flatforward[0]), f(pml.origin[1] + flatforward[1]), f(pml.origin[2] + flatforward[2])];
    const trace = pm.trace(pml.origin, pm.mins, pm.maxs, spot);
    if (trace.fraction < 1 && trace.contents & CONTENTS_LADDER) pml.ladder = true;

    // check for water jump
    if (pm.waterlevel !== 2) return;

    spot = [f(pml.origin[0] + f(30 * flatforward[0])), f(pml.origin[1] + f(30 * flatforward[1])), f(pml.origin[2] + f(30 * flatforward[2]))];
    spot[2] = f(spot[2] + 4);
    let cont = pm.pointcontents(spot);
    if (!(cont & CONTENTS_SOLID)) return;

    spot[2] = f(spot[2] + 16);
    cont = pm.pointcontents(spot);
    if (cont) return;
    // jump out of water
    pml.velocity = [f(flatforward[0] * 50), f(flatforward[1] * 50), f(flatforward[2] * 50)];
    pml.velocity[2] = 350;

    pm.s.pm_flags |= PMF_TIME_WATERJUMP;
    pm.s.pm_time = 255;
  }

  /** PM_FlyMove: the spectator's move. */
  private flyMove(doclip: boolean): void {
    const { pm, pml, p } = this;
    pm.viewheight = 22;

    // friction
    const speed = vectorLength(pml.velocity);
    if (speed < 1) {
      pml.velocity = [0, 0, 0];
    } else {
      let drop = 0;
      const friction = f(p.friction * 1.5); // extra friction
      const control = speed < p.stopspeed ? f(p.stopspeed) : speed;
      drop = f(drop + f(f(control * friction) * pml.frametime));

      // scale the velocity
      let newspeed = f(speed - drop);
      if (newspeed < 0) newspeed = 0;
      newspeed = f(newspeed / speed);

      pml.velocity = [f(pml.velocity[0] * newspeed), f(pml.velocity[1] * newspeed), f(pml.velocity[2] * newspeed)];
    }

    // accelerate
    const fmove = pm.cmd.forwardmove;
    const smove = pm.cmd.sidemove;

    vectorNormalize(pml.forward);
    vectorNormalize(pml.right);

    let wishvel: Vec3 = [0, 0, 0];
    for (let i = 0; i < 3; i++) wishvel[i] = f(f(pml.forward[i] * fmove) + f(pml.right[i] * smove));
    wishvel[2] = f(wishvel[2] + pm.cmd.upmove);

    const wishdir: Vec3 = [...wishvel];
    let wishspeed = vectorNormalize(wishdir);

    // clamp to server defined max speed
    if (wishspeed > p.maxspeed) {
      const scale = f(f(p.maxspeed) / wishspeed);
      wishvel = [f(wishvel[0] * scale), f(wishvel[1] * scale), f(wishvel[2] * scale)];
      wishspeed = f(p.maxspeed);
    }

    const currentspeed = dot(pml.velocity, wishdir);
    const addspeed = f(wishspeed - currentspeed);
    if (addspeed <= 0) return;
    let accelspeed = f(f(f(p.accelerate) * pml.frametime) * wishspeed);
    if (accelspeed > addspeed) accelspeed = addspeed;

    for (let i = 0; i < 3; i++) pml.velocity[i] = f(pml.velocity[i] + f(accelspeed * wishdir[i]));

    if (doclip) {
      const end: Vec3 = [0, 0, 0];
      for (let i = 0; i < 3; i++) end[i] = f(pml.origin[i] + f(pml.frametime * pml.velocity[i]));
      const trace = pm.trace(pml.origin, pm.mins, pm.maxs, end);
      pml.origin = [trace.endpos[0], trace.endpos[1], trace.endpos[2]];
    } else {
      // move
      for (let i = 0; i < 3; i++) pml.origin[i] = f(pml.origin[i] + f(pml.frametime * pml.velocity[i]));
    }
  }

  /** PM_CheckDuck: sets mins, maxs and viewheight. */
  private checkDuck(): void {
    const { pm, pml } = this;
    pm.mins[0] = -16;
    pm.mins[1] = -16;
    pm.maxs[0] = 16;
    pm.maxs[1] = 16;

    if (pm.s.pm_type === PM_GIB) {
      pm.mins[2] = 0;
      pm.maxs[2] = 16;
      pm.viewheight = 8;
      return;
    }

    pm.mins[2] = -24;

    if (pm.s.pm_type === PM_DEAD) {
      pm.s.pm_flags |= PMF_DUCKED;
    } else if (pm.cmd.upmove < 0 && pm.s.pm_flags & PMF_ON_GROUND) {
      // duck
      pm.s.pm_flags |= PMF_DUCKED;
    } else {
      // stand up if possible
      if (pm.s.pm_flags & PMF_DUCKED) {
        // try to stand up
        pm.maxs[2] = 32;
        const trace = pm.trace(pml.origin, pm.mins, pm.maxs, pml.origin);
        if (!trace.allsolid) pm.s.pm_flags &= ~PMF_DUCKED & 0xff;
      }
    }

    if (pm.s.pm_flags & PMF_DUCKED) {
      pm.maxs[2] = 4;
      pm.viewheight = -2;
    } else {
      pm.maxs[2] = 32;
      pm.viewheight = 22;
    }
  }

  /** PM_DeadMove */
  private deadMove(): void {
    const { pm, pml } = this;
    if (!pm.groundentity) return;

    // extra friction
    let forward = vectorLength(pml.velocity);
    forward = f(forward - 20);
    if (forward <= 0) {
      pml.velocity = [0, 0, 0];
    } else {
      vectorNormalize(pml.velocity);
      pml.velocity = [f(pml.velocity[0] * forward), f(pml.velocity[1] * forward), f(pml.velocity[2] * forward)];
    }
  }

  /** PM_GoodPosition */
  private goodPosition(): boolean {
    const pm = this.pm;
    if (pm.s.pm_type === PM_SPECTATOR) return true;

    const origin: Vec3 = [f(pm.s.origin[0] * 0.125), f(pm.s.origin[1] * 0.125), f(pm.s.origin[2] * 0.125)];
    const trace = pm.trace(origin, pm.mins, pm.maxs, origin);
    return !trace.allsolid;
  }

  /** PM_SnapPosition: quantize to the network's eighths, in a valid position. */
  private snapPosition(): void {
    const { pm, pml } = this;
    const sign = [0, 0, 0];
    // try all single bits first
    const jitterbits = [0, 4, 1, 2, 3, 5, 6, 7];

    // snap velocity to eigths
    for (let i = 0; i < 3; i++) pm.s.velocity[i] = short(Math.trunc(f(pml.velocity[i] * 8)));

    for (let i = 0; i < 3; i++) {
      if (pml.origin[i] >= 0) sign[i] = 1;
      else sign[i] = -1;
      pm.s.origin[i] = short(Math.trunc(f(pml.origin[i] * 8)));
      if (pm.s.origin[i] * 0.125 === pml.origin[i]) sign[i] = 0;
    }
    const base: [number, number, number] = [...pm.s.origin];

    // try all combinations
    for (let j = 0; j < 8; j++) {
      const bits = jitterbits[j];
      pm.s.origin = [...base];
      for (let i = 0; i < 3; i++) if (bits & (1 << i)) pm.s.origin[i] = short(pm.s.origin[i] + sign[i]);

      if (this.goodPosition()) return;
    }

    // go back to the last position
    pm.s.origin = [...pml.previous_origin];
  }

  /** PM_InitialSnapPosition */
  private initialSnapPosition(): void {
    const { pm, pml } = this;
    const offset = [0, -1, 1];
    const base = [...pm.s.origin];

    for (let z = 0; z < 3; z++) {
      pm.s.origin[2] = short(base[2] + offset[z]);
      for (let y = 0; y < 3; y++) {
        pm.s.origin[1] = short(base[1] + offset[y]);
        for (let x = 0; x < 3; x++) {
          pm.s.origin[0] = short(base[0] + offset[x]);
          if (this.goodPosition()) {
            pml.origin = [f(pm.s.origin[0] * 0.125), f(pm.s.origin[1] * 0.125), f(pm.s.origin[2] * 0.125)];
            pml.previous_origin = [...pm.s.origin];
            return;
          }
        }
      }
    }
  }

  /** PM_ClampAngles */
  private clampAngles(): void {
    const { pm, pml } = this;
    if (pm.s.pm_flags & PMF_TIME_TELEPORT) {
      pm.viewangles[YAW] = short2angle(pm.cmd.angles[YAW] + pm.s.delta_angles[YAW]);
      pm.viewangles[PITCH] = 0;
      pm.viewangles[ROLL] = 0;
    } else {
      // circularly clamp the angles with deltas
      for (let i = 0; i < 3; i++) {
        const temp = short(pm.cmd.angles[i] + pm.s.delta_angles[i]);
        pm.viewangles[i] = short2angle(temp);
      }

      // don't let the player look up or down more than 90 degrees
      if (pm.viewangles[PITCH] > 89 && pm.viewangles[PITCH] < 180) pm.viewangles[PITCH] = 89;
      else if (pm.viewangles[PITCH] < 271 && pm.viewangles[PITCH] >= 180) pm.viewangles[PITCH] = 271;
    }
    const { forward, right, up } = angleVectors(pm.viewangles);
    pml.forward = forward;
    pml.right = right;
    pml.up = up;
  }

  /** Pmove */
  run(): void {
    const { pm, pml } = this;

    // clear results
    pm.numtouch = 0;
    pm.viewangles = [0, 0, 0];
    pm.viewheight = 0;
    pm.groundentity = null;
    pm.watertype = 0;
    pm.waterlevel = 0;

    // convert origin and velocity to float values
    pml.origin = [f(pm.s.origin[0] * 0.125), f(pm.s.origin[1] * 0.125), f(pm.s.origin[2] * 0.125)];
    pml.velocity = [f(pm.s.velocity[0] * 0.125), f(pm.s.velocity[1] * 0.125), f(pm.s.velocity[2] * 0.125)];

    // save old org in case we get stuck
    pml.previous_origin = [...pm.s.origin];

    pml.frametime = f(pm.cmd.msec * 0.001);

    this.clampAngles();

    if (pm.s.pm_type === PM_SPECTATOR) {
      this.flyMove(false);
      this.snapPosition();
      return;
    }

    if (pm.s.pm_type >= PM_DEAD) {
      pm.cmd.forwardmove = 0;
      pm.cmd.sidemove = 0;
      pm.cmd.upmove = 0;
    }

    if (pm.s.pm_type === PM_FREEZE) return; // no movement at all

    // set mins, maxs, and viewheight
    this.checkDuck();

    if (pm.snapinitial) this.initialSnapPosition();

    // set groundentity, watertype, and waterlevel
    this.categorizePosition();

    if (pm.s.pm_type === PM_DEAD) this.deadMove();

    this.checkSpecialMovement();

    // drop timing counter
    if (pm.s.pm_time) {
      let msec = pm.cmd.msec >> 3;
      if (!msec) msec = 1;
      if (msec >= pm.s.pm_time) {
        pm.s.pm_flags &= ~(PMF_TIME_WATERJUMP | PMF_TIME_LAND | PMF_TIME_TELEPORT) & 0xff;
        pm.s.pm_time = 0;
      } else pm.s.pm_time -= msec;
    }

    if (pm.s.pm_flags & PMF_TIME_TELEPORT) {
      // teleport pause stays exactly in place
    } else if (pm.s.pm_flags & PMF_TIME_WATERJUMP) {
      // waterjump has no control, but falls
      pml.velocity[2] = f(pml.velocity[2] - f(pm.s.gravity * pml.frametime));
      if (pml.velocity[2] < 0) {
        // cancel as soon as we are falling down again
        pm.s.pm_flags &= ~(PMF_TIME_WATERJUMP | PMF_TIME_LAND | PMF_TIME_TELEPORT) & 0xff;
        pm.s.pm_time = 0;
      }

      this.stepSlideMove();
    } else {
      this.checkJump();

      this.friction();

      if (pm.waterlevel >= 2) this.waterMove();
      else {
        const angles: Vec3 = [...pm.viewangles];
        if (angles[PITCH] > 180) angles[PITCH] = f(angles[PITCH] - 360);
        angles[PITCH] = f(angles[PITCH] / 3);

        const { forward, right, up } = angleVectors(angles);
        pml.forward = forward;
        pml.right = right;
        pml.up = up;

        this.airMove();
      }
    }

    // set groundentity, watertype, and waterlevel for final spot
    this.categorizePosition();

    this.snapPosition();
  }
}

/** Pmove: one player move. Fills pm's results and updates pm.s, as id's does. */
export function pmove<E>(pm: Pmove<E>, params: PmoveParams = PMOVE_PARAMS): void {
  new Mover(pm, params).run();
}
