import { createVector3 } from '@quake2ts/test-utils';
import { describe, it, expect } from 'vitest';
import { traceRay, isInShadow } from '../../../src/lighting/trace.js';
import type { Light } from '../../../src/lighting/lights.js';
import type { TreeElement, TreeNode, TreeLeaf } from '../../../src/compiler/tree.js';
import type { CompilePlane } from '../../../src/types/compile.js';
import { CONTENTS_SOLID, CONTENTS_EMPTY, type Vec3, createEmptyBounds3 } from '@quake2ts/shared';

describe('trace', () => {
  // Simple BSP Tree for testing
  // Plane 0: X = 0 (normal: [1, 0, 0], dist: 0)
  // Left child (X >= 0): EMPTY
  // Right child (X < 0): SOLID
  const testPlanes: CompilePlane[] = [
    {
      normal: createVector3(1, 0, 0),
      dist: 0,
      type: 0 // PLANE_X
    }
  ];

  const emptyLeaf: TreeLeaf = {
    contents: CONTENTS_EMPTY,
    brushes: [],
    bounds: createEmptyBounds3()
  };

  const solidLeaf: TreeLeaf = {
    contents: CONTENTS_SOLID,
    brushes: [],
    bounds: createEmptyBounds3()
  };

  const testTree: TreeNode = {
    planeNum: 0,
    children: [emptyLeaf, solidLeaf], // Front (X>=0) is empty, Back (X<0) is solid
    bounds: createEmptyBounds3()
  };

  describe('traceRay', () => {
    it('returns no hit when ray is entirely in empty space', () => {
      const start = createVector3(10, 0, 0);
      const end = createVector3(5, 0, 0);
      const result = traceRay(start, end, testTree, testPlanes);

      expect(result.hit).toBe(false);
      expect(result.fraction).toBe(1.0);
    });

    it('returns hit when ray goes into solid', () => {
      const start = createVector3(10, 0, 0);
      const end = createVector3(-10, 0, 0);
      const result = traceRay(start, end, testTree, testPlanes);

      expect(result.hit).toBe(true);
      expect(result.fraction).toBeCloseTo(0.5); // Starts at 10, ends at -10, hits plane at 0, which is exactly halfway
      expect(result.hitContents).toBe(CONTENTS_SOLID);
      expect(result.hitPoint?.x).toBeCloseTo(0);
      expect(result.hitNormal).toEqual(createVector3(1, 0, 0)); // Hit the front side
    });

    it('returns hit immediately if starting in solid', () => {
      const start = createVector3(-5, 0, 0);
      const end = createVector3(-10, 0, 0);
      const result = traceRay(start, end, testTree, testPlanes);

      expect(result.hit).toBe(true);
      expect(result.fraction).toBe(0.0);
      expect(result.hitContents).toBe(CONTENTS_SOLID);
    });
  });

  describe('isInShadow', () => {
    it('returns false when ray to light passes through empty space', () => {
      const point = createVector3(5, 0, 0);
      const light: Light = {
        type: 'point',
        origin: createVector3(10, 0, 0),
        intensity: 300,
        color: createVector3(1, 1, 1)
      };

      const shadow = isInShadow(point, light, testTree, testPlanes);
      expect(shadow).toBe(false);
    });

    it('returns true when shadow ray is blocked by solid', () => {
      const point = createVector3(5, 0, 0);
      const light: Light = {
        type: 'point',
        origin: createVector3(-5, 0, 0), // Light is inside solid
        intensity: 300,
        color: createVector3(1, 1, 1)
      };

      const shadow = isInShadow(point, light, testTree, testPlanes);
      expect(shadow).toBe(true);
    });
  });
});
