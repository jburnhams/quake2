import { describe, it, expect } from 'vitest';
import { type Vec3, createWinding } from '@quake2ts/shared';
import { createPatches, calculateFormFactor, computeRadiosity } from '../../../src/lighting/radiosity.js';
import type { CompileFace, CompilePlane } from '../../../src/types/compile.js';
import type { TreeElement } from '../../../src/compiler/tree.js';

describe('Radiosity - createPatches', () => {
  it('should subdivide a large face into multiple patches of default size 64', () => {
    // Create a square face of size 128x128 on Z=0 plane
    const w = createWinding(4);
    w.points[0] = { x: 0, y: 0, z: 0 } as Vec3;
    w.points[1] = { x: 128, y: 0, z: 0 } as Vec3;
    w.points[2] = { x: 128, y: 128, z: 0 } as Vec3;
    w.points[3] = { x: 0, y: 128, z: 0 } as Vec3;

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
      { normal: { x: 0, y: 0, z: 1 } as Vec3, dist: 0, type: 2 }
    ];

    const patches = createPatches([face], planes, 64);

    // A 128x128 face split by 64 should yield 4 patches
    expect(patches).toHaveLength(4);

    // Each patch should have an area of 64x64 = 4096
    for (const patch of patches) {
      expect(patch.area).toBeCloseTo(4096, 0);
      expect(patch.normal).toEqual({ x: 0, y: 0, z: 1 });
    }
  });

  it('should not subdivide a small face', () => {
    const w = createWinding(4);
    w.points[0] = { x: 0, y: 0, z: 0 } as Vec3;
    w.points[1] = { x: 32, y: 0, z: 0 } as Vec3;
    w.points[2] = { x: 32, y: 32, z: 0 } as Vec3;
    w.points[3] = { x: 0, y: 32, z: 0 } as Vec3;

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
      { normal: { x: 0, y: 0, z: 1 } as Vec3, dist: 0, type: 2 }
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
    const sourcePatch: any = {
      origin: { x: 0, y: 0, z: 0 } as Vec3,
      normal: { x: 0, y: 0, z: -1 } as Vec3, // Faces -Z
      area: 64
    };

    const destPatch: any = {
      origin: { x: 0, y: 0, z: 10 } as Vec3,
      normal: { x: 0, y: 0, z: 1 } as Vec3, // Faces +Z
      area: 64
    };

    const tree: TreeElement = {
      planeNum: 0,
      children: [
        { mins: [0, 0, 0], maxs: [0, 0, 0], contents: 0 } as any,
        { mins: [0, 0, 0], maxs: [0, 0, 0], contents: 0 } as any
      ],
      mins: [0, 0, 0],
      maxs: [0, 0, 0]
    } as any;

    const planes: CompilePlane[] = [
      { normal: { x: 1, y: 0, z: 0 } as Vec3, dist: 0, type: 0 }
    ];

    const ff = calculateFormFactor(sourcePatch, destPatch, tree, planes);
    expect(ff).toBe(0);
  });

  it('should return 0 when patches are extremely close to avoid math issues', () => {
    const sourcePatch: any = {
      origin: { x: 0, y: 0, z: 0 } as Vec3,
      normal: { x: 0, y: 0, z: 1 } as Vec3,
      area: 64
    };

    const destPatch: any = {
      origin: { x: 0, y: 0, z: 0.5 } as Vec3, // < 1.0 distance
      normal: { x: 0, y: 0, z: -1 } as Vec3,
      area: 64
    };

    const tree: TreeElement = {
      planeNum: 0,
      children: [
        { mins: [0, 0, 0], maxs: [0, 0, 0], contents: 0 } as any,
        { mins: [0, 0, 0], maxs: [0, 0, 0], contents: 0 } as any
      ],
      mins: [0, 0, 0],
      maxs: [0, 0, 0]
    } as any;

    const planes: CompilePlane[] = [
      { normal: { x: 1, y: 0, z: 0 } as Vec3, dist: 0, type: 0 }
    ];

    const ff = calculateFormFactor(sourcePatch, destPatch, tree, planes);
    expect(ff).toBe(0);
  });
});

describe('Radiosity - computeRadiosity', () => {
  it('should transfer emissive light between facing patches', () => {
    // Two patches facing each other.
    // sourcePatch is emissive and bright. destPatch receives light.
    const sourcePatch: any = {
      origin: { x: 0, y: 0, z: 0 } as Vec3,
      normal: { x: 0, y: 0, z: 1 } as Vec3,
      area: 100,
      emissive: { x: 100, y: 0, z: 0 } as Vec3, // Bright red
      totalLight: { x: 0, y: 0, z: 0 } as Vec3,
    };

    const destPatch: any = {
      origin: { x: 0, y: 0, z: 10 } as Vec3,
      normal: { x: 0, y: 0, z: -1 } as Vec3,
      area: 100,
      emissive: { x: 0, y: 0, z: 0 } as Vec3, // Dark
      totalLight: { x: 0, y: 0, z: 0 } as Vec3,
    };

    const patches = [sourcePatch, destPatch];

    const tree: TreeElement = {
      planeNum: 0,
      children: [
        { mins: [0, 0, 0], maxs: [0, 0, 0], contents: 0 } as any,
        { mins: [0, 0, 0], maxs: [0, 0, 0], contents: 0 } as any
      ],
      mins: [0, 0, 0],
      maxs: [0, 0, 0]
    } as any;

    const planes: CompilePlane[] = [
      { normal: { x: 1, y: 0, z: 0 } as Vec3, dist: 0, type: 0 }
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
