import { createVector3 } from '@quake2ts/test-utils';
import { describe, it, expect } from 'vitest';
import { calculateLightmapSize, generateSamplePoints, toneMapLightmap, packLightmaps } from '../../../src/lighting/lightmap.js';
import type { CompileFace, CompilePlane } from '../../../src/types/compile.js';
import type { BspTexInfo } from '../../../src/types/bsp.js';
import { Vec3, type Winding } from '@quake2ts/shared';
import type { LightSample } from '../../../src/lighting/direct.js';

describe('lightmap', () => {
  const plane: CompilePlane = {
    normal: createVector3(0, 0, 1),
    dist: 0,
    type: 2
  };

  const texInfo: BspTexInfo = {
    s: createVector3(1, 0, 0),
    sOffset: 0,
    t: createVector3(0, -1, 0),
    tOffset: 0,
    flags: 0,
    value: 0,
    texture: 'test',
    nextTexInfo: -1
  };

  const winding: Winding = {
    points: [
      createVector3(0, 0, 0),
      createVector3(32, 0, 0),
      createVector3(32, 32, 0),
      createVector3(0, 32, 0)
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
        { color: createVector3(300, 150, -50) }
      ];

      const lightmap = toneMapLightmap(samples, 1, 1);

      expect(lightmap.length).toBe(3);
      expect(lightmap[0]).toBe(255); // Clamped upper
      expect(lightmap[1]).toBe(150);
      expect(lightmap[2]).toBe(0);   // Clamped lower
    });

    it('applies exposure multiplier', () => {
      const samples: LightSample[] = [
        { color: createVector3(100, 100, 100) }
      ];

      const lightmap = toneMapLightmap(samples, 1, 1, 2.0);

      expect(lightmap[0]).toBe(200);
      expect(lightmap[1]).toBe(200);
      expect(lightmap[2]).toBe(200);
    });
  });

  describe('packLightmaps', () => {
    it('assembles continuous data and returns correct offsets', () => {
      const samplesMap1 = new Map<number, LightSample[]>();
      samplesMap1.set(0, [{ color: createVector3(100, 0, 0) }]);

      const samplesMap2 = new Map<number, LightSample[]>();
      samplesMap2.set(0, [
        { color: createVector3(0, 100, 0) },
        { color: createVector3(0, 0, 100) }
      ]);

      const faces = [
        {
          lightmapInfo: { width: 1, height: 1 } as any,
          samplesByStyle: samplesMap1
        },
        {
          lightmapInfo: { width: 2, height: 1 } as any,
          samplesByStyle: samplesMap2
        }
      ];

      const packed = packLightmaps(faces);

      // 1 pixel (3 bytes) + 2 pixels (6 bytes) = 9 bytes
      expect(packed.data.length).toBe(9);

      // Face offsets
      expect(packed.faceOffsets).toEqual([0, 3]);

      // Face styles
      expect(packed.faceStyles[0]).toEqual([0, 255, 255, 255]);
      expect(packed.faceStyles[1]).toEqual([0, 255, 255, 255]);

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
       const samplesMap2 = new Map<number, LightSample[]>();
       samplesMap2.set(0, [{ color: createVector3(255, 255, 255) }]);

       const faces = [
        {
          lightmapInfo: { width: 0, height: 0 } as any,
          samplesByStyle: new Map()
        },
        {
          lightmapInfo: { width: 1, height: 1 } as any,
          samplesByStyle: samplesMap2
        }
      ];

      const packed = packLightmaps(faces);

      expect(packed.data.length).toBe(3);
      expect(packed.faceOffsets).toEqual([-1, 0]);
    });
  });
});
