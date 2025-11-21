/**
 * Tests for corner collision scenarios
 * Validates behavior matching full/qcommon/cmodel.c CM_BoxTrace
 */
import { describe, expect, it } from 'vitest';
import { traceBox } from '../../src/bsp/collision.js';
import { makeBrushFromMinsMaxs, makeLeaf, makeLeafModel, makePlane, makeNode, makeBspModel } from './test-helpers.js';
import { CONTENTS_SOLID } from '../../src/bsp/contents.js';

describe('traceBox corner collisions', () => {
  describe('external corners (convex geometry)', () => {
    it('should collide with the nearest face when hitting an external corner diagonally', () => {
      // A box brush at origin, trace diagonally toward corner
      const brush = makeBrushFromMinsMaxs(
        { x: -32, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const model = makeLeafModel([brush]);

      // Trace diagonally toward the corner where +X and +Y faces meet
      const start = { x: 64, y: 64, z: 0 };
      const end = { x: 0, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      // Should hit before reaching the center
      expect(result.fraction).toBeLessThan(1);
      expect(result.fraction).toBeGreaterThan(0);
      // The hit plane should be one of the faces (+X or +Y)
      expect(result.plane).not.toBeNull();
      if (result.plane) {
        // Either hit +X face (normal 1,0,0) or +Y face (normal 0,1,0)
        const hitX = result.plane.normal.x === 1 && result.plane.normal.y === 0;
        const hitY = result.plane.normal.x === 0 && result.plane.normal.y === 1;
        expect(hitX || hitY).toBe(true);
      }
    });

    it('should collide with the nearest face when hitting a 3D corner', () => {
      // Trace diagonally toward corner where +X, +Y, +Z meet
      const brush = makeBrushFromMinsMaxs(
        { x: -32, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const model = makeLeafModel([brush]);

      const start = { x: 64, y: 64, z: 64 };
      const end = { x: 0, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      expect(result.fraction).toBeLessThan(1);
      expect(result.plane).not.toBeNull();
    });

    it('should find collision when approaching edge between two faces', () => {
      // Trace toward the edge between +X and +Z faces
      const brush = makeBrushFromMinsMaxs(
        { x: -32, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const model = makeLeafModel([brush]);

      const start = { x: 64, y: 0, z: 64 };
      const end = { x: 0, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      expect(result.fraction).toBeLessThan(1);
      expect(result.plane).not.toBeNull();
    });

    it('should report correct fraction for corner approach', () => {
      const brush = makeBrushFromMinsMaxs(
        { x: -16, y: -16, z: -16 },
        { x: 16, y: 16, z: 16 }
      );
      const model = makeLeafModel([brush]);

      // Approach from +X direction only
      const start = { x: 48, y: 0, z: 0 };
      const end = { x: 0, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: -1 });

      // Should hit at x=16 (with epsilon adjustment)
      // Distance traveled = 48 - 16 = 32, total = 48
      // fraction ~= 32/48 = 0.6666...
      expect(result.fraction).toBeGreaterThan(0.6);
      expect(result.fraction).toBeLessThan(0.7);
      expect(result.plane?.normal.x).toBe(1);
    });
  });

  describe('collision with bbox', () => {
    it('should account for trace bbox when hitting corner', () => {
      const brush = makeBrushFromMinsMaxs(
        { x: -16, y: -16, z: -16 },
        { x: 16, y: 16, z: 16 }
      );
      const model = makeLeafModel([brush]);

      const start = { x: 48, y: 0, z: 0 };
      const end = { x: 0, y: 0, z: 0 };
      const mins = { x: -8, y: -8, z: -8 };
      const maxs = { x: 8, y: 8, z: 8 };

      const result = traceBox({ model, start, end, mins, maxs, headnode: -1 });

      // With 8-unit bbox half-width, should hit earlier
      // Brush face at x=16, bbox leading edge at x-8, so hits at x=24
      // fraction ~= (48-24)/48 = 0.5
      expect(result.fraction).toBeLessThan(0.55);
      expect(result.fraction).toBeGreaterThan(0.45);
    });

    it('should detect collision on bbox corner approaching brush corner', () => {
      const brush = makeBrushFromMinsMaxs(
        { x: 0, y: 0, z: -16 },
        { x: 32, y: 32, z: 16 }
      );
      const model = makeLeafModel([brush]);

      // Approach diagonally with a bbox
      const start = { x: -32, y: -32, z: 0 };
      const end = { x: 16, y: 16, z: 0 };
      const mins = { x: -8, y: -8, z: -8 };
      const maxs = { x: 8, y: 8, z: 8 };

      const result = traceBox({ model, start, end, mins, maxs, headnode: -1 });

      // Should collide - bbox corner will hit brush corner
      expect(result.fraction).toBeLessThan(1);
    });
  });
});
