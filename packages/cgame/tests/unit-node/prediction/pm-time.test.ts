// pm_time is part of the predicted state (CL_PredictMovement copies cl.frame.playerstate.pmove,
// timer and all): the landing timer counts down across predicted commands and then clears
// PMF_TIME_LAND, so a jump straight after a crouched landing is predicted as the server runs it.
import { describe, expect, it } from 'vitest';
import { PmFlag, type PmoveTraceResult, type UserCommand, type Vec3 } from '@quake2ts/shared';
import { defaultPredictionState } from '../../../src/index.js';
import { predictMove } from '../../../src/prediction/index.js';

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
const physics = { trace, pointContents: () => 0 };
const cmd: UserCommand = { sequence: 1, msec: 25, forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0, angles: { x: 0, y: 0, z: 0 }, lightlevel: 0, impulse: 0 };

describe('predicted pm_time', () => {
  it('counts the landing timer down and then clears PMF_TIME_LAND', () => {
    let state = { ...defaultPredictionState(), origin: { x: 0, y: 0, z: 24 }, pmFlags: PmFlag.OnGround | PmFlag.TimeLand, pm_time: 30 };
    state = predictMove(state, cmd, physics);
    expect(state.pm_time).toBe(5);
    expect(state.pmFlags & PmFlag.TimeLand).toBe(PmFlag.TimeLand);
    state = predictMove(state, cmd, physics);
    expect(state.pm_time).toBe(0);
    expect(state.pmFlags & PmFlag.TimeLand).toBe(0);
  });
});
