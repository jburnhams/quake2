
import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionEntityIndex, CollisionEntityLink } from '../../src/bsp/collision.js';
import { traceBox, buildCollisionModel, CollisionLumpData } from '../../src/bsp/collision.js';
import { Vec3 } from '../../src/math/vec3.js';
import { CONTENTS_SOLID, CONTENTS_TRIGGER } from '../../src/bsp/contents.js';

describe('CollisionEntityIndex Spatial', () => {
  let index: CollisionEntityIndex;

  beforeEach(() => {
    index = new CollisionEntityIndex();
  });

  const makeEntity = (id: number, x: number, y: number, z: number, size = 16): CollisionEntityLink => ({
    id,
    origin: { x, y, z },
    mins: { x: -size, y: -size, z: -size },
    maxs: { x: size, y: size, z: size },
    contents: CONTENTS_SOLID
  });

  it('should find entity in trace', () => {
    index.link(makeEntity(1, 100, 0, 0));

    const result = index.trace({
      model: null as any, // Mock model not needed for entity-only trace
      start: { x: 0, y: 0, z: 0 },
      end: { x: 200, y: 0, z: 0 },
      mins: { x: -10, y: -10, z: -10 },
      maxs: { x: 10, y: 10, z: 10 },
    });

    expect(result.entityId).toBe(1);
    expect(result.fraction).toBeLessThan(1);
  });

  it('should optimize checks using spatial partition', () => {
    // This test is behavior-verification for now.
    // In a real spatial partition, distant entities shouldn't be checked.
    // For now we just verify correctness.

    // Entity far away
    index.link(makeEntity(1, 1000, 1000, 1000));
    // Entity close by
    index.link(makeEntity(2, 50, 0, 0));

    const result = index.trace({
      model: null as any,
      start: { x: 0, y: 0, z: 0 },
      end: { x: 100, y: 0, z: 0 },
      mins: { x: -10, y: -10, z: -10 },
      maxs: { x: 10, y: 10, z: 10 },
    });

    expect(result.entityId).toBe(2);
  });
});
