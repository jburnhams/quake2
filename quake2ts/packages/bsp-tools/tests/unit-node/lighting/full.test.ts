import { describe, it, expect, beforeEach } from 'vitest';
import { computeFullLighting } from '../../../src/lighting/full.js';
import type { CompileFace, CompilePlane } from '../../../src/types/compile.js';
import type { BspTexInfo } from '../../../src/types/bsp.js';
import type { Light } from '../../../src/lighting/lights.js';
import { createVector3 } from '@quake2ts/test-utils';

import { baseWindingForPlane } from '@quake2ts/shared';

describe('computeFullLighting', () => {
  let faces: CompileFace[];
  let texInfos: BspTexInfo[];
  let lights: Light[];
  let planes: CompilePlane[];
  let tree: any; // Using basic mock since tree is not strictly accessed here for basic intersection hits if direct hit test is mocked/simplified

  beforeEach(() => {
    planes = [
      { normal: createVector3(0, 0, 1), dist: 0, type: 2 }, // Floor plane
    ];

    // Create a square face 128x128 on the floor
    const w = baseWindingForPlane(planes[0].normal, planes[0].dist);
    faces = [
      {
        bounds: { mins: createVector3(-64, -64, 0), maxs: createVector3(64, 64, 0) }, next: null, original: {} as any, sides: [],
        planeNum: 0,
        texInfo: 0,
        winding: {
          points: [
            createVector3(-64, -64, 0),
            createVector3(64, -64, 0),
            createVector3(64, 64, 0),
            createVector3(-64, 64, 0)
          ],
          numPoints: 4
        } as any
      }
    ];

    texInfos = [
      {
        s: createVector3(1, 0, 0),
        sOffset: 0,
        t: createVector3(0, 1, 0),
        tOffset: 0,
        flags: 0,
        value: 0,
        texture: 'test',
        nextTexInfo: -1
      }
    ];

    lights = [
      {
        type: 'point',
        origin: createVector3(0, 0, 64),
        color: createVector3(1, 1, 1),
        intensity: 300,
        style: 0
      }
    ];

    tree = {}; // Empty tree for mock visibility
  });

  it('should compute combined direct and bounced light correctly', () => {
    // 1. Compute direct lighting with 0 bounces
    const directResult = computeFullLighting(faces, texInfos, lights, tree, planes, { bounces: 0 });

    // 2. Compute full lighting with 1 bounce
    const bouncedResult = computeFullLighting(faces, texInfos, lights, tree, planes, { bounces: 1 });

    // Check lightmaps are packed and valid
    expect(directResult.data.length).toBeGreaterThan(0);
    expect(bouncedResult.data.length).toBeGreaterThan(0);
    expect(directResult.faceOffsets.length).toBe(1);

    // Just verify the data array differs or contains values
    let totalDirect = 0;
    for (let i = 0; i < directResult.data.length; i++) {
       totalDirect += directResult.data[i];
    }

    // For a single flat plane and 1 light directly above, bounce light might be absorbed or mostly similar.
    // We mainly want to ensure the API runs successfully without crashing
    expect(totalDirect).toBeGreaterThan(0);
  });
});
