import {
  addVec3,
  angleMod,
  scaleVec3,
  type Vec3,
  buildAirGroundWish,
  buildWaterWish,
  clampViewAngles,
  hasPmFlag,
  PmFlag,
  PmType,
  WaterLevel,
  type PmFlags,
  type UserCommand,
  PlayerState,
} from '@quake2ts/shared';
import {
  applyPmoveAccelerate,
  applyPmoveAirAccelerate,
  applyPmoveFriction,
} from '@quake2ts/shared';
import type { GameFrameResult } from '@quake2ts/engine';
import type { PlayerClient } from '@quake2ts/game';

import { PmoveTraceFn } from '@quake2ts/shared';

// PredictionState extends PlayerState with fields needed for physics simulation
// that might not be in the base PlayerState interface yet or are client-side specific.
export type PredictionState = PlayerState & {
    deltaAngles?: Vec3;
    pmFlags: PmFlags;
    pmType: PmType;
    gravity?: number;
    waterLevel: WaterLevel;

    // Client-side fields for HUD/rendering, added to satisfy client package usage
    client?: PlayerClient;
    health?: number;
    armor?: number;
    ammo?: number;
}

export interface PredictionSettings {
  readonly pmFriction: number;
  readonly pmStopSpeed: number;
  readonly pmAccelerate: number;
  readonly pmAirAccelerate: number;
  readonly pmWaterAccelerate: number;
  readonly pmWaterFriction: number;
  readonly pmMaxSpeed: number;
  readonly pmDuckSpeed: number;
  readonly pmWaterSpeed: number;
  readonly groundIsSlick: boolean;
}

const DEFAULTS: PredictionSettings = {
  pmFriction: 6,
  pmStopSpeed: 100,
  pmAccelerate: 10,
  pmAirAccelerate: 1,
  pmWaterAccelerate: 4,
  pmWaterFriction: 1,
  pmMaxSpeed: 300,
  pmDuckSpeed: 100,
  pmWaterSpeed: 400,
  groundIsSlick: false,
};

const DEFAULT_GRAVITY = 800;
const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };
const MSEC_MAX = 250;

export function defaultPredictionState(): PredictionState {
  return {
    origin: ZERO_VEC3,
    velocity: ZERO_VEC3,
    viewAngles: ZERO_VEC3,
    onGround: false,

    // Physics fields
    pmFlags: PmFlag.OnGround,
    pmType: PmType.Normal,
    waterLevel: WaterLevel.None,
    gravity: DEFAULT_GRAVITY,
    deltaAngles: ZERO_VEC3,

    // Bounds
    mins: { x: -16, y: -16, z: -24 },
    maxs: { x: 16, y: 16, z: 32 },

    // Visual/Game fields
    damageAlpha: 0,
    damageIndicators: [],
    blend: [0, 0, 0, 0],
    stats: [],
    kick_angles: ZERO_VEC3,
    gunoffset: ZERO_VEC3,
    gunangles: ZERO_VEC3,
    gunindex: 0,

    // Optional fields
    pickupIcon: undefined,
    centerPrint: undefined,
    notify: undefined,
    client: undefined,
    health: 0,
    armor: 0,
    ammo: 0
  };
}

function normalizeState(state: PredictionState | undefined): PredictionState {
  if (!state) return defaultPredictionState();

  return {
    ...defaultPredictionState(),
    ...state,
    origin: { ...state.origin },
    velocity: { ...state.velocity },
    viewAngles: { ...state.viewAngles },
    deltaAngles: state.deltaAngles ? { ...state.deltaAngles } : ZERO_VEC3,
    blend: state.blend ? [...state.blend] : [0, 0, 0, 0],
    damageIndicators: state.damageIndicators ? [...state.damageIndicators] : [],
    stats: state.stats ? [...state.stats] : [],
  } satisfies PredictionState;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let delta = angleMod(b - a);
  if (delta > 180) {
    delta -= 360;
  }
  return angleMod(a + delta * t);
}

export function interpolatePredictionState(
  previous: PredictionState,
  latest: PredictionState,
  alpha: number,
): PredictionState {
  const clamped = Math.max(0, Math.min(alpha, 1));

  return {
    ...latest, // Default to latest for discrete fields
    origin: {
      x: lerp(previous.origin.x, latest.origin.x, clamped),
      y: lerp(previous.origin.y, latest.origin.y, clamped),
      z: lerp(previous.origin.z, latest.origin.z, clamped),
    },
    velocity: {
      x: lerp(previous.velocity.x, latest.velocity.x, clamped),
      y: lerp(previous.velocity.y, latest.velocity.y, clamped),
      z: lerp(previous.velocity.z, latest.velocity.z, clamped),
    },
    viewAngles: {
      x: lerpAngle(previous.viewAngles.x, latest.viewAngles.x, clamped),
      y: lerpAngle(previous.viewAngles.y, latest.viewAngles.y, clamped),
      z: lerpAngle(previous.viewAngles.z, latest.viewAngles.z, clamped),
    },
    damageAlpha: lerp(previous.damageAlpha, latest.damageAlpha, clamped),
    blend: [
        lerp(previous.blend[0], latest.blend[0], clamped),
        lerp(previous.blend[1], latest.blend[1], clamped),
        lerp(previous.blend[2], latest.blend[2], clamped),
        lerp(previous.blend[3], latest.blend[3], clamped),
    ],
    // Interpolate health/armor for smooth HUD? Usually step.
    health: lerp(previous.health || 0, latest.health || 0, clamped),
    armor: lerp(previous.armor || 0, latest.armor || 0, clamped),
    ammo: lerp(previous.ammo || 0, latest.ammo || 0, clamped)
  } satisfies PredictionState;
}

function simulateCommand(
  state: PredictionState,
  cmd: UserCommand,
  settings: PredictionSettings,
  trace: PmoveTraceFn,
): PredictionState {
  const frametime = Math.min(Math.max(cmd.msec, 0), MSEC_MAX) / 1000;

  const onGround = hasPmFlag(state.pmFlags, PmFlag.OnGround);
  const onLadder = hasPmFlag(state.pmFlags, PmFlag.OnLadder);

  let velocity = applyPmoveFriction({
    velocity: state.velocity,
    frametime,
    onGround,
    groundIsSlick: settings.groundIsSlick,
    onLadder,
    waterlevel: state.waterLevel,
    pmFriction: settings.pmFriction,
    pmStopSpeed: settings.pmStopSpeed,
    pmWaterFriction: settings.pmWaterFriction,
  });

  const { viewangles, forward, right } = clampViewAngles({
    pmFlags: state.pmFlags,
    cmdAngles: cmd.angles,
    deltaAngles: state.deltaAngles ?? ZERO_VEC3,
  });

  const wish =
    state.waterLevel > WaterLevel.None
      ? buildWaterWish({ forward, right, cmd, maxSpeed: settings.pmWaterSpeed })
      : buildAirGroundWish({ forward, right, cmd, maxSpeed: settings.pmMaxSpeed });

  if (state.waterLevel > WaterLevel.None) {
    velocity = applyPmoveAccelerate({
      velocity,
      wishdir: wish.wishdir,
      wishspeed: wish.wishspeed,
      accel: settings.pmWaterAccelerate,
      frametime,
    });
  } else if (onGround || onLadder) {
    const maxSpeed = hasPmFlag(state.pmFlags, PmFlag.Ducked) ? settings.pmDuckSpeed : settings.pmMaxSpeed;
    const clampedWish =
      wish.wishspeed > maxSpeed
        ? {
            wishdir: wish.wishdir,
            wishspeed: maxSpeed,
          }
        : wish;

    velocity = applyPmoveAccelerate({
      velocity,
      wishdir: clampedWish.wishdir,
      wishspeed: clampedWish.wishspeed,
      accel: settings.pmAccelerate,
      frametime,
    });
  } else {
    velocity = applyPmoveAirAccelerate({
      velocity,
      wishdir: wish.wishdir,
      wishspeed: wish.wishspeed,
      accel: settings.pmAirAccelerate,
      frametime,
    });
    velocity = { ...velocity, z: velocity.z - (state.gravity ?? DEFAULT_GRAVITY) * frametime };
  }

  const traceResult = trace(state.origin, addVec3(state.origin, scaleVec3(velocity, frametime)));
  const origin = traceResult.endpos;

  return {
    ...state,
    origin,
    velocity,
    viewAngles: viewangles,
  } satisfies PredictionState;
}

export class ClientPrediction {
  private readonly settings: PredictionSettings;
  private readonly trace: PmoveTraceFn;
  private baseFrame: GameFrameResult<PredictionState> = {
    frame: 0,
    timeMs: 0,
    state: defaultPredictionState(),
  } satisfies GameFrameResult<PredictionState>;
  private commands: UserCommand[] = [];
  private predicted: PredictionState = defaultPredictionState();

  constructor(trace: PmoveTraceFn, settings: Partial<PredictionSettings> = {}) {
    this.settings = { ...DEFAULTS, ...settings } satisfies PredictionSettings;
    this.trace = trace;
    this.predicted = this.baseFrame.state ?? defaultPredictionState();
  }

  setAuthoritative(frame: GameFrameResult<PredictionState>): PredictionState {
    const normalized = normalizeState(frame.state);
    this.baseFrame = { ...frame, state: normalized };
    this.commands = this.commands.filter((cmd) => (cmd.serverFrame ?? Number.MAX_SAFE_INTEGER) > frame.frame);
    return this.recompute();
  }

  enqueueCommand(cmd: UserCommand): PredictionState {
    this.commands.push(cmd);
    return this.recompute();
  }

  getPredictedState(): PredictionState {
    return this.predicted;
  }

  private recompute(): PredictionState {
    let state = normalizeState(this.baseFrame.state);

    for (const cmd of this.commands) {
      state = simulateCommand(state, cmd, this.settings, this.trace);
    }

    this.predicted = state;
    return state;
  }
}
