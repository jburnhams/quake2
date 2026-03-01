import { describe, it, expect } from 'vitest';
import { BspBuilder } from '../../../src/builder/BspBuilder.js';
import { BspCompiler } from '../../../src/compiler/BspCompiler.js';

describe('Visibility Integration', () => {
  it('should generate valid BSP with fast visibility data for a simple room layout', () => {
    // We create two connected rooms via the builder
    const builder = new BspBuilder();

    // Room 1
    builder.addRoom({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 256, y: 256, z: 128 },
      wallThickness: 16,
      openings: [{
        wall: 'east',
        position: { x: 0, y: 0, z: 0 },
        size: { x: 32, y: 64, z: 64 }
      }]
    });

    // Room 2 (connected to the east opening of Room 1)
    builder.addRoom({
      origin: { x: 256 + 16, y: 0, z: 0 },
      size: { x: 256, y: 256, z: 128 },
      wallThickness: 16,
      openings: [{
        wall: 'west',
        position: { x: 0, y: 0, z: 0 },
        size: { x: 32, y: 64, z: 64 }
      }]
    });

    const buildResult = builder.build();

    // Now compile the brushes from the builder
    // We explicitly set noVis to false so it computes visibility using our new integration
    const compiler = new BspCompiler({
      verbose: false,
      noVis: false,
      noLighting: true // Keep fast for this test
    });

    const compileResult = compiler.compile(buildResult.brushes || [], buildResult.entities || []);

    const bsp = compileResult.bsp;

    // Verify visibility was attached
    expect(bsp.visibility).toBeDefined();
    expect(bsp.visibility!.numClusters).toBeGreaterThan(0);
    expect(bsp.visibility!.clusters.length).toBe(bsp.visibility!.numClusters);

    // Fast vis/flood fill means all interconnected clusters can see each other.
    // Ensure that PVS bytes are generated.
    const firstCluster = bsp.visibility!.clusters[0];
    expect(firstCluster.pvs).toBeDefined();
    expect(firstCluster.phs).toBeDefined();
    expect(firstCluster.pvs.length).toBeGreaterThan(0);

    // To properly test visibility, we expect our builder to have produced enough empty space
    // leaves (clusters) for the two rooms. They should be connected by a portal.
    // Thus cluster 0 should be able to see cluster 1 (and vice versa) according to fast vis.
    // The bits are stored in the pvs byte array.
    if (bsp.visibility!.numClusters > 1) {
      // Check if cluster 0 can see cluster 1
      const bitIndex = 1;
      const byteIndex = bitIndex >> 3;
      const bitMask = 1 << (bitIndex & 7);

      // We expect the rooms to be visible to each other
      const seesCluster1 = (firstCluster.pvs[byteIndex] & bitMask) !== 0;
      expect(seesCluster1).toBe(true);
    }
  });
});
