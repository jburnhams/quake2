import { describe, expect, it } from 'vitest';
import {
  fixStuckObjectGeneric,
  type FixStuckTraceFn,
  type Vec3,
} from '../src/index.js';

interface SolidBox {
  readonly mins: Vec3;
  readonly maxs: Vec3;
}

interface Bounds {
  readonly mins: Vec3;
  readonly maxs: Vec3;
}

const BOX_MINS: Vec3 = { x: -4, y: -4, z: -4 };
const BOX_MAXS: Vec3 = { x: 4, y: 4, z: 4 };

function addBounds(origin: Vec3, mins: Vec3, maxs: Vec3): Bounds {
  return {
    mins: {
      x: origin.x + mins.x,
      y: origin.y + mins.y,
      z: origin.z + mins.z,
    },
    maxs: {
      x: origin.x + maxs.x,
      y: origin.y + maxs.y,
      z: origin.z + maxs.z,
    },
  };
}

function boxesOverlap(a: Bounds, b: SolidBox): boolean {
  return (
    a.maxs.x > b.mins.x &&
    a.mins.x < b.maxs.x &&
    a.maxs.y > b.mins.y &&
    a.mins.y < b.maxs.y &&
    a.maxs.z > b.mins.z &&
    a.mins.z < b.maxs.z
  );
}

type Axis = 'x' | 'y' | 'z';

function sweptEntryExit(
  startMin: number,
  startMax: number,
  velocity: number,
  targetMin: number,
  targetMax: number,
): [number, number] | undefined {
  if (velocity > 0) {
    return [(targetMin - startMax) / velocity, (targetMax - startMin) / velocity];
  }
  if (velocity < 0) {
    return [(targetMax - startMin) / velocity, (targetMin - startMax) / velocity];
  }
  if (startMax <= targetMin || startMin >= targetMax) {
    return undefined;
  }
  return [-Infinity, Infinity];
}

function sweepAabb(bounds: Bounds, delta: Vec3, obstacle: SolidBox): number | undefined {
  let entry = 0;
  let exit = 1;
  const axes: Axis[] = ['x', 'y', 'z'];
  for (const axis of axes) {
    const pair = sweptEntryExit(
      bounds.mins[axis],
      bounds.maxs[axis],
      delta[axis],
      obstacle.mins[axis],
      obstacle.maxs[axis],
    );
    if (!pair) {
      return undefined;
    }
    let [axisEntry, axisExit] = pair;
    if (axisEntry > axisExit) {
      [axisEntry, axisExit] = [axisExit, axisEntry];
    }
    entry = Math.max(entry, axisEntry);
    exit = Math.min(exit, axisExit);
    if (entry > exit) {
      return undefined;
    }
  }

  if (entry < 0 || entry > 1) {
    return undefined;
  }

  return entry;
}

function createTrace(obstacles: SolidBox[]): FixStuckTraceFn {
  return (start, mins, maxs, end) => {
    const bounds = addBounds(start, mins, maxs);
    const startsolid = obstacles.some((obstacle) => boxesOverlap(bounds, obstacle));
    if (startsolid) {
      return {
        fraction: 0,
        endpos: start,
        planeNormal: undefined,
        allsolid: true,
        startsolid: true,
      };
    }

    const delta: Vec3 = { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z };
    const hitTimes = obstacles
      .map((obstacle) => sweepAabb(bounds, delta, obstacle))
      .filter((time): time is number => typeof time === 'number');

    if (hitTimes.length === 0) {
      return { fraction: 1, endpos: end, planeNormal: undefined, allsolid: false, startsolid: false };
    }

    const hitTime = Math.min(...hitTimes);
    const endpos: Vec3 = {
      x: start.x + delta.x * hitTime,
      y: start.y + delta.y * hitTime,
      z: start.z + delta.z * hitTime,
    };

    return { fraction: hitTime, endpos, planeNormal: undefined, allsolid: false, startsolid: false };
  };
}

describe('fixStuckObjectGeneric', () => {
  it('returns good-position when the origin is already free', () => {
    const trace = createTrace([
      { mins: { x: -2, y: -2, z: -2 }, maxs: { x: 2, y: 2, z: 2 } },
    ]);

    const outcome = fixStuckObjectGeneric({
      origin: { x: 64, y: 0, z: 32 },
      mins: BOX_MINS,
      maxs: BOX_MAXS,
      trace,
    });

    expect(outcome.result).toBe('good-position');
    expect(outcome.origin).toEqual({ x: 64, y: 0, z: 32 });
  });

  it('nudges a stuck origin sideways similar to G_FixStuckObject_Generic', () => {
    const obstacles: SolidBox[] = [
      { mins: { x: -1, y: -1, z: -1 }, maxs: { x: 1, y: 1, z: 1 } },
      { mins: { x: -4, y: -4, z: 1 }, maxs: { x: 4, y: 4, z: 6 } },
      { mins: { x: -4, y: -4, z: -6 }, maxs: { x: 4, y: 4, z: -1 } },
    ];
    const trace = createTrace(obstacles);

    const outcome = fixStuckObjectGeneric({
      origin: { x: 0, y: 0, z: 0 },
      mins: BOX_MINS,
      maxs: BOX_MAXS,
      trace,
    });

    expect(outcome.result).toBe('fixed');
    expect(outcome.origin.x).toBeGreaterThan(0);
    expect(outcome.origin.x).toBeCloseTo(8.125, 3);
    expect(outcome.origin.y).toBeCloseTo(0, 5);
    expect(outcome.origin.z).toBeCloseTo(0, 5);
  });

  it('reports no-good-position when fully enclosed', () => {
    const enclosing: SolidBox = {
      mins: { x: -64, y: -64, z: -64 },
      maxs: { x: 64, y: 64, z: 64 },
    };
    const trace = createTrace([enclosing]);

    const outcome = fixStuckObjectGeneric({
      origin: { x: 0, y: 0, z: 0 },
      mins: BOX_MINS,
      maxs: BOX_MAXS,
      trace,
    });

    expect(outcome.result).toBe('no-good-position');
    expect(outcome.origin).toEqual({ x: 0, y: 0, z: 0 });
  });
});
