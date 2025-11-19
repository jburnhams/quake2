import { describe, expect, it } from 'vitest';
import {
  DIST_EPSILON,
  PlaneSide,
  buildCollisionModel,
  boxOnPlaneSide,
  clipBoxToBrush,
  computePlaneSignBits,
  createDefaultTrace,
  pointInsideBrush,
  pointOnPlaneSide,
  testBoxInBrush,
  type CollisionBrush,
  type CollisionLumpData,
  type CollisionPlane,
} from '../src/bsp/collision.js';
import { CONTENTS_SOLID } from '../src/bsp/contents.js';
import type { Vec3 } from '../src/math/vec3.js';

function makePlane(normal: Vec3, dist: number): CollisionPlane {
  return {
    normal,
    dist,
    type: Math.abs(normal.x) === 1 ? 0 : Math.abs(normal.y) === 1 ? 1 : Math.abs(normal.z) === 1 ? 2 : 3,
    signbits: computePlaneSignBits(normal),
  };
}

function makeAxisBrush(size: number, contents = CONTENTS_SOLID): CollisionBrush {
  const half = size / 2;
  const planes = [
    makePlane({ x: 1, y: 0, z: 0 }, half),
    makePlane({ x: -1, y: 0, z: 0 }, half),
    makePlane({ x: 0, y: 1, z: 0 }, half),
    makePlane({ x: 0, y: -1, z: 0 }, half),
    makePlane({ x: 0, y: 0, z: 1 }, half),
    makePlane({ x: 0, y: 0, z: -1 }, half),
  ];

  return {
    contents,
    sides: planes.map((plane) => ({ plane, surfaceFlags: 0 })),
  };
}

describe('plane classification', () => {
  it('computes signbits consistently with Quake II cmodel helpers', () => {
    expect(computePlaneSignBits({ x: 1, y: 0, z: 0 })).toBe(0);
    expect(computePlaneSignBits({ x: -1, y: -1, z: 0 })).toBe(3);
    expect(computePlaneSignBits({ x: -0.2, y: 0.1, z: -1 })).toBe(5);
  });

  it('classifies points against planes with epsilon tolerance', () => {
    const plane = makePlane({ x: 1, y: 0, z: 0 }, 0);

    expect(pointOnPlaneSide(plane, { x: 1, y: 0, z: 0 }, 0.01)).toBe(PlaneSide.FRONT);
    expect(pointOnPlaneSide(plane, { x: -2, y: 0, z: 0 }, 0.01)).toBe(PlaneSide.BACK);
    expect(pointOnPlaneSide(plane, { x: 0.005, y: 0, z: 0 }, 0.01)).toBe(PlaneSide.CROSS);
  });

  it('performs BOX_ON_PLANE_SIDE style tests for all signbit combinations', () => {
    const plane = makePlane({ x: 0.5, y: -0.5, z: 0.5 }, 0);
    const mins = { x: -8, y: -8, z: -8 } satisfies Vec3;
    const maxs = { x: 8, y: 8, z: 8 } satisfies Vec3;

    expect(boxOnPlaneSide(mins, maxs, plane)).toBe(PlaneSide.CROSS);
    expect(boxOnPlaneSide({ x: 9, y: 9, z: 9 }, { x: 12, y: 12, z: 12 }, plane)).toBe(PlaneSide.FRONT);
    expect(boxOnPlaneSide({ x: -12, y: -12, z: -12 }, { x: -9, y: -9, z: -9 }, plane)).toBe(PlaneSide.BACK);
  });
});

describe('brush tests', () => {
  it('detects whether a point lies inside all brush planes', () => {
    const brush = makeAxisBrush(32);

    expect(pointInsideBrush({ x: 0, y: 0, z: 0 }, brush, DIST_EPSILON)).toBe(true);
    expect(pointInsideBrush({ x: 15.99, y: 0, z: 0 }, brush, DIST_EPSILON)).toBe(true);
    expect(pointInsideBrush({ x: 16.1, y: 0, z: 0 }, brush, DIST_EPSILON)).toBe(false);
  });

  it('matches CM_TestBoxInBrush semantics for axis-aligned boxes', () => {
    const brush = makeAxisBrush(64);

    const inside = testBoxInBrush({ x: 0, y: 0, z: 0 }, { x: -16, y: -16, z: -16 }, { x: 16, y: 16, z: 16 }, brush);
    expect(inside.startsolid).toBe(true);
    expect(inside.allsolid).toBe(true);
    expect(inside.contents).toBe(CONTENTS_SOLID);

    const touching = testBoxInBrush({ x: 48, y: 0, z: 0 }, { x: -16, y: -16, z: -16 }, { x: 16, y: 16, z: 16 }, brush);
    expect(touching.startsolid).toBe(true);
    expect(touching.allsolid).toBe(true);
    expect(touching.contents).toBe(CONTENTS_SOLID);

    const outside = testBoxInBrush({ x: 96, y: 0, z: 0 }, { x: -16, y: -16, z: -16 }, { x: 16, y: 16, z: 16 }, brush);
    expect(outside.startsolid).toBe(false);
    expect(outside.allsolid).toBe(false);
    expect(outside.contents).toBe(0);
  });

  it('mirrors CM_ClipBoxToBrush entry and solid-state handling', () => {
    const brush = makeAxisBrush(64);

    const trace = createDefaultTrace();
    clipBoxToBrush({ start: { x: -64, y: 0, z: 0 }, end: { x: 64, y: 0, z: 0 }, mins: { x: 0, y: 0, z: 0 }, maxs: { x: 0, y: 0, z: 0 }, brush, trace });

    expect(trace.startsolid).toBe(false);
    expect(trace.allsolid).toBe(false);
    expect(trace.contents).toBe(CONTENTS_SOLID);
    expect(trace.surfaceFlags).toBe(0);
    expect(trace.plane?.normal).toEqual({ x: -1, y: 0, z: 0 });
    expect(trace.fraction).toBeCloseTo((32 - DIST_EPSILON) / 128, 6);

    const insideTrace = createDefaultTrace();
    clipBoxToBrush({ start: { x: 0, y: 0, z: 0 }, end: { x: 64, y: 0, z: 0 }, mins: { x: 0, y: 0, z: 0 }, maxs: { x: 0, y: 0, z: 0 }, brush, trace: insideTrace });

    expect(insideTrace.startsolid).toBe(true);
    expect(insideTrace.allsolid).toBe(false);
    expect(insideTrace.fraction).toBe(1);
  });
});

describe('BSP collision model construction', () => {
  it('threads lump arrays into brush/plane/leaf references', () => {
    const lumpData: CollisionLumpData = {
      planes: [
        { normal: { x: 1, y: 0, z: 0 }, dist: 16, type: 0 },
        { normal: { x: -1, y: 0, z: 0 }, dist: 16, type: 0 },
        { normal: { x: 0, y: 1, z: 0 }, dist: 16, type: 1 },
        { normal: { x: 0, y: -1, z: 0 }, dist: 16, type: 1 },
        { normal: { x: 0, y: 0, z: 1 }, dist: 16, type: 2 },
        { normal: { x: 0, y: 0, z: -1 }, dist: 16, type: 2 },
      ],
      nodes: [],
      leaves: [{ contents: CONTENTS_SOLID, cluster: 1, area: 2, firstLeafBrush: 0, numLeafBrushes: 1 }],
      brushes: [{ firstSide: 0, numSides: 6, contents: CONTENTS_SOLID }],
      brushSides: [
        { planenum: 0, surfaceFlags: 0 },
        { planenum: 1, surfaceFlags: 0 },
        { planenum: 2, surfaceFlags: 0 },
        { planenum: 3, surfaceFlags: 0 },
        { planenum: 4, surfaceFlags: 0 },
        { planenum: 5, surfaceFlags: 0 },
      ],
      leafBrushes: [0],
      bmodels: [{ mins: { x: -16, y: -16, z: -16 }, maxs: { x: 16, y: 16, z: 16 }, origin: { x: 0, y: 0, z: 0 }, headnode: -1 }],
    };

    const model = buildCollisionModel(lumpData);

    expect(model.planes).toHaveLength(6);
    expect(model.planes[0].signbits).toBe(0);
    expect(model.planes[1].signbits).toBe(1);

    expect(model.brushes).toHaveLength(1);
    expect(model.brushes[0].sides).toHaveLength(6);
    expect(model.brushes[0].sides[0].plane).toBe(model.planes[0]);

    expect(model.leaves[0].firstLeafBrush).toBe(0);
    expect(model.leafBrushes).toEqual([0]);
    expect(model.bmodels[0].headnode).toBe(-1);
  });
});
