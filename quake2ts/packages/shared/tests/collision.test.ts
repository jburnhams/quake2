import { describe, expect, it } from 'vitest';
import {
  DIST_EPSILON,
  PlaneSide,
  buildCollisionModel,
  boxOnPlaneSide,
  boxContents,
  clipBoxToBrush,
  computePlaneSignBits,
  createDefaultTrace,
  pointContents,
  pointInsideBrush,
  pointOnPlaneSide,
  pointContentsMany,
  traceBox,
  testBoxInBrush,
  inPHS,
  inPVS,
  type CollisionBrush,
  type CollisionLumpData,
  type CollisionLeaf,
  type CollisionModel,
  type CollisionPlane,
} from '../src/bsp/collision.js';
import { CONTENTS_SOLID, CONTENTS_WATER } from '../src/bsp/contents.js';
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

function makeLeaf(contents: number, firstLeafBrush: number, numLeafBrushes: number) {
  return { contents, cluster: 0, area: 0, firstLeafBrush, numLeafBrushes };
}

function makeLeafModel(brushes: CollisionBrush[]): CollisionModel {
  const planes = brushes.flatMap((brush) => brush.sides.map((side) => side.plane));

  return {
    planes,
    nodes: [],
    leaves: [makeLeaf(0, 0, brushes.length)],
    brushes,
    leafBrushes: brushes.map((_, i) => i),
    bmodels: [],
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

describe('trace and contents queries', () => {
  it('matches CM_ClipBoxToBrush results when tracing a single-brush leaf', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    const start = { x: -64, y: 0, z: 0 } satisfies Vec3;
    const end = { x: 64, y: 0, z: 0 } satisfies Vec3;

    const referenceTrace = createDefaultTrace();
    clipBoxToBrush({ start, end, mins: { x: 0, y: 0, z: 0 }, maxs: { x: 0, y: 0, z: 0 }, brush, trace: referenceTrace });

    const result = traceBox({ model, start, end, headnode: -1 });

    expect(result.fraction).toBeCloseTo(referenceTrace.fraction, 6);
    expect(result.startsolid).toBe(referenceTrace.startsolid);
    expect(result.allsolid).toBe(referenceTrace.allsolid);
    expect(result.contents).toBe(referenceTrace.contents);
    expect(result.surfaceFlags).toBe(referenceTrace.surfaceFlags);
    expect(result.endpos.x).toBeCloseTo(start.x + (end.x - start.x) * referenceTrace.fraction, 6);
  });

  it('sets startsolid when beginning inside a brush and resolves to the exit plane', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    const start = { x: 0, y: 0, z: 0 } satisfies Vec3;
    const end = { x: 64, y: 0, z: 0 } satisfies Vec3;

    const trace = traceBox({ model, start, end, headnode: -1 });

    expect(trace.startsolid).toBe(true);
    expect(trace.allsolid).toBe(false);
    expect(trace.fraction).toBe(1);
    expect(trace.endpos).toEqual(end);
  });

  it('handles bounding boxes by expanding the plane offsets during traversal', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    const start = { x: -96, y: 0, z: 0 } satisfies Vec3;
    const end = { x: 32, y: 0, z: 0 } satisfies Vec3;
    const mins = { x: -16, y: -16, z: -16 } satisfies Vec3;
    const maxs = { x: 16, y: 16, z: 16 } satisfies Vec3;

    const reference = createDefaultTrace();
    clipBoxToBrush({ start, end, mins, maxs, brush, trace: reference });

    const trace = traceBox({ model, start, end, mins, maxs, headnode: -1 });

    expect(trace.fraction).toBeCloseTo(reference.fraction, 6);
    expect(trace.plane?.normal).toEqual({ x: -1, y: 0, z: 0 });
  });

  it('traverses BSP children to find the first blocking plane', () => {
    const brush = makeAxisBrush(64);
    const planes = brush.sides.map((side) => side.plane);

    const nodes = [{ plane: planes[0], children: [-1, -2] }];

    const leafFront = makeLeaf(0, 0, 1);
    const leafBack = makeLeaf(0, 1, 1);

    const model: CollisionModel = {
      planes,
      nodes,
      leaves: [leafFront, leafBack],
      brushes: [brush],
      leafBrushes: [0, 0],
      bmodels: [],
    };

    const start = { x: 64, y: 0, z: 0 } satisfies Vec3;
    const end = { x: 0, y: 0, z: 0 } satisfies Vec3;

    const trace = traceBox({ model, start, end, headnode: 0 });

    expect(trace.fraction).toBeLessThan(1);
    expect(trace.endpos.x).toBeCloseTo(32 + DIST_EPSILON, 5);
    expect(trace.plane?.normal).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('accumulates contents queries against brush planes for points and boxes', () => {
    const brush = makeAxisBrush(32);
    const model = makeLeafModel([brush]);

    expect(pointContents({ x: 0, y: 0, z: 0 }, model, -1)).toBe(CONTENTS_SOLID);
    expect(pointContents({ x: 40, y: 0, z: 0 }, model, -1)).toBe(0);

    const mins = { x: -8, y: -8, z: -8 } satisfies Vec3;
    const maxs = { x: 8, y: 8, z: 8 } satisfies Vec3;

    expect(boxContents({ x: 0, y: 0, z: 0 }, mins, maxs, model, -1)).toBe(CONTENTS_SOLID);
    expect(boxContents({ x: 48, y: 0, z: 0 }, mins, maxs, model, -1)).toBe(0);
  });

  it('aggregates leaf contents for boxes that span multiple BSP children', () => {
    const partitionPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
    const nodes = [{ plane: partitionPlane, children: [-1, -2] }];

    const frontLeaf = makeLeaf(CONTENTS_WATER, 0, 0);
    const backLeaf = makeLeaf(CONTENTS_SOLID, 0, 0);

    const model: CollisionModel = {
      planes: [partitionPlane],
      nodes,
      leaves: [frontLeaf, backLeaf],
      brushes: [],
      leafBrushes: [],
      bmodels: [],
    };

    const mins = { x: -16, y: -16, z: -16 } satisfies Vec3;
    const maxs = { x: 16, y: 16, z: 16 } satisfies Vec3;

    expect(boxContents({ x: 0, y: 0, z: 0 }, mins, maxs, model, 0)).toBe(CONTENTS_WATER | CONTENTS_SOLID);
    expect(boxContents({ x: 64, y: 0, z: 0 }, mins, maxs, model, 0)).toBe(CONTENTS_WATER);
    expect(boxContents({ x: -64, y: 0, z: 0 }, mins, maxs, model, 0)).toBe(CONTENTS_SOLID);
  });

  it('computes contents per point while sharing trivial brushless leaves', () => {
    const brush = makeAxisBrush(32);
    const partitionPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
    const planes = [partitionPlane, ...brush.sides.map((side) => side.plane)];

    const nodes = [{ plane: partitionPlane, children: [-1, -2] }];
    const leafFront = makeLeaf(CONTENTS_WATER, 0, 0);
    const leafBack = makeLeaf(0, 0, 1);

    const model: CollisionModel = {
      planes,
      nodes,
      leaves: [leafFront, leafBack],
      brushes: [brush],
      leafBrushes: [0],
      bmodels: [],
    };

    const points: Vec3[] = [
      { x: 64, y: 0, z: 0 }, // water leaf with no brushes
      { x: 96, y: 0, z: 0 }, // same water leaf, hits cache
      { x: -8, y: 0, z: 0 }, // solid brush leaf
      { x: -40, y: 0, z: 0 }, // same leaf but outside brush
    ];

    const [waterA, waterB, inside, outside] = pointContentsMany(points, model, 0);
    expect(waterA).toBe(CONTENTS_WATER);
    expect(waterB).toBe(CONTENTS_WATER);
    expect(inside).toBe(CONTENTS_SOLID);
    expect(outside).toBe(0);
  });

  it('propagates leaf contents even when no brushes are present', () => {
    const model: CollisionModel = {
      planes: [],
      nodes: [],
      leaves: [makeLeaf(CONTENTS_SOLID, 0, 0)],
      brushes: [],
      leafBrushes: [],
      bmodels: [],
    };

    const mins = { x: -8, y: -8, z: -8 } satisfies Vec3;
    const maxs = { x: 8, y: 8, z: 8 } satisfies Vec3;

    expect(pointContents({ x: 0, y: 0, z: 0 }, model, -1)).toBe(CONTENTS_SOLID);
    expect(boxContents({ x: 0, y: 0, z: 0 }, mins, maxs, model, -1)).toBe(CONTENTS_SOLID);
  });

  it('handles zero-length traces without losing start/end invariants', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    const start = { x: 0, y: 0, z: 0 } satisfies Vec3;
    const end = { x: 0, y: 0, z: 0 } satisfies Vec3;

    const trace = traceBox({ model, start, end, headnode: -1 });

    expect(trace.startsolid).toBe(true);
    expect(trace.allsolid).toBe(true);
    expect(trace.fraction).toBe(0);
    expect(trace.endpos).toEqual(start);
  });

  it('checks PVS and PHS membership using BSP clusters', () => {
    const plane = makePlane({ x: 1, y: 0, z: 0 }, 0);
    const nodes = [{ plane, children: [-1, -2] }];

    const leafFront = { ...makeLeaf(0, 0, 0), cluster: 0 } satisfies CollisionLeaf;
    const leafBack = { ...makeLeaf(0, 0, 0), cluster: 1 } satisfies CollisionLeaf;

    const visibility = {
      numClusters: 2,
      clusters: [
        { pvs: Uint8Array.from([0b00000011]), phs: Uint8Array.from([0b00000011]) },
        { pvs: Uint8Array.from([0b00000010]), phs: Uint8Array.from([0b00000011]) },
      ],
    };

    const model: CollisionModel = {
      planes: [plane],
      nodes,
      leaves: [leafFront, leafBack],
      brushes: [],
      leafBrushes: [],
      bmodels: [],
      visibility,
    };

    expect(inPVS({ x: 64, y: 0, z: 0 }, { x: -64, y: 0, z: 0 }, model, 0)).toBe(true);
    expect(inPVS({ x: -64, y: 0, z: 0 }, { x: 64, y: 0, z: 0 }, model, 0)).toBe(false);

    expect(inPHS({ x: -64, y: 0, z: 0 }, { x: 64, y: 0, z: 0 }, model, 0)).toBe(true);

    const disconnected: CollisionModel = { ...model, visibility: undefined };
    expect(inPVS({ x: 0, y: 0, z: 0 }, { x: 128, y: 0, z: 0 }, disconnected, 0)).toBe(true);

    const solidLeaf: CollisionModel = {
      ...model,
      leaves: [{ ...leafFront, cluster: -1 }, leafBack],
    };
    expect(inPVS({ x: 64, y: 0, z: 0 }, { x: -64, y: 0, z: 0 }, solidLeaf, 0)).toBe(false);
  });
});
