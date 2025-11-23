import { ZERO_VEC3, angleVectors, clampViewAngles, dotVec3, hasPmFlag, PmFlag, type PmFlags, type Vec3 } from '@quake2ts/shared';
import type { PredictionState } from './prediction.js';

export interface ViewEffectSettings {
  readonly runPitch: number;
  readonly runRoll: number;
  readonly bobUp: number;
  readonly bobPitch: number;
  readonly bobRoll: number;
  readonly maxBobHeight: number;
  readonly maxBobAngle: number;
}

const DEFAULT_SETTINGS: ViewEffectSettings = {
  runPitch: 0.002,
  runRoll: 0.01, // Changed from 0.005 to match Quake 2 slope (2.0 / 200.0)
  bobUp: 0.005,
  bobPitch: 0.002,
  bobRoll: 0.002,
  maxBobHeight: 6,
  maxBobAngle: 1.2,
};

export interface ViewKick {
  readonly pitch: number;
  readonly roll: number;
  readonly durationMs: number;
}

export interface ActiveKick extends ViewKick {
  remainingMs: number;
}

export interface ViewSample {
  readonly angles: Vec3;
  readonly offset: Vec3;
  readonly bobCycle: number;
  readonly bobCycleRun: number;
  readonly bobFracSin: number;
  readonly xyspeed: number;
}

function clampViewOffset(offset: Vec3): Vec3 {
  return {
    x: Math.max(-14, Math.min(14, offset.x)),
    y: Math.max(-14, Math.min(14, offset.y)),
    z: Math.max(-22, Math.min(30, offset.z)),
  };
}

function computeBobMove(xyspeed: number, onGround: boolean, frameTimeMs: number): number {
  if (!onGround) return 0;

  if (xyspeed > 210) return frameTimeMs / 400;
  if (xyspeed > 100) return frameTimeMs / 800;
  return frameTimeMs / 1600;
}

function computeBobValues(
  previousBobTime: number,
  xyspeed: number,
  pmFlags: PmFlags,
  onGround: boolean,
  frameTimeMs: number,
): { bobTime: number; bobCycle: number; bobCycleRun: number; bobFracSin: number } {
  if (xyspeed < 5) {
    return { bobTime: 0, bobCycle: 0, bobCycleRun: 0, bobFracSin: 0 };
  }

  const bobMove = computeBobMove(xyspeed, onGround, frameTimeMs);
  const bobTimeRun = previousBobTime + bobMove;
  const crouched = hasPmFlag(pmFlags, PmFlag.Ducked) && onGround;
  const bobTime = crouched ? bobTimeRun * 4 : bobTimeRun;

  return {
    bobTime: bobTimeRun,
    bobCycle: Math.floor(bobTime),
    bobCycleRun: Math.floor(bobTimeRun),
    bobFracSin: Math.abs(Math.sin(bobTime * Math.PI)),
  };
}

export class ViewEffects {
  private readonly settings: ViewEffectSettings;
  private bobTime = 0;
  private bobCycle = 0;
  private bobCycleRun = 0;
  private bobFracSin = 0;
  private kick: ActiveKick | undefined;
  private lastSample: ViewSample | undefined;

  constructor(settings: Partial<ViewEffectSettings> = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings } satisfies ViewEffectSettings;
  }

  addKick(kick: ViewKick): void {
    if (kick.durationMs <= 0) return;
    this.kick = { ...kick, remainingMs: kick.durationMs } satisfies ActiveKick;
  }

  get last(): ViewSample | undefined {
    return this.lastSample;
  }

  sample(state: PredictionState, frameTimeMs: number): ViewSample {
    const { forward, right } = angleVectors(
      clampViewAngles({ pmFlags: state.pmFlags, cmdAngles: state.viewangles, deltaAngles: state.deltaAngles ?? ZERO_VEC3 }).viewangles,
    );

    const xyspeed = Math.sqrt(state.velocity.x * state.velocity.x + state.velocity.y * state.velocity.y);
    const onGround = hasPmFlag(state.pmFlags, PmFlag.OnGround);

    const bobValues = computeBobValues(this.bobTime, xyspeed, state.pmFlags, onGround, frameTimeMs);
    this.bobTime = bobValues.bobTime;
    this.bobCycle = bobValues.bobCycle;
    this.bobCycleRun = bobValues.bobCycleRun;
    this.bobFracSin = bobValues.bobFracSin;

    // Velocity-based tilt
    // V_CalcPitch: forward = dot(velocity, forward); pitch = forward * cl_pitchspeed->value;
    let pitchTilt = dotVec3(state.velocity, forward) * this.settings.runPitch;

    // V_CalcRoll: side = dot(velocity, right); sign = side < 0 ? -1 : 1; side = abs(side);
    // if (side < cl_rollspeed->value) side = side * cl_rollangle->value / cl_rollspeed->value;
    // else side = cl_rollangle->value;
    // return side * sign;

    // We approximate this. Quake 2 cl_rollspeed is 200, cl_rollangle is 2.0.
    // Ratio is 2/200 = 0.01.
    // Max roll is 2.0.

    const side = dotVec3(state.velocity, right);
    const sign = side < 0 ? -1 : 1;
    const absSide = Math.abs(side);

    // We use 200 as the cutoff speed implicitly by clamping the result to 2.0?
    // 200 * 0.01 = 2.0. So if we clamp result to 2.0, it is equivalent.

    let rollTilt = absSide * this.settings.runRoll; // 0.01
    if (rollTilt > 2.0) {
         rollTilt = 2.0;
    }
    rollTilt *= sign;

    // Bob tilt
    let pitchDelta = this.bobFracSin * this.settings.bobPitch * xyspeed;
    let rollDelta = this.bobFracSin * this.settings.bobRoll * xyspeed;
    if (hasPmFlag(state.pmFlags, PmFlag.Ducked) && onGround) {
      pitchDelta *= 6;
      rollDelta *= 6;
    }

    pitchTilt += Math.min(pitchDelta, this.settings.maxBobAngle);
    rollDelta = Math.min(rollDelta, this.settings.maxBobAngle);
    if (this.bobCycle & 1) rollDelta = -rollDelta;
    rollTilt += rollDelta;

    // Bob height
    const bobHeight = Math.min(this.bobFracSin * xyspeed * this.settings.bobUp, this.settings.maxBobHeight);

    let kickPitch = 0;
    let kickRoll = 0;

    // Apply active kick
    if (this.kick && this.kick.remainingMs > 0) {
      const ratio = Math.max(0, Math.min(1, this.kick.remainingMs / this.kick.durationMs));
      kickPitch += ratio * this.kick.pitch;
      kickRoll += ratio * this.kick.roll;
      this.kick.remainingMs = Math.max(0, this.kick.remainingMs - frameTimeMs);
      if (this.kick.remainingMs === 0) this.kick = undefined;
    }

    const angles: Vec3 = { x: pitchTilt + kickPitch, y: 0, z: rollTilt + kickRoll };
    const offset: Vec3 = { x: 0, y: 0, z: bobHeight };

    const sample: ViewSample = {
      angles,
      offset: clampViewOffset(offset),
      bobCycle: this.bobCycle,
      bobCycleRun: this.bobCycleRun,
      bobFracSin: this.bobFracSin,
      xyspeed,
    } satisfies ViewSample;
    this.lastSample = sample;
    return sample;
  }
}
