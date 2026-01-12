import { describe, expect, it } from 'vitest';
import { clampViewAngles } from '../../src/pmove/view.js';
import { PmFlag } from '../../src/pmove/constants.js';
import { angleVectors } from '../../src/math/angles.js';

const ZERO_ANGLES = { x: 0, y: 0, z: 0 } as const;

describe('clampViewAngles', () => {
  it('resets pitch/roll during teleport pauses', () => {
    const result = clampViewAngles({
      pmFlags: PmFlag.TimeTeleport,
      cmdAngles: { x: 42, y: 10, z: 5 },
      deltaAngles: { x: -10, y: 1, z: 3 },
    });

    expect(result.viewangles).toEqual({ x: 0, y: 11, z: 0 });
    expect(result.forward.x).toBeCloseTo(Math.cos(0) * Math.cos(11 * (Math.PI / 180)), 4);
  });

  it('clamps upward pitch to 89 degrees', () => {
    const result = clampViewAngles({
      pmFlags: 0,
      cmdAngles: { x: 120, y: 0, z: 0 },
      deltaAngles: ZERO_ANGLES,
    });

    expect(result.viewangles.x).toBe(89);
  });

  it('clamps downward pitch to 271 degrees', () => {
    const result = clampViewAngles({
      pmFlags: 0,
      cmdAngles: { x: 250, y: 0, z: 0 },
      deltaAngles: ZERO_ANGLES,
    });

    expect(result.viewangles.x).toBe(271);
  });

  it('returns axis vectors matching the final angles', () => {
    const result = clampViewAngles({
      pmFlags: 0,
      cmdAngles: { x: 0, y: 90, z: 0 },
      deltaAngles: ZERO_ANGLES,
    });

    const expected = angleVectors(result.viewangles);
    expect(result.forward).toEqual(expected.forward);
    expect(result.right).toEqual(expected.right);
    expect(result.up).toEqual(expected.up);
  });
});
