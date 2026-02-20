import { describe, it, expect } from 'vitest';
import { BspBuilder } from '../../../src/builder/BspBuilder.js';
import { box } from '../../../src/builder/primitives.js';

describe('SimpleCompiler Integration', () => {
  it('compiles a simple box map', () => {
    const builder = new BspBuilder();

    builder.addRoom({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 256, y: 256, z: 128 },
      wallThickness: 16,
      wallTexture: 'base_wall/concrete1',
      floorTexture: 'base_wall/concrete1',
      ceilingTexture: 'base_wall/concrete1'
    });

    builder.addEntity({
      classname: 'info_player_start',
      properties: {
        origin: '0 0 32',
        angle: '90'
      }
    });

    const result = builder.build();
    const bsp = result.bsp;

    // Check basic stats
    expect(result.stats.brushCount).toBeGreaterThan(0);
    expect(result.stats.leafCount).toBeGreaterThan(0);
    expect(result.stats.nodeCount).toBeGreaterThan(0);

    // Check structure
    expect(bsp.header.version).toBe(38);
    expect(bsp.planes.length).toBeGreaterThan(0);
    expect(bsp.nodes.length).toBeGreaterThan(0);
    expect(bsp.leafs.length).toBeGreaterThan(0);
    expect(bsp.faces.length).toBeGreaterThan(0);

    // Check visibility (should be trivial)
    expect(bsp.visibility).toBeDefined();
    expect(bsp.visibility!.numClusters).toBeGreaterThan(0);

    // Check lighting (should be fullbright)
    expect(bsp.lightMaps.length).toBeGreaterThan(0);

    // Check leaf lists
    // Leafs should have faces if they are empty
    let hasLeafFaces = false;
    for (let i = 0; i < bsp.leafs.length; i++) {
      const leaf = bsp.leafs[i];
      // Check manually populated lists in bsp.leafLists
      const faces = bsp.leafLists.leafFaces[i];
      if (faces && faces.length > 0) {
        hasLeafFaces = true;
      }
    }
    expect(hasLeafFaces).toBe(true);

    // Check entities
    expect(bsp.entities.raw).toContain('"classname" "worldspawn"');
    expect(bsp.entities.raw).toContain('"classname" "info_player_start"');
  });

  it('calculates valid bounding boxes for leaves', () => {
    const builder = new BspBuilder();
    builder.addBrush(box({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 64, y: 64, z: 64 }
    }));

    const result = builder.build();
    const bsp = result.bsp;

    // Check that we have leaves with non-zero volume (mins != maxs)
    // Note: Some leaves might be the infinite "outside", but inside the map they should be bounded.
    // The "Universe" is huge, so even outside leaves should have bounds.

    let validBoundsCount = 0;
    for (const leaf of bsp.leafs) {
      const w = leaf.maxs[0] - leaf.mins[0];
      const h = leaf.maxs[1] - leaf.mins[1];
      const d = leaf.maxs[2] - leaf.mins[2];

      if (w > 0 && h > 0 && d > 0) {
        validBoundsCount++;
      }
    }

    expect(validBoundsCount).toBeGreaterThan(0);
    expect(bsp.leafs.length).toBeGreaterThan(0);
  });

  it('compiles distinct brushes separated by space', () => {
    const builder = new BspBuilder();

    // Brush 1 at -100
    builder.addBrush(box({
      origin: { x: -100, y: 0, z: 0 },
      size: { x: 64, y: 64, z: 64 }
    }));

    // Brush 2 at +100
    builder.addBrush(box({
      origin: { x: 100, y: 0, z: 0 },
      size: { x: 64, y: 64, z: 64 }
    }));

    const result = builder.build();
    const bsp = result.bsp;

    expect(result.stats.brushCount).toBe(2);
    expect(bsp.nodes.length).toBeGreaterThan(0);

    const solidLeafs = bsp.leafs.filter(l => l.contents !== 0);
    expect(solidLeafs.length).toBe(2);
  });
});
