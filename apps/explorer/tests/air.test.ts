// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PmType, runPmove, type PmoveImports, type PmoveState } from '@quake2ts/shared/pmove';
import { airFrame, bestAngle, gainBand, gainByAngle, strafeRun } from '../src/labs/movement/air';
import { DEFAULT_LAB_TUNING, type LabTuning } from '../src/labs/movement/simulate';

// The air view's frame against the game's own move: a player in empty space holding strafe right
// with the view turned so the wish direction is `angle` degrees off the velocity.
const OPEN: PmoveImports = {
  trace: (start, end) => ({ fraction: 1, endpos: end, allsolid: false, startsolid: false }),
  pointcontents: () => 0,
};

function pmoveFrame(speed: number, angle: number, tuning: LabTuning, msec: number) {
  // Strafing right moves along the view's right vector, 90 degrees clockwise of where it looks.
  const angles = { x: 0, y: angle + 90, z: 0 };
  const state: PmoveState = {
    pmType: PmType.Normal,
    pmFlags: 0,
    origin: { x: 0, y: 0, z: 1000 },
    velocity: { x: speed, y: 0, z: 0 },
    angles,
    viewAngles: angles,
    viewHeight: 22,
    waterlevel: 0,
    watertype: 0,
    cmd: { forwardmove: 0, sidemove: 400, upmove: 0, buttons: 0, angles, msec },
    delta_angles: { x: 0, y: 0, z: 0 },
    gravity: tuning.gravity,
    mins: { x: -16, y: -16, z: -24 },
    maxs: { x: 16, y: 16, z: 32 },
  };
  return runPmove(state, OPEN, tuning).velocity;
}

describe('the air view', () => {
  for (const airAccelerate of [0, 10]) {
    it(`is one frame of the game's air move (sv_airaccelerate ${airAccelerate})`, () => {
      const tuning = { ...DEFAULT_LAB_TUNING, airAccelerate };
      for (const angle of [0, 24, 60, 90, 135]) {
        const lab = airFrame(320, angle, tuning, 25).after;
        const game = pmoveFrame(320, angle, tuning, 25);
        expect(lab.x).toBeCloseTo(game.x, 3);
        expect(lab.y).toBeCloseTo(game.y, 3);
      }
    });
  }

  it('takes PM_Accelerate at 1 when sv_airaccelerate is 0, as the game ships', () => {
    const f = airFrame(320, 90, DEFAULT_LAB_TUNING, 25);
    expect(f.path).toBe('PM_Accelerate');
    expect(f.accel).toBe(1);
    // 1 x 0.025 s x 300 u/s: 7.5 u/s added sideways.
    expect(f.accelspeed).toBeCloseTo(7.5, 6);
  });

  it('caps the wished speed at 30 on PM_AirAccelerate', () => {
    const f = airFrame(320, 90, { ...DEFAULT_LAB_TUNING, airAccelerate: 10 }, 25);
    expect(f.path).toBe('PM_AirAccelerate');
    expect(f.comparedSpeed).toBe(30);
    expect(f.accelspeed).toBeCloseTo(30, 6);
  });

  it('gains only where the velocity has room along the wish direction', () => {
    // currentspeed must be under 300: cos(angle) < 300/320, so above about 20.4 degrees.
    const band = gainBand(320, DEFAULT_LAB_TUNING, 25)!;
    expect(band.from).toBeCloseTo((Math.acos(300 / 320) * 180) / Math.PI, 0);
    expect(gainByAngle(320, DEFAULT_LAB_TUNING, 25).find((p) => p.angle === 10)!.gain).toBeLessThanOrEqual(0);
    // With the cap at 30, the band is a few degrees either side of square.
    const capped = gainBand(320, { ...DEFAULT_LAB_TUNING, airAccelerate: 10 }, 25)!;
    expect(capped.from).toBeGreaterThan(84);
    expect(capped.to).toBeLessThan(96);
    expect(bestAngle(320, { ...DEFAULT_LAB_TUNING, airAccelerate: 10 }, 25).angle).toBeCloseTo(90, 0);
  });

  it('climbs past pm_maxspeed when the best angle is held', () => {
    const run = strafeRun(DEFAULT_LAB_TUNING, 25, 3);
    expect(run[0]!.speed).toBe(300);
    expect(run.at(-1)!.speed).toBeGreaterThan(600);
    for (let i = 1; i < run.length; i++) expect(run[i]!.speed).toBeGreaterThan(run[i - 1]!.speed);
  });
});
