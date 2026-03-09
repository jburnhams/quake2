import { describe, it, expect } from 'vitest';
import { calculateLightmapSize, generateSamplePoints, toneMapLightmap, packLightmaps } from '../../../src/lighting/lightmap.js';
import type { CompileFace, CompilePlane } from '../../../src/types/compile.js';
import type { BspTexInfo } from '../../../src/types/bsp.js';
import { Vec3, type Winding } from '@quake2ts/shared';
import type { LightSample } from '../../../src/lighting/direct.js';

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

  describe('toneMapLightmap', () => {
    it('correctly clamps values greater than 255 and handles negatives', () => {
      const samples: LightSample[] = [
        { color: { x: 300, y: 150, z: -50 } as Vec3 }
      ];

      const lightmap = toneMapLightmap(samples, 1, 1);

      expect(lightmap.length).toBe(3);
      expect(lightmap[0]).toBe(255); // Clamped upper
      expect(lightmap[1]).toBe(150);
      expect(lightmap[2]).toBe(0);   // Clamped lower
    });

    it('applies exposure multiplier', () => {
      const samples: LightSample[] = [
        { color: { x: 100, y: 100, z: 100 } as Vec3 }
      ];

      const lightmap = toneMapLightmap(samples, 1, 1, 2.0);

      expect(lightmap[0]).toBe(200);
      expect(lightmap[1]).toBe(200);
      expect(lightmap[2]).toBe(200);
    });
  });

  describe('packLightmaps', () => {
    it('assembles continuous data and returns correct offsets', () => {
      const faces = [
        {
          lightmapInfo: { width: 1, height: 1 } as any,
          samples: [{ color: { x: 100, y: 0, z: 0 } as Vec3 }]
        },
        {
          lightmapInfo: { width: 2, height: 1 } as any,
          samples: [
            { color: { x: 0, y: 100, z: 0 } as Vec3 },
            { color: { x: 0, y: 0, z: 100 } as Vec3 }
          ]
        }
      ];

      const packed = packLightmaps(faces);

      // 1 pixel (3 bytes) + 2 pixels (6 bytes) = 9 bytes
      expect(packed.data.length).toBe(9);

      // Face offsets
      expect(packed.faceOffsets).toEqual([0, 3]);

      // Face 1 color check
      expect(packed.data[0]).toBe(100);
      expect(packed.data[1]).toBe(0);
      expect(packed.data[2]).toBe(0);

      // Face 2 color check
      expect(packed.data[3]).toBe(0);
      expect(packed.data[4]).toBe(100);
      expect(packed.data[5]).toBe(0);

      expect(packed.data[6]).toBe(0);
      expect(packed.data[7]).toBe(0);
      expect(packed.data[8]).toBe(100);
    });

    it('skips faces without lightmaps and marks offset as -1', () => {
       const faces = [
        {
          lightmapInfo: { width: 0, height: 0 } as any,
          samples: []
        },
        {
          lightmapInfo: { width: 1, height: 1 } as any,
          samples: [{ color: { x: 255, y: 255, z: 255 } as Vec3 }]
        }
      ];

      const packed = packLightmaps(faces);

      expect(packed.data.length).toBe(3);
      expect(packed.faceOffsets).toEqual([-1, 0]);
    });
  });
});
