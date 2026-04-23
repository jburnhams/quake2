import { createVector3 } from '@quake2ts/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { calculateDirectLight, lightFace } from '../../../src/lighting/direct.js';
import type { Light } from '../../../src/lighting/lights.js';
import type { CompileFace, CompilePlane } from '../../../src/types/compile.js';
import type { TreeElement } from '../../../src/compiler/tree.js';
import type { BspTexInfo } from '../../../src/types/bsp.js';
import { Vec3, CONTENTS_EMPTY, type Winding } from '@quake2ts/shared';

// Mock trace to not block anything for simplicity
vi.mock('../../../src/lighting/trace.js', () => ({
  isInShadow: vi.fn(() => false)
}));

describe('direct lighting', () => {
  const planes: CompilePlane[] = [
    { normal: createVector3(0, 0, 1), dist: 0, type: 2 }
  ];

  const tree: TreeElement = {
    contents: CONTENTS_EMPTY,
    brushes: [],
    bounds: { mins: createVector3(-100, -100, -100), maxs: createVector3(100, 100, 100) }
  };

  describe('calculateDirectLight', () => {
    it('calculates point light contribution correctly', () => {
      const normal = createVector3(0, 0, 1);
      const point = createVector3(0, 0, 0);

      const light: Light = {
        type: 'point',
        origin: createVector3(0, 0, 50), // Directly above
        intensity: 100,
        color: createVector3(1, 1, 1),
        falloff: 'inverse_square'
      };

      const result = calculateDirectLight(point, normal, [light], tree, planes);

      // dist = 50. intensity = 100. scale = 100 / (50*50) = 0.04
      // dot = 1.0 (straight down)
      expect(result.color.x).toBeCloseTo(0.04);
      expect(result.color.y).toBeCloseTo(0.04);
      expect(result.color.z).toBeCloseTo(0.04);
    });

    it('returns zero for lights behind the face', () => {
      const normal = createVector3(0, 0, 1);
      const point = createVector3(0, 0, 0);

      const light: Light = {
        type: 'point',
        origin: createVector3(0, 0, -50), // Below the plane
        intensity: 100,
        color: createVector3(1, 1, 1),
        falloff: 'inverse_square'
      };

      const result = calculateDirectLight(point, normal, [light], tree, planes);

      expect(result.color.x).toBe(0);
      expect(result.color.y).toBe(0);
      expect(result.color.z).toBe(0);
    });
  });

  describe('lightFace', () => {
    it('generates light samples for all pixels', () => {
      const texInfo: BspTexInfo = {
        s: createVector3(1, 0, 0),
        sOffset: 0,
        t: createVector3(0, 1, 0),
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

      const lightmapInfo = {
        width: 3,
        height: 3,
        mins: [0, 0] as [number, number],
        maxs: [2, 2] as [number, number],
        luxelSize: 16
      };

      const light: Light = {
        type: 'point',
        origin: createVector3(16, 16, 64), // Above center of the first luxel/grid
        intensity: 300,
        color: createVector3(1, 1, 1),
        falloff: 'inverse'
      };

      const samples = lightFace(face, lightmapInfo, texInfo, [light], tree, planes);

      expect(samples.length).toBe(9);

      // With the light at 16,16,64 and luxels at (8,8), (24,8) etc.
      // 0,0 luxel is centered at S=8, T=8 (so x=8, y=8).
      // Let's just find the closest sample. Sample at index 0 (x=8, y=8) should be closer than index 8 (x=40, y=40).

      // index 0: s=0, t=0 => S=8, T=8
      // index 4: s=1, t=1 => S=24, T=24
      // index 8: s=2, t=2 => S=40, T=40

      // Light is at 16,16. So distance to 8,8 is same as distance to 24,24.
      // But distance to 40,40 is further.
      const sample0 = samples[0];
      const sample4 = samples[4];
      const sample8 = samples[8];

      expect(sample0.color.x).toBeGreaterThan(sample8.color.x);

      // Alternatively, let's put the light straight over the 0th sample.
      const light2: Light = {
        type: 'point',
        origin: createVector3(8, 8, 64),
        intensity: 300,
        color: createVector3(1, 1, 1),
        falloff: 'inverse'
      };

      const samples2 = lightFace(face, lightmapInfo, texInfo, [light2], tree, planes);
      expect(samples2[0].color.x).toBeGreaterThan(samples2[4].color.x);
    });
  });
});
