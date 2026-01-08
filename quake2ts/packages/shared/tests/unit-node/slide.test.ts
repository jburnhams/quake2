import { describe, expect, it } from 'vitest';
import {
  ZERO_VEC3,
  clipVelocityVec3,
  normalizeVec3,
  resolveSlideMove,
  slideMove,
  stepSlideMove,
  SLIDEMOVE_BLOCKED_FLOOR,
  SLIDEMOVE_BLOCKED_WALL,
  type PmoveTraceFn,
  type PmoveTraceResult,
} from '../../src/index.js';

const OVERBOUNCE = 1.01;

function scriptedTrace(script: PmoveTraceResult[]) {
  const queue = [...script];
  return {
    trace: (start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }) => {
      if (queue.length === 0) {
        return { fraction: 1, endpos: end, planeNormal: undefined, allsolid: false, startsolid: false } satisfies PmoveTraceResult;
      }

      const next = queue.shift()!;
      return next.fraction === 1 ? { ...next, endpos: end } : next;
    },
  };
}

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

describe('slideMove', () => {
  it('advances freely when no collision is detected', () => {
    const { trace } = scriptedTrace([]);

    const result = slideMove({
      origin: { x: 0, y: 0, z: 0 },
      velocity: { x: 10, y: 0, z: 0 },
      frametime: 0.1,
      overbounce: OVERBOUNCE,
      trace,
    });

    expect(result.origin).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.velocity).toEqual({ x: 10, y: 0, z: 0 });
    expect(result.blocked).toBe(0);
    expect(result.stopped).toBe(false);
  });

  it('clips to a floor plane and continues sliding', () => {
    const { trace } = scriptedTrace([
      {
        fraction: 0.5,
        endpos: { x: 0.5, y: 0, z: -0.5 },
        planeNormal: { x: 0, y: 0, z: 1 },
        allsolid: false,
        startsolid: false,
      },
    ]);

    const result = slideMove({
      origin: { x: 0, y: 0, z: 0 },
      velocity: { x: 10, y: 0, z: -10 },
      frametime: 0.1,
      overbounce: OVERBOUNCE,
      trace,
    });

    expect(result.origin.x).toBeCloseTo(1, 5);
    expect(result.origin.z).toBeCloseTo(-0.5, 5);
    expect(result.velocity.z).toBe(0);
    expect(result.blocked & SLIDEMOVE_BLOCKED_FLOOR).toBeTruthy();
    expect(result.stopped).toBe(false);
  });

  it('accumulates planes to slide along a crease', () => {
    const { trace } = scriptedTrace([
      {
        fraction: 0.1,
        endpos: { x: 1, y: 0, z: -0.5 },
        planeNormal: { x: 0, y: 0, z: 1 },
        allsolid: false,
        startsolid: false,
      },
      {
        fraction: 0.5,
        endpos: { x: 1.5, y: -0.25, z: -0.5 },
        planeNormal: { x: 0, y: -1, z: 0 },
        allsolid: false,
        startsolid: false,
      },
    ]);

    const result = slideMove({
      origin: { x: 0, y: -1, z: 0 },
      velocity: { x: 10, y: 5, z: -5 },
      frametime: 0.1,
      overbounce: OVERBOUNCE,
      trace,
    });

    expect(result.velocity.y).toBeCloseTo(0, 4);
    expect(result.velocity.z).toBeCloseTo(0, 4);
    expect(result.blocked).toBe(SLIDEMOVE_BLOCKED_FLOOR | SLIDEMOVE_BLOCKED_WALL);
    expect(result.stopped).toBe(false);
  });

  it('halts immediately when the trace reports allsolid', () => {
    const { trace } = scriptedTrace([
      {
        fraction: 0,
        endpos: { x: 0, y: 0, z: 0 },
        planeNormal: { x: 0, y: 0, z: 1 },
        allsolid: true,
        startsolid: true,
      },
    ]);

    const result = slideMove({
      origin: { x: 0, y: 0, z: 0 },
      velocity: { x: 5, y: 0, z: 0 },
      frametime: 0.1,
      overbounce: OVERBOUNCE,
      trace,
    });

    expect(result.velocity).toEqual(ZERO_VEC3);
    expect(result.origin).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.stopped).toBe(true);
  });

  it('stops immediately when starting in solid geometry', () => {
    const { trace } = scriptedTrace([
      {
        fraction: 0,
        endpos: { x: 0, y: 0, z: 0 },
        planeNormal: { x: 1, y: 0, z: 0 },
        allsolid: false,
        startsolid: true,
      },
    ]);

    const result = slideMove({
      origin: { x: 0, y: 0, z: 0 },
      velocity: { x: 100, y: 0, z: 0 },
      frametime: 0.1,
      overbounce: OVERBOUNCE,
      trace,
    });

    expect(result.velocity).toEqual(ZERO_VEC3);
    expect(result.stopped).toBe(true);
  });

  it('prevents velocity from flipping downward when the primal velocity was rising', () => {
    const { trace } = scriptedTrace([
      {
        fraction: 0.5,
        endpos: { x: 0, y: 0, z: 0.5 },
        planeNormal: { x: 0, y: 0, z: -1 },
        allsolid: false,
        startsolid: false,
      },
    ]);

    const result = slideMove({
      origin: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 10 },
      frametime: 0.1,
      overbounce: OVERBOUNCE,
      trace,
    });

    expect(result.velocity.z).toBe(0);
  });

  it('restores the primal velocity when hasTime is set', () => {
    const { trace } = scriptedTrace([
      {
        fraction: 0.5,
        endpos: { x: 0.5, y: 0, z: 0 },
        planeNormal: { x: -1, y: 0, z: 0 },
        allsolid: false,
        startsolid: false,
      },
    ]);

    const primal = { x: 10, y: 0, z: 0 } as const;
    const result = slideMove({
      origin: { x: 0, y: 0, z: 0 },
      velocity: primal,
      frametime: 0.1,
      overbounce: OVERBOUNCE,
      trace,
      hasTime: true,
    });

    expect(result.velocity).toEqual(primal);
  });
});

function steppedWorldTrace(stepHeight = 16, stepStartX = 4): PmoveTraceFn {
  const floorHeightAt = (x: number) => (x >= stepStartX ? stepHeight : 0);

  return ((start, end) => {
    const deltaX = end.x - start.x;
    const movingDown = end.z < start.z;

    if (movingDown) {
      const targetFloor = floorHeightAt(end.x);
      if (end.z < targetFloor) {
        const t = (start.z - targetFloor) / (start.z - end.z);
        const hitX = start.x + deltaX * t;
        return {
          fraction: t,
          endpos: { x: hitX, y: end.y, z: targetFloor },
          planeNormal: { x: 0, y: 0, z: 1 },
          allsolid: false,
          startsolid: false,
        } satisfies PmoveTraceResult;
      }
    }

    if (deltaX > 0 && start.x < stepStartX && end.x > stepStartX && start.z <= floorHeightAt(start.x)) {
      const frac = (stepStartX - start.x) / deltaX;
      return {
        fraction: frac,
        endpos: { x: stepStartX, y: end.y, z: start.z },
        planeNormal: { x: -1, y: 0, z: 0 },
        allsolid: false,
        startsolid: false,
      } satisfies PmoveTraceResult;
    }

    return { fraction: 1, endpos: end, planeNormal: undefined, allsolid: false, startsolid: false } satisfies PmoveTraceResult;
  }) satisfies PmoveTraceFn;
}

describe('stepSlideMove', () => {
  it('steps over a ledge and keeps planar distance when it is faster', () => {
    const trace = steppedWorldTrace();

    const result = stepSlideMove({
      origin: { x: 0, y: 0, z: 0 },
      velocity: { x: 200, y: 0, z: 0 },
      frametime: 0.1,
      overbounce: OVERBOUNCE,
      trace,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
    });

    expect(result.stepped).toBe(true);
    expect(result.origin.x).toBeCloseTo(20, 4);
    expect(result.origin.z).toBeCloseTo(16, 4);
    expect(result.stepHeight).toBeCloseTo(18, 4);
    expect(result.velocity.x).toBe(200);
    expect(result.velocity.z).toBe(0);
  });

  it('falls back to the non-step path when the upward trace is blocked', () => {
    const blockingTrace: PmoveTraceFn = (start, end) => {
      if (end.z > start.z) {
        return {
          fraction: 0,
          endpos: start,
          planeNormal: { x: 0, y: 0, z: 1 },
          allsolid: true,
          startsolid: true,
        } satisfies PmoveTraceResult;
      }
      return { fraction: 1, endpos: end, planeNormal: undefined, allsolid: false, startsolid: false } satisfies PmoveTraceResult;
    };

    const result = stepSlideMove({
      origin: { x: 0, y: 0, z: 0 },
      velocity: { x: 100, y: 0, z: 0 },
      frametime: 0.1,
      overbounce: OVERBOUNCE,
      trace: blockingTrace,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
    });

    expect(result.stepped).toBe(false);
    expect(result.origin).toEqual({ x: 10, y: 0, z: 0 });
  });
});
