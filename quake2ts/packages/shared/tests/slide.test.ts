import { describe, expect, it } from 'vitest';
import { ZERO_VEC3, clipVelocityVec3, normalizeVec3, resolveSlideMove } from '../src/index.js';

const OVERBOUNCE = 1.01;

describe('resolveSlideMove', () => {
  it('returns primal velocity when no planes are encountered', () => {
    const primal = { x: 5, y: 0, z: 0 };
    const result = resolveSlideMove(primal, [], OVERBOUNCE);

    expect(result.velocity).toEqual(primal);
    expect(result.stopped).toBe(false);
  });

  it('clips against a single plane like PM_ClipVelocity', () => {
    const primal = { x: 0, y: 0, z: -10 };
    const plane = { x: 0, y: 0, z: 1 };

    const expected = clipVelocityVec3(primal, plane, OVERBOUNCE);
    const result = resolveSlideMove(primal, [plane], OVERBOUNCE);

    expect(result.velocity).toEqual(expected);
    expect(result.stopped).toBe(true);
  });

  it('projects along the crease formed by two planes', () => {
    const floor = { x: 0, y: 0, z: 1 };
    const wall = normalizeVec3({ x: 0, y: 1, z: 0 });
    const primal = { x: 10, y: -5, z: 0 };

    const result = resolveSlideMove(primal, [floor, wall], OVERBOUNCE);

    expect(result.velocity.y).toBeCloseTo(0, 4);
    expect(result.velocity.z).toBeCloseTo(0, 4);
    expect(result.velocity.x).toBeGreaterThan(0);
  });

  it('stops when a third plane creates an unresolvable corner', () => {
    const planes = [
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 1, z: 0 },
      normalizeVec3({ x: -1, y: 0, z: 0 }),
    ];

    const result = resolveSlideMove({ x: 5, y: -2, z: -1 }, planes, OVERBOUNCE);

    expect(result.velocity).toEqual(ZERO_VEC3);
    expect(result.stopped).toBe(true);
  });

  it('halts when the resolved velocity flips against the primal direction', () => {
    const result = resolveSlideMove({ x: 1, y: 0, z: 0 }, [{ x: -1, y: 0, z: 0 }], OVERBOUNCE);

    expect(result.velocity).toEqual(ZERO_VEC3);
    expect(result.stopped).toBe(true);
  });
});
