import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ZERO_VEC3,
  goodPosition,
  initialSnapPosition,
  snapPosition,
  type Vec3,
} from '../../src/index.js';
import type { PmoveTraceFn } from '../../src/pmove/types.js';
import * as stuckModule from '../../src/pmove/stuck.js';

function key(vec: Vec3): string {
  return `${vec.x},${vec.y},${vec.z}`;
}

function createGridTrace(blocked: Set<string>): PmoveTraceFn {
  return (start, end) => {
    const startsolid = blocked.has(key(start));
    const endsolid = blocked.has(key(end));
    return {
      fraction: endsolid ? 0 : 1,
      endpos: { ...end },
      planeNormal: undefined,
      allsolid: startsolid && endsolid,
      startsolid,
    };
  };
}

describe('pmove snap helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects valid positions via goodPosition', () => {
    const trace = createGridTrace(new Set());
    const result = goodPosition({
      origin: ZERO_VEC3,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      trace,
    });
    expect(result).toBe(true);
  });

  it('flags allsolid hits via goodPosition', () => {
    const blocked = new Set([key(ZERO_VEC3)]);
    const trace = createGridTrace(blocked);
    const result = goodPosition({
      origin: ZERO_VEC3,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      trace,
    });
    expect(result).toBe(false);
  });

  it('leaves origin unchanged when already valid', () => {
    const origin = { x: 2, y: -3, z: 4 } satisfies Vec3;
    const trace = createGridTrace(new Set());
    const result = snapPosition({
      origin,
      velocity: { x: 10, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      previousOrigin: { x: -99, y: -99, z: -99 },
      trace,
    });
    expect(result.origin).toEqual(origin);
    expect(result.resolution).toBe('unchanged');
  });

  it('uses fixStuckObjectGeneric results when stuck and fixable', () => {
    const blocked = new Set([key(ZERO_VEC3)]);
    const trace = createGridTrace(blocked);
    const fixedOrigin = { x: 5, y: 5, z: 5 } satisfies Vec3;
    const spy = vi.spyOn(stuckModule, 'fixStuckObjectGeneric').mockReturnValue({
      result: 'fixed',
      origin: fixedOrigin,
    });

    const result = snapPosition({
      origin: ZERO_VEC3,
      velocity: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      previousOrigin: { x: -10, y: -10, z: -10 },
      trace,
    });

    expect(spy).toHaveBeenCalled();
    expect(result.origin).toEqual(fixedOrigin);
    expect(result.resolution).toBe('fixed');
  });

  it('reverts to previous origin when stuck fix fails', () => {
    const blocked = new Set([key(ZERO_VEC3)]);
    const trace = createGridTrace(blocked);
    vi.spyOn(stuckModule, 'fixStuckObjectGeneric').mockReturnValue({
      result: 'no-good-position',
      origin: ZERO_VEC3,
    });

    const previousOrigin = { x: 42, y: -7, z: 11 } satisfies Vec3;
    const result = snapPosition({
      origin: ZERO_VEC3,
      velocity: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      previousOrigin,
      trace,
    });

    expect(result.origin).toEqual(previousOrigin);
    expect(result.resolution).toBe('reverted');
  });

  it('searches offsets in PM_InitialSnapPosition order', () => {
    const trace: PmoveTraceFn = (start, end) => {
      const solid = end.z <= 0;
      return {
        fraction: solid ? 0 : 1,
        endpos: { ...end },
        planeNormal: undefined,
        allsolid: solid,
        startsolid: solid,
      };
    };

    const result = initialSnapPosition({
      origin: ZERO_VEC3,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      trace,
    });

    expect(result.origin).toEqual({ x: 0, y: 0, z: 1 });
    expect(result.snapped).toBe(true);
  });
});
