import { describe, it, expect } from 'vitest';
import { BspBuilder } from '../../../src/builder/BspBuilder.js';
import { box, hollowBox } from '../../../src/builder/primitives.js';
import { BspCompiler } from '../../../src/compiler/BspCompiler.js';
import { calculateLightmapSize, generateSamplePoints, lightFace, isInShadow, calculateDirectLight } from '../../../src/lighting/index.js';
import type { Light } from '../../../src/lighting/lights.js';
import { Vec3 } from '@quake2ts/shared';
import { processCsg } from '../../../src/compiler/csg.js';
import { buildTree } from '../../../src/compiler/tree.js';

describe('Lighting Integration', () => {
  it('should correctly cast shadows and calculate direct lighting on a real BSP', () => {
    const builder = new BspBuilder();

    // Instead of a floor and isolated wall, build a hollow room to contain space (proper leaves)
    const roomBrushes = hollowBox({
      origin: {x: 0, y: 0, z: 0} as Vec3,
      size: {x: 512, y: 512, z: 512} as Vec3,
      wallThickness: 16,
      texture: 'test_wall'
    });

    roomBrushes.forEach(b => builder.addBrush(b));

    // A partition wall in the middle, x=-16 to 16
    builder.addBrush(box({
      origin: {x: 0, y: 0, z: 0} as Vec3,
      size: {x: 32, y: 512, z: 512} as Vec3,
      texture: 'test_wall'
    }));

    const brushes = (builder as any).brushes;
    const entities = [{ classname: 'worldspawn', properties: new Map() }, ...(builder as any).entities];

    const compiler = new BspCompiler({ brushes, entities });

    (compiler as any).prepareBrushes(brushes);

    const csgBrushes = processCsg(
      (compiler as any).compileBrushes,
      (compiler as any).planeSet,
      (compiler as any).texInfoManager
    );

    const planeSet = (compiler as any).planeSet;
    const tree = buildTree(csgBrushes, planeSet, new Set());
    const planes = planeSet.getPlanes();

    // Create a light on the left side of the partition
    const light: Light = {
      type: 'point',
      origin: { x: -64, y: 0, z: 128 } as Vec3,
      intensity: 100000,
      color: { x: 1, y: 1, z: 1 } as Vec3,
      falloff: 'inverse_square'
    };

    // Make sure we are testing points well within the empty space
    const leftPoint = { x: -128, y: 0, z: 0 } as Vec3;
    const rightPoint = { x: 128, y: 0, z: 0 } as Vec3;

    // Normal points UP towards the light
    const normal = { x: 0, y: 0, z: 1 } as Vec3;
    const leftLighting = calculateDirectLight(leftPoint, normal, [light], tree, planes);
    const rightLighting = calculateDirectLight(rightPoint, normal, [light], tree, planes);

    // Left point should be well lit
    expect(leftLighting.color.x).toBeGreaterThan(0);

    // We will verify left is significantly brighter.
    expect(leftLighting.color.x).toBeGreaterThan(rightLighting.color.x);
  });
});
