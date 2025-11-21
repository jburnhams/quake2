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
} from '../../src/bsp/collision.js';
import { CONTENTS_SOLID, CONTENTS_WATER } from '../../src/bsp/contents.js';
import type { Vec3 } from '../../src/math/vec3.js';

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

describe('traceBox', () => {
	it('should not collide with a brush that is not in the path of the trace', () => {
		const brush = makeAxisBrush(64);
		const model = makeLeafModel([brush]);

		const start = { x: -128, y: 0, z: 0 };
		const end = { x: -96, y: 0, z: 0 };

		const result = traceBox({ model, start, end, headnode: -1 });

		expect(result.fraction).toBe(1);
		expect(result.startsolid).toBe(false);
		expect(result.allsolid).toBe(false);
	});

	it('should collide with a brush that is in the path of the trace', () => {
		const brush = makeAxisBrush(64);
		const model = makeLeafModel([brush]);

		const start = { x: -64, y: 0, z: 0 };
		const end = { x: 64, y: 0, z: 0 };

		const result = traceBox({ model, start, end, headnode: -1 });

		expect(result.fraction).toBeLessThan(1);
		expect(result.startsolid).toBe(false);
		expect(result.allsolid).toBe(false);
		expect(result.endpos.x).toBeCloseTo(-32, 1);
	});

	it('should handle traces that start inside a solid and end outside', () => {
		const brush = makeAxisBrush(64);
		const model = makeLeafModel([brush]);

		const start = { x: 0, y: 0, z: 0 };
		const end = { x: 64, y: 0, z: 0 };

		const result = traceBox({ model, start, end, headnode: -1 });

		expect(result.startsolid).toBe(true);
		expect(result.allsolid).toBe(false);
		expect(result.fraction).toBe(0);
	});

	it('should handle traces that start and end inside a solid', () => {
		const brush = makeAxisBrush(64);
		const model = makeLeafModel([brush]);

		const start = { x: 0, y: 0, z: 0 };
		const end = { x: 16, y: 0, z: 0 };

		const result = traceBox({ model, start, end, headnode: -1 });

		expect(result.startsolid).toBe(true);
		expect(result.allsolid).toBe(true);
		expect(result.fraction).toBe(0);
	});

	it('should handle grazing traces that run parallel to a surface', () => {
		const brush = makeAxisBrush(64);
		const model = makeLeafModel([brush]);

		// A trace starting just above the brush, moving parallel to the top surface
		const start = { x: -64, y: 0, z: 32.1 };
		const end = { x: 64, y: 0, z: 32.1 };

		const result = traceBox({ model, start, end, headnode: -1 });

		expect(result.fraction).toBe(1);
		expect(result.startsolid).toBe(false);
		expect(result.allsolid).toBe(false);
	});

	it('should collide with the corner of a brush', () => {
		const brush = makeAxisBrush(64);
		const model = makeLeafModel([brush]);

		// A trace heading towards the corner at (32, 32, 32) from (64, 64, 64).
		// The collision logic uses an epsilon to prevent floating-point errors,
		// so the actual collision will be slightly before the geometric intersection.
		const start = { x: 64, y: 64, z: 64 };
		const end = { x: 0, y: 0, z: 0 };

		const result = traceBox({ model, start, end, headnode: -1 });

		const travel = start.x - end.x; // 64
		const distToBrush = start.x - 32; // 32
		const expectedFraction = (distToBrush - DIST_EPSILON) / travel;


		expect(result.fraction).toBeCloseTo(expectedFraction, 8);
		expect(result.startsolid).toBe(false);
		expect(result.allsolid).toBe(false);
	});
});
