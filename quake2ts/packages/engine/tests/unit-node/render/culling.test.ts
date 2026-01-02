import { describe, it, expect } from 'vitest';
import { transformAabb } from '../../../src/render/culling.js';
import { Mat4 } from '@quake2ts/shared';

describe('culling', () => {
  describe('transformAabb', () => {
    it('should transform an AABB by identity matrix', () => {
      const mins = { x: -1, y: -1, z: -1 };
      const maxs = { x: 1, y: 1, z: 1 };
      const transform: Mat4 = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ];

      const result = transformAabb(mins, maxs, transform);

      expect(result.mins).toEqual(mins);
      expect(result.maxs).toEqual(maxs);
    });

    it('should transform an AABB by translation', () => {
      const mins = { x: -1, y: -1, z: -1 };
      const maxs = { x: 1, y: 1, z: 1 };
      const transform: Mat4 = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        10, 20, 30, 1
      ];

      const result = transformAabb(mins, maxs, transform);

      expect(result.mins).toEqual({ x: 9, y: 19, z: 29 });
      expect(result.maxs).toEqual({ x: 11, y: 21, z: 31 });
    });

    it('should transform an AABB by rotation (90 degrees around Z)', () => {
      const mins = { x: -1, y: -2, z: -3 };
      const maxs = { x: 1, y: 2, z: 3 };
      // Rotate 90 deg around Z: x -> y, y -> -x
      // New basis X: (0, 1, 0)
      // New basis Y: (-1, 0, 0)
      // New basis Z: (0, 0, 1)
      const transform: Mat4 = [
        0, 1, 0, 0,
        -1, 0, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ];

      const result = transformAabb(mins, maxs, transform);

      // Original extents: x=1, y=2, z=3
      // New extents should be: x=2, y=1, z=3 (since x and y swapped axes)
      // Center is at 0,0,0

      expect(result.mins.x).toBeCloseTo(-2);
      expect(result.maxs.x).toBeCloseTo(2);
      expect(result.mins.y).toBeCloseTo(-1);
      expect(result.maxs.y).toBeCloseTo(1);
      expect(result.mins.z).toBeCloseTo(-3);
      expect(result.maxs.z).toBeCloseTo(3);
    });

    it('should transform an AABB with scaling', () => {
        const mins = { x: 0, y: 0, z: 0 };
        const maxs = { x: 1, y: 1, z: 1 };
        const transform: Mat4 = [
            2, 0, 0, 0,
            0, 3, 0, 0,
            0, 0, 4, 0,
            0, 0, 0, 1
        ];

        const result = transformAabb(mins, maxs, transform);

        // Center: 0.5, 0.5, 0.5 -> Scaled: 1, 1.5, 2
        // Extents: 0.5, 0.5, 0.5 -> Scaled: 1, 1.5, 2
        // Mins: 0, 0, 0
        // Maxs: 2, 3, 4

        expect(result.mins).toEqual({ x: 0, y: 0, z: 0 });
        expect(result.maxs).toEqual({ x: 2, y: 3, z: 4 });
    });
  });
});
