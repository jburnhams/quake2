import { describe, expect, it } from 'vitest';
import { traceBox } from '../../../src/bsp/collision.js';
import { makeBrushFromMinsMaxs, makeLeaf, makePlane, makeNode, makeBspModel, makeAxisBrush, makeLeafModel } from '@quake2ts/test-utils';

describe('traceBox solid and contained cases', () => {
  it('should correctly identify a trace that starts inside a solid', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    // A trace that starts inside the brush and ends outside
    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 64, y: 0, z: 0 };

    const result = traceBox({ model, start, end, headnode: -1 });

    expect(result.startsolid).toBe(true);
    expect(result.allsolid).toBe(false);
    expect(result.fraction).toBe(0);
  });

  it('should correctly identify a trace that starts and ends inside a solid', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    // A trace that starts and ends inside the brush
    const start = { x: -16, y: 0, z: 0 };
    const end = { x: 16, y: 0, z: 0 };

    const result = traceBox({ model, start, end, headnode: -1 });

    expect(result.startsolid).toBe(true);
    expect(result.allsolid).toBe(true);
    expect(result.fraction).toBe(0);
  });

  it('should handle a zero-length trace that is inside a solid', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    // A zero-length trace inside the brush
    const point = { x: 0, y: 0, z: 0 };

    const result = traceBox({ model, start: point, end: point, headnode: -1 });

    expect(result.startsolid).toBe(true);
    expect(result.allsolid).toBe(true);
    expect(result.fraction).toBe(0);
  });

  it('should handle a zero-length trace that is outside any solids', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    // A zero-length trace outside the brush
    const point = { x: -128, y: 0, z: 0 };

    const result = traceBox({ model, start: point, end: point, headnode: -1 });

    expect(result.startsolid).toBe(false);
    expect(result.allsolid).toBe(false);
    expect(result.fraction).toBe(1);
  });
});
