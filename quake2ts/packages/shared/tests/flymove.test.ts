import { describe, expect, it } from 'vitest';
import { PlayerButton } from '../src/pmove/constants.js';
import { applyPmoveFlyMove, type FlyMoveParams } from '../src/pmove/fly.js';
import type { PmoveTraceFn } from '../src/pmove/slide.js';
import type { Vec3 } from '../src/math/vec3.js';

const BASE_PARAMS: FlyMoveParams = {
  origin: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  cmd: { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0 },
  forward: { x: 1, y: 0, z: 0 },
  right: { x: 0, y: 1, z: 0 },
  frametime: 0.1,
  pmFriction: 6,
  pmStopSpeed: 100,
  pmMaxSpeed: 300,
  pmAccelerate: 10,
  pmWaterSpeed: 400,
  doclip: false,
};

describe('applyPmoveFlyMove', () => {
  const apply = (overrides: Partial<FlyMoveParams> = {}) =>
    applyPmoveFlyMove({
      ...BASE_PARAMS,
      ...overrides,
      cmd: { ...BASE_PARAMS.cmd, ...(overrides.cmd ?? {}) },
    });

  it('applies the rerelease fly friction scalar before acceleration', () => {
    const result = apply({ velocity: { x: 100, y: 0, z: 0 } });
    expect(result.velocity).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('doubles the clamped wishspeed when accelerating from input', () => {
    const result = apply({ cmd: { forwardmove: 400, sidemove: 0, upmove: 0 } });
    expect(result.velocity.x).toBeCloseTo(600, 5);
    expect(result.origin.x).toBeCloseTo(60, 5);
  });

  it('adds jump/crouch button bias to the vertical wish velocity', () => {
    const upward = apply({ cmd: { ...BASE_PARAMS.cmd, buttons: PlayerButton.Jump } });
    expect(upward.velocity.z).toBe(400);

    const downward = apply({ cmd: { ...BASE_PARAMS.cmd, buttons: PlayerButton.Crouch } });
    expect(downward.velocity.z).toBe(-400);
  });

  it('routes doclip=true calls through stepSlideMove for collision handling', () => {
    const mins = { x: -8, y: -8, z: -8 } satisfies Vec3;
    const maxs = { x: 8, y: 8, z: 8 } satisfies Vec3;
    let traceCalls = 0;
    const trace: PmoveTraceFn = (start, end) => {
      traceCalls += 1;
      if (end.z <= 0) {
        const frac = (start.z - 0) / (start.z - end.z);
        return {
          fraction: frac,
          endpos: { x: start.x + (end.x - start.x) * frac, y: start.y + (end.y - start.y) * frac, z: 0 },
          planeNormal: { x: 0, y: 0, z: 1 },
          allsolid: false,
          startsolid: false,
        };
      }
      return { fraction: 1, endpos: end, allsolid: false, startsolid: false };
    };

    const result = apply({
      doclip: true,
      trace,
      mins,
      maxs,
      origin: { x: 0, y: 0, z: 1 },
      velocity: { x: 0, y: 0, z: -400 },
    });

    expect(traceCalls).toBeGreaterThan(0);
    expect(result.velocity.z).toBe(0);
    expect(result.stepped).toBe(true);
    expect(result.stepHeight).toBeGreaterThan(0);
  });
});
