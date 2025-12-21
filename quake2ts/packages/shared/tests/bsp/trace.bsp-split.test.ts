/**
 * Tests for BSP tree traversal where traces split across multiple leaves
 * Validates CM_RecursiveHullCheck behavior from full/qcommon/cmodel.c
 */
import { describe, expect, it } from 'vitest';
import { traceBox } from '../../src/bsp/collision.js';
import { makeBrushFromMinsMaxs, makeLeaf, makePlane, makeNode, makeBspModel, makeAxisBrush, makeLeafModel } from '@quake2ts/test-utils';
import { CONTENTS_SOLID } from '../../src/bsp/contents.js';

describe('traceBox BSP traversal splits', () => {
  describe('trace crossing single split plane', () => {
    it('should find collision in far leaf after crossing split plane', () => {
      // BSP with split at x=0
      // Front leaf (x > 0): empty
      // Back leaf (x < 0): contains brush
      const splitPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
      const brush = makeBrushFromMinsMaxs(
        { x: -64, y: -32, z: -32 },
        { x: -16, y: 32, z: 32 }
      );

      const model = makeBspModel(
        [splitPlane, ...brush.sides.map(s => s.plane)],
        [makeNode(splitPlane, [-1, -2])],  // children[0]=front leaf, children[1]=back leaf
        [
          makeLeaf(0, 0, 0),  // front leaf - no brushes
          makeLeaf(0, 0, 1),  // back leaf - has brush
        ],
        [brush],
        [0]
      );

      // Trace from front to back, should hit the brush
      const start = { x: 32, y: 0, z: 0 };
      const end = { x: -80, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: 0 });

      expect(result.fraction).toBeLessThan(1);
      expect(result.plane?.normal.x).toBe(1);  // Hit the +X face of the brush
    });

    it('should find collision in near leaf before crossing split plane', () => {
      // Split at x=0
      // Front leaf: contains brush at x=16..48
      // Back leaf: empty
      const splitPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
      const brush = makeBrushFromMinsMaxs(
        { x: 16, y: -32, z: -32 },
        { x: 48, y: 32, z: 32 }
      );

      const model = makeBspModel(
        [splitPlane, ...brush.sides.map(s => s.plane)],
        [makeNode(splitPlane, [-1, -2])],
        [
          makeLeaf(0, 0, 1),  // front leaf - has brush
          makeLeaf(0, 0, 0),  // back leaf - no brushes
        ],
        [brush],
        [0]
      );

      // Trace from front to back - should hit brush before reaching split
      const start = { x: 64, y: 0, z: 0 };
      const end = { x: -32, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: 0 });

      expect(result.fraction).toBeLessThan(0.5);  // Should hit early
      expect(result.plane?.normal.x).toBe(1);
    });

    it('should complete trace when path crosses split but no collision', () => {
      // Split at x=0, both leaves empty
      const splitPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);

      const model = makeBspModel(
        [splitPlane],
        [makeNode(splitPlane, [-1, -2])],
        [
          makeLeaf(0, 0, 0),  // front leaf - no brushes
          makeLeaf(0, 0, 0),  // back leaf - no brushes
        ],
        [],
        []
      );

      const start = { x: 32, y: 0, z: 0 };
      const end = { x: -32, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: 0 });

      expect(result.fraction).toBe(1);
      expect(result.startsolid).toBe(false);
    });
  });

  describe('trace crossing multiple split planes', () => {
    it('should traverse 2-level BSP tree and find collision', () => {
      // Two-level BSP:
      // Root split at x=0
      //   Front (x > 0): split at y=0
      //     Front-Front: empty
      //     Front-Back: empty
      //   Back (x < 0): contains brush
      const splitX = makePlane({ x: 1, y: 0, z: 0 }, 0);
      const splitY = makePlane({ x: 0, y: 1, z: 0 }, 0);
      const brush = makeBrushFromMinsMaxs(
        { x: -64, y: -32, z: -32 },
        { x: -16, y: 32, z: 32 }
      );

      const model = makeBspModel(
        [splitX, splitY, ...brush.sides.map(s => s.plane)],
        [
          makeNode(splitX, [1, -1]),      // node 0: root, front->node 1, back->leaf 0
          makeNode(splitY, [-2, -3]),     // node 1: front-child split, front->leaf 1, back->leaf 2
        ],
        [
          makeLeaf(0, 0, 1),  // leaf 0 (back of root): has brush
          makeLeaf(0, 0, 0),  // leaf 1 (front-front): empty
          makeLeaf(0, 0, 0),  // leaf 2 (front-back): empty
        ],
        [brush],
        [0]
      );

      // Trace that crosses multiple regions
      const start = { x: 32, y: 16, z: 0 };
      const end = { x: -80, y: -16, z: 0 };

      const result = traceBox({ model, start, end, headnode: 0 });

      expect(result.fraction).toBeLessThan(1);
      expect(result.plane).not.toBeNull();
    });

    it('should find nearest collision when multiple brushes in different leaves', () => {
      // Two brushes in different leaves, trace should hit nearer one
      const splitPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
      const nearBrush = makeBrushFromMinsMaxs(
        { x: 16, y: -32, z: -32 },
        { x: 32, y: 32, z: 32 }
      );
      const farBrush = makeBrushFromMinsMaxs(
        { x: -64, y: -32, z: -32 },
        { x: -48, y: 32, z: 32 }
      );

      const model = makeBspModel(
        [splitPlane, ...nearBrush.sides.map(s => s.plane), ...farBrush.sides.map(s => s.plane)],
        [makeNode(splitPlane, [-1, -2])],
        [
          makeLeaf(0, 0, 1),  // front leaf - near brush
          makeLeaf(0, 1, 1),  // back leaf - far brush
        ],
        [nearBrush, farBrush],
        [0, 1]
      );

      // Trace from far right to far left
      const start = { x: 64, y: 0, z: 0 };
      const end = { x: -80, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: 0 });

      // Should hit the near brush first
      expect(result.fraction).toBeLessThan(0.5);
      expect(result.endpos.x).toBeGreaterThan(0);  // Should stop in positive x region
    });
  });

  describe('bbox crossing split planes', () => {
    it('should check both children when bbox straddles split plane', () => {
      // Split at x=0, brush on negative side near the split
      const splitPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
      const brush = makeBrushFromMinsMaxs(
        { x: -16, y: -32, z: -32 },
        { x: -4, y: 32, z: 32 }
      );

      const model = makeBspModel(
        [splitPlane, ...brush.sides.map(s => s.plane)],
        [makeNode(splitPlane, [-1, -2])],
        [
          makeLeaf(0, 0, 0),  // front leaf - no brushes
          makeLeaf(0, 0, 1),  // back leaf - has brush
        ],
        [brush],
        [0]
      );

      // Trace centered on split but bbox extends into back region
      const start = { x: 8, y: 0, z: 0 };
      const end = { x: 8, y: 0, z: 0 };  // Zero-length trace
      const mins = { x: -16, y: -8, z: -8 };
      const maxs = { x: 16, y: 8, z: 8 };

      const result = traceBox({ model, start, end, mins, maxs, headnode: 0 });

      // BBox at x=8 extends from -8 to 24, brush is at -16 to -4
      // No overlap, should not be solid
      expect(result.startsolid).toBe(false);
    });

    it('should detect startsolid when bbox overlaps brush across split', () => {
      const splitPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
      const brush = makeBrushFromMinsMaxs(
        { x: -8, y: -32, z: -32 },
        { x: 8, y: 32, z: 32 }
      );

      const model = makeBspModel(
        [splitPlane, ...brush.sides.map(s => s.plane)],
        [makeNode(splitPlane, [-1, -2])],
        [
          makeLeaf(0, 0, 1),  // front leaf - has brush (brush extends into front)
          makeLeaf(0, 0, 1),  // back leaf - has brush (brush extends into back)
        ],
        [brush],
        [0]  // brush 0 is in both leaves
      );

      // Trace origin is inside the brush
      const start = { x: 0, y: 0, z: 0 };
      const end = { x: 32, y: 0, z: 0 };

      const result = traceBox({ model, start, end, headnode: 0 });

      expect(result.startsolid).toBe(true);
    });
  });
});
