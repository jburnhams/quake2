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
} from '@quake2ts/shared';
import { ClientPrediction, defaultPredictionState, interpolatePredictionState } from '../src/index.js';

const ZERO_VEC = { x: 0, y: 0, z: 0 } as const;

function createGroundState() {
  return {
    origin: ZERO_VEC,
    velocity: { x: 50, y: 0, z: 0 },
    viewangles: ZERO_VEC,
    pmFlags: PmFlag.OnGround,
    pmType: PmType.Normal,
    waterlevel: WaterLevel.None,
    gravity: 800,
    deltaAngles: ZERO_VEC,
  } as const;
}

describe('ClientPrediction', () => {
  it('applies ground friction and acceleration identically to rerelease pmove', () => {
    const prediction = new ClientPrediction();
    const base = createGroundState();
    prediction.setAuthoritative({ frame: 1, timeMs: 25, state: base });

    const cmd: UserCommand = {
      msec: 25,
      buttons: 0,
      angles: base.viewangles,
      forwardmove: 200,
      sidemove: 0,
      upmove: 0,
      serverFrame: 1,
    };

    const predicted = prediction.enqueueCommand(cmd);

    const frametime = cmd.msec / 1000;
    const { forward, right } = clampViewAngles({ pmFlags: base.pmFlags, cmdAngles: cmd.angles, deltaAngles: ZERO_VEC });
    const wish = buildAirGroundWish({ forward, right, cmd, maxSpeed: 300 });
    const withFriction = applyPmoveFriction({
      velocity: base.velocity,
      frametime,
      onGround: true,
      groundIsSlick: false,
      onLadder: false,
      waterlevel: base.waterlevel,
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

    expect(predicted.velocity.x).toBeCloseTo(accelerated.x);
    expect(predicted.velocity.y).toBeCloseTo(accelerated.y);
    expect(predicted.velocity.z).toBeCloseTo(accelerated.z);
    expect(predicted.origin.x).toBeCloseTo(base.origin.x + accelerated.x * frametime);
  });

  it('replays unacknowledged commands after an authoritative correction', () => {
    const prediction = new ClientPrediction();
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
    const prediction = new ClientPrediction();
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
    expect(first.viewangles).toEqual(cmdAngles);

    const second = prediction.enqueueCommand({ ...cmd, serverFrame: 3 });
    expect(second.viewangles).toEqual(cmdAngles);
  });
});

describe('interpolatePredictionState', () => {
  it('wraps angles while interpolating frame samples', () => {
    const previous = {
      ...defaultPredictionState(),
      origin: ZERO_VEC,
      velocity: ZERO_VEC,
      viewangles: { x: 0, y: 350, z: 0 },
    };

    const latest = {
      ...defaultPredictionState(),
      origin: { x: 10, y: 0, z: 0 },
      velocity: { x: 1, y: 0, z: 0 },
      viewangles: { x: 0, y: 10, z: 0 },
    };

    const interpolated = interpolatePredictionState(previous, latest, 0.5);

    expect(interpolated.origin.x).toBeCloseTo(5);
    expect(interpolated.velocity.x).toBeCloseTo(0.5);
    expect(interpolated.viewangles.y).toBeCloseTo(0);
  });
});
