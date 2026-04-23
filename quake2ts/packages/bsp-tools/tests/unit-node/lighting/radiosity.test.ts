import type { Patch } from '../../../src/lighting/radiosity.js';
import { createVector3 } from '@quake2ts/test-utils';
import { describe, it, expect } from 'vitest';
import { type Vec3, createWinding } from '@quake2ts/shared';
import { createPatches, calculateFormFactor, computeRadiosity } from '../../../src/lighting/radiosity.js';
import type { CompileFace, CompilePlane } from '../../../src/types/compile.js';
import type { TreeElement } from '../../../src/compiler/tree.js';

describe('Radiosity - createPatches', () => {
  it('should subdivide a large face into multiple patches of default size 64', () => {
    // Create a square face of size 128x128 on Z=0 plane
    const w = createWinding(4);
    w.points[0] = createVector3(0, 0, 0);
    w.points[1] = createVector3(128, 0, 0);
    w.points[2] = createVector3(128, 128, 0);
    w.points[3] = createVector3(0, 128, 0);

    const face: CompileFace = {
      planeNum: 0,
      side: 0,
      firstEdge: 0,
      numEdges: 4,
      texInfo: 0,
      winding: w,
      originalFace: 0,
      contents: 0
    };

    const planes: CompilePlane[] = [
      { normal: createVector3(0, 0, 1), dist: 0, type: 2 }
    ];

    const patches = createPatches([face], planes, 64);

    // A 128x128 face split by 64 should yield 4 patches
    expect(patches).toHaveLength(4);

    // Each patch should have an area of 64x64 = 4096
    for (const patch of patches) {
      expect(patch.area).toBeCloseTo(4096, 0);
      expect(patch.normal).toEqual(createVector3(0, 0, 1));
    }
  });

  it('should not subdivide a small face', () => {
    const w = createWinding(4);
    w.points[0] = createVector3(0, 0, 0);
    w.points[1] = createVector3(32, 0, 0);
    w.points[2] = createVector3(32, 32, 0);
    w.points[3] = createVector3(0, 32, 0);

    const face: CompileFace = {
      planeNum: 0,
      side: 0,
      firstEdge: 0,
      numEdges: 4,
      texInfo: 0,
      winding: w,
      originalFace: 0,
      contents: 0
    };

    const planes: CompilePlane[] = [
      { normal: createVector3(0, 0, 1), dist: 0, type: 2 }
    ];

    const patches = createPatches([face], planes, 64);

    // A 32x32 face should not be subdivided
    expect(patches).toHaveLength(1);
    expect(patches[0].area).toBeCloseTo(1024, 0);
  });
});

describe('Radiosity - calculateFormFactor', () => {
  it('should return 0 when patches are facing away from each other', () => {
    // Patches are back-to-back
    const sourcePatch = {
      origin: createVector3(0, 0, 0),
      normal: createVector3(0, 0, -1), // Faces -Z
      area: 64
    };

    const destPatch = {
      origin: createVector3(0, 0, 10),
      normal: createVector3(0, 0, 1), // Faces +Z
      area: 64
    };

    const tree: TreeElement = {
      contents: 0,
      brushes: [],
      bounds: { mins: createVector3(0, 0, 0), maxs: createVector3(0, 0, 0) },
      planeNum: 0,
      children: [
        { contents: 0, brushes: [], bounds: { mins: createVector3(0, 0, 0), maxs: createVector3(0, 0, 0) } },
        { contents: 0, brushes: [], bounds: { mins: createVector3(0, 0, 0), maxs: createVector3(0, 0, 0) } }
      ]
    };

    const planes: CompilePlane[] = [
      { normal: createVector3(1, 0, 0), dist: 0, type: 0 }
    ];

    const ff = calculateFormFactor(sourcePatch as unknown as Patch, destPatch as unknown as Patch, tree, planes);
    expect(ff).toBe(0);
  });

  it('should return 0 when patches are extremely close to avoid math issues', () => {
    const sourcePatch = {
      origin: createVector3(0, 0, 0),
      normal: createVector3(0, 0, 1),
      area: 64
    };

    const destPatch = {
      origin: createVector3(0, 0, 0.5), // < 1.0 distance
      normal: createVector3(0, 0, -1),
      area: 64
    };

    const tree: TreeElement = {
      contents: 0,
      brushes: [],
      bounds: { mins: createVector3(0, 0, 0), maxs: createVector3(0, 0, 0) },
      planeNum: 0,
      children: [
        { contents: 0, brushes: [], bounds: { mins: createVector3(0, 0, 0), maxs: createVector3(0, 0, 0) } },
        { contents: 0, brushes: [], bounds: { mins: createVector3(0, 0, 0), maxs: createVector3(0, 0, 0) } }
      ]
    };

    const planes: CompilePlane[] = [
      { normal: createVector3(1, 0, 0), dist: 0, type: 0 }
    ];

    const ff = calculateFormFactor(sourcePatch as unknown as Patch, destPatch as unknown as Patch, tree, planes);
    expect(ff).toBe(0);
  });
});

describe('Radiosity - computeRadiosity', () => {
  it('should transfer emissive light between facing patches', () => {
    // Two patches facing each other.
    // sourcePatch is emissive and bright. destPatch receives light.
    const sourcePatch = {
      origin: createVector3(0, 0, 0),
      normal: createVector3(0, 0, 1),
      area: 100,
      emissive: createVector3(100, 0, 0), // Bright red
      totalLight: createVector3(0, 0, 0),
    };

    const destPatch = {
      origin: createVector3(0, 0, 10),
      normal: createVector3(0, 0, -1),
      area: 100,
      emissive: createVector3(0, 0, 0), // Dark
      totalLight: createVector3(0, 0, 0),
    };

    const patches = [sourcePatch as unknown as Patch, destPatch as unknown as Patch];

    const tree: TreeElement = {
      contents: 0,
      brushes: [],
      bounds: { mins: createVector3(0, 0, 0), maxs: createVector3(0, 0, 0) },
      planeNum: 0,
      children: [
        { contents: 0, brushes: [], bounds: { mins: createVector3(0, 0, 0), maxs: createVector3(0, 0, 0) } },
        { contents: 0, brushes: [], bounds: { mins: createVector3(0, 0, 0), maxs: createVector3(0, 0, 0) } }
      ]
    };

    const planes: CompilePlane[] = [
      { normal: createVector3(1, 0, 0), dist: 0, type: 0 }
    ];

    computeRadiosity(patches, tree, planes, { bounces: 1, threshold: 0.1 });

    // Dest patch should have received light
    expect(destPatch.totalLight.x).toBeGreaterThan(0);
    expect(destPatch.totalLight.y).toBe(0);
    expect(destPatch.totalLight.z).toBe(0);

    // Source patch total light should contain its emissive value
    expect(sourcePatch.totalLight.x).toBe(100);
  });
});
