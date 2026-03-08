import { describe, it, expect } from 'vitest';
import { calculateLightmapSize, generateSamplePoints } from '../../../src/lighting/lightmap.js';
import type { CompileFace, CompilePlane } from '../../../src/types/compile.js';
import type { BspTexInfo } from '../../../src/types/bsp.js';
import { Vec3, type Winding } from '@quake2ts/shared';

describe('lightmap', () => {
  const plane: CompilePlane = {
    normal: { x: 0, y: 0, z: 1 } as Vec3,
    dist: 0,
    type: 2
  };

  const texInfo: BspTexInfo = {
    s: { x: 1, y: 0, z: 0 } as Vec3,
    sOffset: 0,
    t: { x: 0, y: -1, z: 0 } as Vec3,
    tOffset: 0,
    flags: 0,
    value: 0,
    texture: 'test',
    nextTexInfo: -1
  };

  const winding: Winding = {
    points: [
      { x: 0, y: 0, z: 0 } as Vec3,
      { x: 32, y: 0, z: 0 } as Vec3,
      { x: 32, y: 32, z: 0 } as Vec3,
      { x: 0, y: 32, z: 0 } as Vec3
    ],
    numPoints: 4,
    maxPoints: 4
  };

  const face: CompileFace = {
    planeNum: 0,
    texInfo: 0,
    winding,
    contents: 1,
    next: null
  };

  describe('calculateLightmapSize', () => {
    it('calculates correct size for a face', () => {
      const info = calculateLightmapSize(face, texInfo, 16);

      expect(info.luxelSize).toBe(16);

      // S goes 0 to 32 -> min 0, max 2
      // T goes 0 to -32 -> min -2, max 0

      expect(info.mins[0]).toBe(0); // 0 / 16
      expect(info.maxs[0]).toBe(2); // 32 / 16

      expect(info.mins[1]).toBe(-2); // -32 / 16
      expect(info.maxs[1]).toBe(0); // 0 / 16

      expect(info.width).toBe(3); // 0, 1, 2
      expect(info.height).toBe(3); // -2, -1, 0
    });
  });

  describe('generateSamplePoints', () => {
    it('generates points on the face plane', () => {
      const info = calculateLightmapSize(face, texInfo, 16);
      const points = generateSamplePoints(face, info, texInfo, [plane]);

      expect(points.length).toBe(9); // 3x3

      for (const p of points) {
        expect(p.z).toBeCloseTo(0); // All points should be on the Z=0 plane
      }

      // First point (S=0, T=-2) S in [0, 16], T in [-32, -16]
      // Center of that luxel S=8, T=-24
      // px = s
      // py = -t -> py = 24

      const p0 = points[0];
      expect(p0.x).toBeCloseTo(8);
      expect(p0.y).toBeCloseTo(24);
      expect(p0.z).toBeCloseTo(0);
    });
  });
});
