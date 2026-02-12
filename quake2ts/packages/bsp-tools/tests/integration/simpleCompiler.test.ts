import { describe, it, expect } from 'vitest';
import { BspBuilder } from '../../src/builder/BspBuilder.js';
import { box } from '../../src/builder/primitives.js';

describe('BspBuilder Integration', () => {
  it('compiles a simple room map', () => {
    const builder = new BspBuilder();

    // Add a room (hollow box)
    builder.addRoom({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 256, y: 256, z: 128 },
      wallThickness: 16
    });

    // Add a player start
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
    // A room has 6 walls (floor, ceiling, 4 walls) -> 6 brushes.
    // Each brush creates at least 1 leaf (solid) + 1 node?
    // The tree should have structure.

    // Check BSP structure
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
    // We expect at least one empty leaf (inside the room) to see some faces (walls).
    let hasLeafFaces = false;
    // leafLists.leafFaces is array of arrays
    for (const faces of bsp.leafLists.leafFaces) {
      if (faces && faces.length > 0) {
        hasLeafFaces = true;
        break;
      }
    }
    expect(hasLeafFaces).toBe(true);

    // Check entities
    expect(bsp.entities.raw).toContain('"classname" "worldspawn"');
    expect(bsp.entities.raw).toContain('"classname" "info_player_start"');
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
    // Should have nodes separating them
    expect(bsp.nodes.length).toBeGreaterThan(0);

    // Check that we have solid leaves corresponding to brushes
    const solidLeafs = bsp.leafs.filter(l => l.contents !== 0);
    expect(solidLeafs.length).toBe(2);
  });
});
