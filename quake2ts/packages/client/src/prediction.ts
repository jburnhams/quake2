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
} from '@quake2ts/shared';
import {
  applyPmoveAccelerate,
  applyPmoveAirAccelerate,
  applyPmoveFriction,
} from '@quake2ts/shared';
import type { GameFrameResult } from '@quake2ts/engine';

export interface PredictionState {
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly viewangles: Vec3;
  readonly pmFlags: PmFlags;
  readonly pmType: PmType;
  readonly waterlevel: WaterLevel;
  readonly gravity: number;
  readonly deltaAngles?: Vec3;
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
    viewangles: ZERO_VEC3,
    pmFlags: PmFlag.OnGround,
    pmType: PmType.Normal,
    waterlevel: WaterLevel.None,
    gravity: DEFAULT_GRAVITY,
    deltaAngles: ZERO_VEC3,
  } satisfies PredictionState;
}

function normalizeState(state: PredictionState | undefined): PredictionState {
  if (!state) return defaultPredictionState();

  return {
    ...defaultPredictionState(),
    ...state,
    origin: { ...state.origin },
    velocity: { ...state.velocity },
    viewangles: { ...state.viewangles },
    deltaAngles: state.deltaAngles ? { ...state.deltaAngles } : ZERO_VEC3,
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
    viewangles: {
      x: lerpAngle(previous.viewangles.x, latest.viewangles.x, clamped),
      y: lerpAngle(previous.viewangles.y, latest.viewangles.y, clamped),
      z: lerpAngle(previous.viewangles.z, latest.viewangles.z, clamped),
    },
    pmFlags: latest.pmFlags,
    pmType: latest.pmType,
    waterlevel: latest.waterlevel,
    gravity: latest.gravity,
    deltaAngles: latest.deltaAngles,
  } satisfies PredictionState;
}

function simulateCommand(
  state: PredictionState,
  cmd: UserCommand,
  settings: PredictionSettings,
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
    waterlevel: state.waterlevel,
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
    state.waterlevel > WaterLevel.None
      ? buildWaterWish({ forward, right, cmd, maxSpeed: settings.pmWaterSpeed })
      : buildAirGroundWish({ forward, right, cmd, maxSpeed: settings.pmMaxSpeed });

  if (state.waterlevel > WaterLevel.None) {
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
    velocity = { ...velocity, z: velocity.z - state.gravity * frametime };
  }

  const originDelta = scaleVec3(velocity, frametime);
  const origin = addVec3(state.origin, originDelta);

  return {
    ...state,
    origin,
    velocity,
    viewangles,
  } satisfies PredictionState;
}

export class ClientPrediction {
  private readonly settings: PredictionSettings;
  private baseFrame: GameFrameResult<PredictionState> = {
    frame: 0,
    timeMs: 0,
    state: defaultPredictionState(),
  } satisfies GameFrameResult<PredictionState>;
  private commands: UserCommand[] = [];
  private predicted: PredictionState = defaultPredictionState();

  constructor(settings: Partial<PredictionSettings> = {}) {
    this.settings = { ...DEFAULTS, ...settings } satisfies PredictionSettings;
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
      state = simulateCommand(state, cmd, this.settings);
    }

    this.predicted = state;
    return state;
  }
}
