// CL_PredictMovement runs the same Pmove as the server, so with nothing lost the prediction
// lands where the server does: on a run with a jump in it, every predicted origin is the one
// runPmove gives for the same commands.
import { describe, expect, it } from 'vitest';
import {
  PlayerButton,
  PmFlag,
  PmType,
  runPmove,
  type PmoveState,
  type PmoveTraceResult,
  type UserCommand,
  type Vec3,
} from '@quake2ts/shared';
import { ClientPrediction, defaultPredictionState } from '../../../src/index.js';

/** A floor at z = 0 and nothing else. */
const trace = (start: Vec3, end: Vec3, mins?: Vec3): PmoveTraceResult => {
  const floorZ = -(mins?.z ?? 0);
  if (end.z >= floorZ || start.z < floorZ) return { fraction: 1, endpos: end, allsolid: false, startsolid: false };
  const fraction = (start.z - floorZ) / (start.z - end.z);
  return {
    fraction,
    endpos: { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction, z: floorZ },
    allsolid: false,
    startsolid: false,
    planeNormal: { x: 0, y: 0, z: 1 },
    contents: 1,
  };
};
const pointContents = () => 0;

const command = (sequence: number): UserCommand => ({
  sequence,
  msec: 25,
  forwardmove: 400,
  sidemove: 0,
  upmove: 0,
  buttons: sequence === 8 ? PlayerButton.Jump : 0,
  angles: { x: 0, y: 30, z: 0 },
  lightlevel: 0,
  impulse: 0,
});

describe('client prediction against the server move', () => {
  it('predicts a run and a jump to the same origins runPmove gives', () => {
    const start = { ...defaultPredictionState(), origin: { x: 0, y: 0, z: 24 } };
    const prediction = new ClientPrediction({ trace, pointContents });
    prediction.setAuthoritative({ frame: 1, timeMs: 0, state: start });

    let server: PmoveState = {
      pmType: PmType.Normal,
      pmFlags: PmFlag.OnGround,
      origin: start.origin,
      velocity: start.velocity,
      angles: start.viewAngles,
      viewAngles: start.viewAngles,
      viewHeight: 22,
      waterlevel: 0,
      watertype: 0,
      cmd: command(2),
      delta_angles: { x: 0, y: 0, z: 0 },
      gravity: 800,
      mins: start.mins,
      maxs: start.maxs,
    };

    let leftGround = false;
    for (let seq = 2; seq < 40; seq++) {
      const cmd = command(seq);
      server = runPmove({ ...server, cmd: { ...cmd }, viewAngles: cmd.angles }, { trace, pointcontents: pointContents });
      const predicted = prediction.enqueueCommand(cmd);
      expect(predicted.origin).toEqual(server.origin);
      if (!predicted.onGround) leftGround = true;
    }
    expect(leftGround).toBe(true);
  });
});
