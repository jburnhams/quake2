import { describe, it, expect } from 'vitest';
import { BspBuilder } from '../../../src/builder/BspBuilder.js';
import type { OpeningDef } from '../../../src/builder/types.js';

describe('BspBuilder Integration', () => {
  it('should add a room with openings at non-zero origin', () => {
    const builder = new BspBuilder();
    const origin = { x: 1000, y: 1000, z: 1000 };
    const opening: OpeningDef = {
      wall: 'north',
      position: { x: 0, y: 0, z: 0 }, // Center of room, relative
      size: { x: 64, y: 32, z: 80 }
    };

    builder.addRoom({
      origin,
      size: { x: 256, y: 256, z: 128 },
      wallThickness: 16,
      openings: [opening]
    });

    const result = builder.build();
    // Should still produce 9 brushes (2 floor/ceil + 3 solid walls + 4 pieces for north wall)
    // If coordinate bug exists, hole misses wall, so north wall remains 1 solid brush -> total 6 brushes.
    expect(result.stats.brushCount).toBe(9);
  });
});
