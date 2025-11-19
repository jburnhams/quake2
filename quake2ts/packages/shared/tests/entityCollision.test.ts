import { describe, expect, it } from 'vitest';
import {
  CollisionEntityIndex,
  computePlaneSignBits,
  traceBox,
  type CollisionBrush,
  type CollisionModel,
  type CollisionPlane,
} from '../src/bsp/collision.js';
import { CONTENTS_MONSTER, CONTENTS_SOLID, CONTENTS_TRIGGER } from '../src/bsp/contents.js';
import type { Vec3 } from '../src/math/vec3.js';

function makePlane(normal: Vec3, dist: number, type: number): CollisionPlane {
  return { normal, dist, type, signbits: computePlaneSignBits(normal) };
}

function makeAxisBrush(size: number, contents: number): CollisionBrush {
  const half = size / 2;
  const planes = [
    makePlane({ x: 1, y: 0, z: 0 }, half, 0),
    makePlane({ x: -1, y: 0, z: 0 }, half, 0),
    makePlane({ x: 0, y: 1, z: 0 }, half, 1),
    makePlane({ x: 0, y: -1, z: 0 }, half, 1),
    makePlane({ x: 0, y: 0, z: 1 }, half, 2),
    makePlane({ x: 0, y: 0, z: -1 }, half, 2),
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

describe('CollisionEntityIndex', () => {
  it('prioritizes entity hits that occur before the world brush', () => {
    const world = makeLeafModel([makeAxisBrush(128, CONTENTS_SOLID)]);

    const index = new CollisionEntityIndex();
    index.link({
      id: 7,
      origin: { x: -80, y: 0, z: 0 },
      mins: { x: -8, y: -8, z: -8 },
      maxs: { x: 8, y: 8, z: 8 },
      contents: CONTENTS_SOLID,
    });

    const start = { x: -96, y: 0, z: 0 } satisfies Vec3;
    const end = { x: 96, y: 0, z: 0 } satisfies Vec3;

    const worldOnly = traceBox({ model: world, start, end, headnode: -1 });
    const combined = index.trace({ model: world, start, end, headnode: -1, contentMask: CONTENTS_SOLID });

    expect(combined.entityId).toBe(7);
    expect(combined.fraction).toBeLessThan(worldOnly.fraction);
    expect(combined.plane?.normal).toEqual({ x: -1, y: 0, z: 0 });
  });

  it('skips the pass entity and falls back to world results', () => {
    const world = makeLeafModel([makeAxisBrush(128, CONTENTS_SOLID)]);
    const start = { x: -96, y: 0, z: 0 } satisfies Vec3;
    const end = { x: 96, y: 0, z: 0 } satisfies Vec3;

    const worldOnly = traceBox({ model: world, start, end, headnode: -1 });

    const index = new CollisionEntityIndex();
    index.link({
      id: 2,
      origin: { x: -24, y: 0, z: 0 },
      mins: { x: -8, y: -8, z: -8 },
      maxs: { x: 8, y: 8, z: 8 },
      contents: CONTENTS_SOLID,
    });

    const combined = index.trace({
      model: world,
      start,
      end,
      headnode: -1,
      contentMask: CONTENTS_SOLID,
      passId: 2,
    });

    expect(combined.entityId).toBeNull();
    expect(combined.fraction).toBeCloseTo(worldOnly.fraction);
    expect(combined.plane?.normal).toEqual({ x: -1, y: 0, z: 0 });
  });

  it('respects content masks when considering dynamic entities', () => {
    const world = makeLeafModel([makeAxisBrush(128, CONTENTS_SOLID)]);
    const start = { x: -96, y: 0, z: 0 } satisfies Vec3;
    const end = { x: 96, y: 0, z: 0 } satisfies Vec3;

    const worldOnly = traceBox({ model: world, start, end, headnode: -1 });

    const index = new CollisionEntityIndex();
    index.link({
      id: 3,
      origin: { x: -24, y: 0, z: 0 },
      mins: { x: -8, y: -8, z: -8 },
      maxs: { x: 8, y: 8, z: 8 },
      contents: CONTENTS_TRIGGER,
    });

    const combined = index.trace({ model: world, start, end, headnode: -1, contentMask: CONTENTS_SOLID });

    expect(combined.entityId).toBeNull();
    expect(combined.fraction).toBeCloseTo(worldOnly.fraction);
  });

  it('propagates startsolid state when beginning inside an entity volume', () => {
    const world = makeLeafModel([makeAxisBrush(256, CONTENTS_SOLID)]);
    const start = { x: 0, y: 0, z: 0 } satisfies Vec3;
    const end = { x: 64, y: 0, z: 0 } satisfies Vec3;

    const index = new CollisionEntityIndex();
    index.link({
      id: 11,
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -16 },
      maxs: { x: 16, y: 16, z: 16 },
      contents: CONTENTS_MONSTER,
    });

    const combined = index.trace({ model: world, start, end, headnode: -1, contentMask: CONTENTS_MONSTER });

    expect(combined.entityId).toBe(11);
    expect(combined.startsolid).toBe(true);
    expect(combined.allsolid).toBe(false);
  });

  it('reports trigger overlaps without including non-trigger entities', () => {
    const index = new CollisionEntityIndex();
    index.link({
      id: 1,
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -16 },
      maxs: { x: 16, y: 16, z: 16 },
      contents: CONTENTS_TRIGGER,
    });
    index.link({
      id: 2,
      origin: { x: 128, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -16 },
      maxs: { x: 16, y: 16, z: 16 },
      contents: CONTENTS_SOLID,
    });

    const touching = index.gatherTriggerTouches({ x: 0, y: 0, z: 0 }, { x: -8, y: -8, z: -8 }, { x: 8, y: 8, z: 8 });

    expect(touching).toEqual([1]);
  });
});
