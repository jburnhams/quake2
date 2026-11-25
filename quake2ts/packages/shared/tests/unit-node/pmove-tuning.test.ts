import { describe, expect, it } from 'vitest';
import { makeLeafModel, makeBrushFromMinsMaxs, createTraceRunner } from '@quake2ts/test-utils';
import {
  DEFAULT_PMOVE_TUNING,
  PlayerButton,
  PmType,
  runPmove,
  type PmoveCmd,
  type PmoveState,
  type PmoveTuning,
} from '@quake2ts/shared';

// runPmove's tuning: the explorer's movement lab changes these constants on sliders, so a
// change must reach the move, and leaving them out must be the game exactly as it was.
describe('runPmove tuning', () => {
  const floor = makeBrushFromMinsMaxs({ x: -2048, y: -2048, z: -32 }, { x: 2048, y: 2048, z: 0 });
  const step = makeBrushFromMinsMaxs({ x: 600, y: -64, z: 0 }, { x: 664, y: 64, z: 24 });
  const trace = createTraceRunner(makeLeafModel([floor, step]));
  const imports = { trace, pointcontents: () => 0 };

  const cmd = (buttons = 0): PmoveCmd => ({ forwardmove: 400, sidemove: 0, upmove: 0, buttons, angles: { x: 0, y: 0, z: 0 }, msec: 25 });
  const start: PmoveState = {
    pmType: PmType.Normal,
    pmFlags: 0,
    origin: { x: 0, y: 0, z: 24.125 },
    velocity: { x: 0, y: 0, z: 0 },
    angles: { x: 0, y: 0, z: 0 },
    viewAngles: { x: 0, y: 0, z: 0 },
    viewHeight: 22,
    waterlevel: 0,
    watertype: 0,
    cmd: cmd(),
    delta_angles: { x: 0, y: 0, z: 0 },
    gravity: 800,
    mins: { x: -16, y: -16, z: -24 },
    maxs: { x: 16, y: 16, z: 32 },
  };

  /** Runs forward for `frames` 40 Hz frames, jumping on `jumpAt`, and returns every state. */
  function run(tuning?: Partial<PmoveTuning>, frames = 40, jumpAt = -1): PmoveState[] {
    const states: PmoveState[] = [];
    let s = start;
    for (let i = 0; i < frames; i++) {
      s = runPmove({ ...s, cmd: cmd(i === jumpAt ? PlayerButton.Jump : 0) }, imports, tuning);
      states.push(s);
    }
    return states;
  }

  it('moves exactly as before when no tuning, or the defaults, are given', () => {
    const plain = run(undefined, 60, 10);
    expect(run(DEFAULT_PMOVE_TUNING, 60, 10)).toEqual(plain);
    expect(run({}, 60, 10)).toEqual(plain);
  });

  it('caps the run at maxSpeed', () => {
    const speed = (s: PmoveState) => Math.hypot(s.velocity.x, s.velocity.y);
    expect(speed(run().at(-1)!)).toBeCloseTo(300, 0);
    expect(speed(run({ maxSpeed: 150 }).at(-1)!)).toBeCloseTo(150, 0);
  });

  it('reaches full speed sooner with more acceleration', () => {
    const after5 = (t?: Partial<PmoveTuning>) => run(t, 5).at(-1)!.velocity.x;
    expect(after5({ accelerate: 20 })).toBeGreaterThan(after5());
  });

  it('jumps higher with a faster jump', () => {
    const peak = (t?: Partial<PmoveTuning>) => Math.max(...run(t, 60, 0).map((s) => s.origin.z));
    expect(peak({ jumpSpeed: 400 })).toBeGreaterThan(peak() + 20);
  });

  it('climbs a 24-unit step only when stepSize allows it', () => {
    // The step's near face is at x = 600; the player's box reaches 16 ahead of its origin.
    const blocked = run(undefined, 120);
    const climbed = run({ stepSize: 32 }, 120);
    expect(blocked.at(-1)!.origin.x).toBeLessThan(600 - 16 + 1);
    expect(Math.max(...blocked.map((s) => s.origin.z))).toBeLessThan(25);
    expect(climbed.at(-1)!.origin.x).toBeGreaterThan(600);
    expect(Math.max(...climbed.map((s) => s.origin.z))).toBeCloseTo(24.125 + 24, 0);
  });

  it('keeps the defaults frozen', () => {
    expect(Object.isFrozen(DEFAULT_PMOVE_TUNING)).toBe(true);
  });
});
