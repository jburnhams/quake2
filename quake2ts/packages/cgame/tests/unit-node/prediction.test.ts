import { describe, expect, it } from 'vitest';
import {
  applyPmoveAccelerate,
  applyPmoveFriction,
  buildAirGroundWish,
  clampViewAngles,
  PmFlag,
  PmType,
  WaterLevel,
  type UserCommand,
  type Vec3,
} from '@quake2ts/shared';
import { ClientPrediction, defaultPredictionState, interpolatePredictionState, PredictionState } from '../../src/index.js';
import { PmoveTraceResult } from '@quake2ts/shared';

const ZERO_VEC = { x: 0, y: 0, z: 0 } as const;

const mockTrace = (start: Vec3, end: Vec3) => {
  // Simple heuristic: if tracing down effectively vertically, assume ground hit for categorizePosition
  // categorizePosition traces 0.25 units down
  if (end.z < start.z && Math.abs(start.x - end.x) < 0.001 && Math.abs(start.y - end.y) < 0.001) {
       return {
          fraction: 0, // Hit immediately (already on ground)
          endpos: start,
          allsolid: false,
          startsolid: false,
          planeNormal: { x: 0, y: 0, z: 1 }
      } as PmoveTraceResult;
  }
  return {
    fraction: 1,
    endpos: end,
    allsolid: false,
    startsolid: false,
} as PmoveTraceResult;
};

const mockPointContents = (point: Vec3) => 0;

function createGroundState(): PredictionState {
  return {
    ...defaultPredictionState(), // Must use default to fill all fields including stubs
    origin: ZERO_VEC,
    velocity: { x: 50, y: 0, z: 0 },
    viewAngles: ZERO_VEC,
    pmFlags: PmFlag.OnGround,
    pmType: PmType.Normal,
    waterLevel: WaterLevel.None,
    gravity: 800,
    deltaAngles: ZERO_VEC,
  } as PredictionState;
}

describe('ClientPrediction', () => {
  it('applies ground friction and acceleration identically to rerelease pmove', () => {
    const prediction = new ClientPrediction({ trace: mockTrace, pointContents: mockPointContents });
    const base = createGroundState();
    prediction.setAuthoritative({ frame: 1, timeMs: 25, state: base });

    const cmd: UserCommand = {
      msec: 25,
      buttons: 0,
      angles: base.viewAngles,
      forwardmove: 200,
      sidemove: 0,
      upmove: 0,
      serverFrame: 1,
    };

    const predicted = prediction.enqueueCommand(cmd);

    // applyPmove uses fixed 0.025 frametime
    const frametime = 0.025;
    const { forward, right } = clampViewAngles({ pmFlags: base.pmFlags, cmdAngles: cmd.angles, deltaAngles: ZERO_VEC });
    const wish = buildAirGroundWish({ forward, right, cmd, maxSpeed: 320 }); // apply.ts uses hardcoded 320

    // Note: applyPmove in shared currently uses hardcoded 320 maxSpeed for air/ground wish.
    // The test below mimics applyPmove logic to verify ClientPrediction delegates correctly.

    const withFriction = applyPmoveFriction({
      velocity: base.velocity,
      frametime,
      onGround: true,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: base.waterLevel,
      pmFriction: 6,
      pmStopSpeed: 100,
      pmWaterFriction: 1,
    });
    const accelerated = applyPmoveAccelerate({
      velocity: withFriction,
      wishdir: wish.wishdir,
      wishspeed: wish.wishspeed,
      accel: 10,
      frametime,
    });

    // We expect the prediction to match the manual calculation using the same constants as applyPmove
    expect(predicted.velocity.x).toBeCloseTo(accelerated.x);
    expect(predicted.velocity.y).toBeCloseTo(accelerated.y);
    expect(predicted.velocity.z).toBeCloseTo(accelerated.z);
    expect(predicted.origin.x).toBeCloseTo(base.origin.x + accelerated.x * frametime);
  });

  it('replays unacknowledged commands after an authoritative correction', () => {
    const prediction = new ClientPrediction({ trace: mockTrace, pointContents: mockPointContents });
    prediction.setAuthoritative({ frame: 1, timeMs: 25, state: createGroundState() });

    const earlyCmd: UserCommand = {
      msec: 25,
      buttons: 0,
      angles: ZERO_VEC,
      forwardmove: 200,
      sidemove: 0,
      upmove: 0,
      serverFrame: 1,
    };
    prediction.enqueueCommand(earlyCmd);

    const correctedState = {
      ...createGroundState(),
      origin: { x: 10, y: 0, z: 0 },
    };
    const afterCorrection = prediction.setAuthoritative({ frame: 2, timeMs: 50, state: correctedState });

    expect(afterCorrection.origin.x).toBeCloseTo(correctedState.origin.x);

    const lateCmd: UserCommand = { ...earlyCmd, serverFrame: 3 };
    const predicted = prediction.enqueueCommand(lateCmd);

    expect(predicted.origin.x).toBeGreaterThan(afterCorrection.origin.x);
    expect(prediction.getPredictedState()).toEqual(predicted);
  });

  it('keeps absolute view angles between commands instead of compounding them', () => {
    const prediction = new ClientPrediction({ trace: mockTrace, pointContents: mockPointContents });
    const base = createGroundState();
    prediction.setAuthoritative({ frame: 1, timeMs: 25, state: base });

    const cmdAngles = { x: 5, y: 45, z: 0 } as const;
    const cmd: UserCommand = {
      msec: 25,
      buttons: 0,
      angles: cmdAngles,
      forwardmove: 0,
      sidemove: 0,
      upmove: 0,
    };

    const first = prediction.enqueueCommand({ ...cmd, serverFrame: 2 });
    // applyPmove should update viewAngles based on cmd
    expect(first.viewAngles).toEqual(cmdAngles);

    const second = prediction.enqueueCommand({ ...cmd, serverFrame: 3 });
    expect(second.viewAngles).toEqual(cmdAngles);
  });

  it('stops movement on collision', () => {
    const trace = (start: Vec3, end: Vec3) => ({
      fraction: 0.5,
      endpos: { x: 5, y: 0, z: 0 },
      allsolid: false,
      startsolid: false,
    } as PmoveTraceResult);
    const prediction = new ClientPrediction({ trace: trace, pointContents: mockPointContents });
    const base = createGroundState();
    prediction.setAuthoritative({ frame: 1, timeMs: 25, state: base });

    const cmd: UserCommand = {
      msec: 25,
      buttons: 0,
      angles: base.viewAngles,
      forwardmove: 200,
      sidemove: 0,
      upmove: 0,
      serverFrame: 1,
    };

    const predicted = prediction.enqueueCommand(cmd);
    expect(predicted.origin.x).toBe(5);
    });
});

describe('interpolatePredictionState', () => {
  it('wraps angles while interpolating frame samples', () => {
    const previous: PredictionState = {
      ...defaultPredictionState(),
      origin: ZERO_VEC,
      velocity: ZERO_VEC,
      viewAngles: { x: 0, y: 350, z: 0 },
    };

    const latest: PredictionState = {
      ...defaultPredictionState(),
      origin: { x: 10, y: 0, z: 0 },
      velocity: { x: 1, y: 0, z: 0 },
      viewAngles: { x: 0, y: 10, z: 0 },
    };

    const interpolated = interpolatePredictionState(previous, latest, 0.5);

    expect(interpolated.origin.x).toBeCloseTo(5);
    expect(interpolated.velocity.x).toBeCloseTo(0.5);
    expect(interpolated.viewAngles.y).toBeCloseTo(0);
  });
});
