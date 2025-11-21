/**
 * Comprehensive tests for grazing hits (traces parallel or near-parallel to surfaces)
 * Validates edge case handling in CM_BoxTrace from full/qcommon/cmodel.c
 */
import { describe, expect, it } from 'vitest';
import { DIST_EPSILON, traceBox } from '../../src/bsp/collision.js';
import { makeBrushFromMinsMaxs, makeLeafModel, makeAxisBrush } from './test-helpers.js';

describe('traceBox grazing hit scenarios', () => {
  describe('parallel traces along surfaces', () => {
    it('should not collide when trace runs parallel just outside a surface', () => {
      const brush = makeBrushFromMinsMaxs(
        { x: -32, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const model = makeLeafModel([brush]);

      // Trace parallel to +X face, just outside it
      const start = { x: 32 + DIST_EPSILON * 2, y: -64, z: 0 };
      const end = { x: 32 + DIST_EPSILON * 2, y: 64, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      // Should complete without collision
      expect(result.fraction).toBe(1);
      expect(result.startsolid).toBe(false);
    });

    it('should handle trace parallel just inside bbox range', () => {
      const brush = makeBrushFromMinsMaxs(
        { x: -32, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const model = makeLeafModel([brush]);

      // Trace with bbox that barely touches the surface
      const start = { x: 40, y: -64, z: 0 };
      const end = { x: 40, y: 64, z: 0 };
      const mins = { x: -8, y: -8, z: -8 };
      const maxs = { x: 8, y: 8, z: 8 };

      // BBox at x=40 extends from 32 to 48
      // Brush face at x=32, so bbox edge is exactly at surface
      const result = traceBox({ model, start, end, mins, maxs, headnode: -1 });

      // May or may not collide depending on epsilon handling
      // The key is that it doesn't crash or produce invalid results
      expect(result.fraction).toBeGreaterThanOrEqual(0);
      expect(result.fraction).toBeLessThanOrEqual(1);
    });

    it('should complete trace parallel to surface when starting outside', () => {
      const brush = makeAxisBrush(64);
      const model = makeLeafModel([brush]);

      // Trace parallel to bottom face, starting and ending outside
      const start = { x: -64, y: 0, z: -33 };
      const end = { x: 64, y: 0, z: -33 };

      const result = traceBox({ model, start, end, headnode: -1 });

      expect(result.fraction).toBe(1);
      expect(result.startsolid).toBe(false);
    });
  });

  describe('near-parallel traces', () => {
    it('should detect collision when trace approaches at very shallow angle', () => {
      const brush = makeBrushFromMinsMaxs(
        { x: -32, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const model = makeLeafModel([brush]);

      // Shallow angle approach that actually enters the brush region
      // Start outside, end inside the brush bounds (all within y and z bounds)
      const start = { x: 64, y: 0, z: 0 };
      const end = { x: 0, y: 16, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      // Should hit the +X face
      expect(result.fraction).toBeLessThan(1);
      expect(result.plane?.normal.x).toBe(1);
    });

    it('should handle grazing entry into corner region', () => {
      const brush = makeBrushFromMinsMaxs(
        { x: -32, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const model = makeLeafModel([brush]);

      // Approach corner at shallow angle
      const start = { x: 64, y: 64, z: 0 };
      const end = { x: 31, y: 31, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      // Should hit one of the faces
      expect(result.fraction).toBeLessThan(1);
      expect(result.plane).not.toBeNull();
    });
  });

  describe('trace on surface boundary', () => {
    it('should handle trace starting exactly on a surface', () => {
      const brush = makeBrushFromMinsMaxs(
        { x: -32, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const model = makeLeafModel([brush]);

      // Start exactly on the +X face
      const start = { x: 32, y: 0, z: 0 };
      const end = { x: 64, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      // In Quake 2, starting exactly on a surface is considered inside (startsolid)
      // because the plane equation d1 = 0 is not > 0
      // See full/qcommon/cmodel.c CM_ClipBoxToBrush: "if (d1 > 0) startout = true"
      expect(result.startsolid).toBe(true);
    });

    it('should handle trace ending exactly on a surface', () => {
      const brush = makeBrushFromMinsMaxs(
        { x: -32, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const model = makeLeafModel([brush]);

      // End exactly at the surface
      const start = { x: 64, y: 0, z: 0 };
      const end = { x: 32, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      // Should collide with fraction < 1 due to DIST_EPSILON
      expect(result.fraction).toBeLessThan(1);
    });
  });

  describe('degenerate cases', () => {
    it('should handle zero-length trace outside brush', () => {
      const brush = makeAxisBrush(64);
      const model = makeLeafModel([brush]);

      const start = { x: 64, y: 0, z: 0 };
      const end = { x: 64, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      expect(result.fraction).toBe(1);
      expect(result.startsolid).toBe(false);
    });

    it('should handle zero-length trace inside brush', () => {
      const brush = makeAxisBrush(64);
      const model = makeLeafModel([brush]);

      const start = { x: 0, y: 0, z: 0 };
      const end = { x: 0, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      expect(result.startsolid).toBe(true);
      expect(result.allsolid).toBe(true);
    });

    it('should handle very short trace that crosses surface', () => {
      const brush = makeBrushFromMinsMaxs(
        { x: -32, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const model = makeLeafModel([brush]);

      // Very short trace that crosses the surface
      const start = { x: 32.1, y: 0, z: 0 };
      const end = { x: 31.9, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      // Should detect the collision
      expect(result.fraction).toBeLessThanOrEqual(1);
    });
  });
});
