import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  traceBox,
  createDefaultTrace,
  enableTraceDebug,
  disableTraceDebug,
  traceDebugInfo,
  CollisionModel,
  CollisionPlane,
  CollisionNode,
  CollisionLeaf,
  CollisionBrush,
  CollisionBrushSide,
  DIST_EPSILON
} from '@quake2ts/shared';
import { Vec3 } from '@quake2ts/shared';

// Helper to create a simple plane
const createPlane = (normal: Vec3, dist: number, type = 0): CollisionPlane => ({
  normal,
  dist,
  type,
  signbits: 0 // Simplified
});

// Helper to create a simple brush from planes
const createBrush = (planes: CollisionPlane[], contents = 1): CollisionBrush => ({
  contents,
  sides: planes.map(p => ({ plane: p, surfaceFlags: 0 })),
  checkcount: 0
});

describe('Advanced Physics Collision', () => {

  describe('Grazing Hits', () => {
    it('should handle traces parallel to a surface without getting stuck', () => {
      // Floor plane at z=0
      const floorPlane = createPlane({ x: 0, y: 0, z: 1 }, 0);
      const brush = createBrush([floorPlane]);

      // Simple model with one brush in a leaf
      const model: CollisionModel = {
        planes: [floorPlane],
        nodes: [],
        leaves: [{
          contents: 0,
          cluster: 0,
          area: 0,
          firstLeafBrush: 0,
          numLeafBrushes: 1
        }],
        brushes: [brush],
        leafBrushes: [0],
        bmodels: []
      };

      // Trace parallel to the floor at z=10, box size 10 (so bottom is at z=0)
      const start: Vec3 = { x: 0, y: 0, z: 10 + DIST_EPSILON * 2 }; // Slightly above
      const end: Vec3 = { x: 100, y: 0, z: 10 + DIST_EPSILON * 2 };
      const mins: Vec3 = { x: -10, y: -10, z: -10 };
      const maxs: Vec3 = { x: 10, y: 10, z: 10 };

      const result = traceBox({
        model,
        start,
        end,
        mins,
        maxs,
        headnode: -1 // Directly check leaf 0
      });

      expect(result.startsolid).toBe(false);
      expect(result.fraction).toBe(1); // Should move full distance parallel
    });

    it('should detect collision when grazing just enters the surface', () => {
       const floorPlane = createPlane({ x: 0, y: 0, z: 1 }, 0);
       const brush = createBrush([floorPlane]);

       const model: CollisionModel = {
         planes: [floorPlane],
         nodes: [],
         leaves: [{
           contents: 0,
           cluster: 0,
           area: 0,
           firstLeafBrush: 0,
           numLeafBrushes: 1
         }],
         brushes: [brush],
         leafBrushes: [0],
         bmodels: []
       };

       // Start above, end slightly below
       const start: Vec3 = { x: 0, y: 0, z: 11 };
       const end: Vec3 = { x: 100, y: 0, z: 9 }; // Should hit floor at z=10 (because box extends 10 down)
       const mins: Vec3 = { x: -10, y: -10, z: -10 };
       const maxs: Vec3 = { x: 10, y: 10, z: 10 };

       const result = traceBox({
         model,
         start,
         end,
         mins,
         maxs,
         headnode: -1
       });

       expect(result.fraction).toBeLessThan(1);
       expect(result.plane?.normal.z).toBe(1);
    });
  });

  describe('Trace Debug Visualization', () => {
    beforeEach(() => {
      disableTraceDebug();
    });

    it('should collect debug info when enabled', () => {
      enableTraceDebug();

      // Dummy model
      const model: CollisionModel = {
        planes: [],
        nodes: [],
        leaves: [{
          contents: 0,
          cluster: 0,
          area: 0,
          firstLeafBrush: 0,
          numLeafBrushes: 0
        }],
        brushes: [],
        leafBrushes: [],
        bmodels: []
      };

      traceBox({
        model,
        start: { x: 0, y: 0, z: 0 },
        end: { x: 10, y: 0, z: 0 },
        headnode: -1
      });

      expect(traceDebugInfo).not.toBeNull();
      // Even with empty model, we check if object exists.
      // If we hit a leaf, leafsReached should increment.
      // Since headnode is -1, it goes straight to leaf 0.
      expect(traceDebugInfo?.leafsReached).toBeGreaterThan(0);

      disableTraceDebug();
      expect(traceDebugInfo).toBeNull();
    });
  });

});
