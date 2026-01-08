import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rayCastEntities, Ray } from '../../src/editor/selection';
import { EntitySystem } from '../../src/entities/system';
import { Entity, MoveType, Solid } from '../../src/entities/entity';
import { vec3 } from 'gl-matrix';

// Helper to create a basic entity
function createEntity(sys: EntitySystem, origin: number[], mins: number[], maxs: number[], angles: number[] = [0, 0, 0]) {
  const ent = sys.spawn();
  ent.classname = 'test_entity';
  ent.origin = { x: origin[0], y: origin[1], z: origin[2] };
  ent.mins = { x: mins[0], y: mins[1], z: mins[2] };
  ent.maxs = { x: maxs[0], y: maxs[1], z: maxs[2] };
  ent.angles = { x: angles[0], y: angles[1], z: angles[2] };
  ent.solid = Solid.Bbox;

  // Set absmin/absmax roughly (though rayCastEntities might not use them if we change it to OBB)
  // But rayCastEntities currently uses absmin/absmax for fallback.
  // We'll set them to a large enough box to pass broadphase if any.
  ent.absmin = { x: origin[0] - 100, y: origin[1] - 100, z: origin[2] - 100 };
  ent.absmax = { x: origin[0] + 100, y: origin[1] + 100, z: origin[2] + 100 };

  return ent;
}

describe('rayCastEntities OBB', () => {
  let sys: EntitySystem;

  beforeEach(() => {
    // Mock engine and imports
    const mockEngine = {};
    sys = new EntitySystem(mockEngine as any);
  });

  it('should hit an axis-aligned entity (sanity check)', () => {
    // Entity at 100, 0, 0. Size 10x10x10 (-5 to 5)
    createEntity(sys, [100, 0, 0], [-5, -5, -5], [5, 5, 5]);

    const ray: Ray = {
      origin: vec3.fromValues(0, 0, 0),
      direction: vec3.fromValues(1, 0, 0)
    };

    const hits = rayCastEntities(sys, ray);
    expect(hits.length).toBe(1);
    expect(hits[0].distance).toBeCloseTo(95); // 100 - 5
  });

  it('should hit a rotated entity that would be missed by AABB check of the unrotated box', () => {
    // Entity at 100, 0, 0. Long and thin: 50x2x2.
    // Mins: -25, -1, -1. Maxs: 25, 1, 1.
    // Rotated 90 degrees around Y (Yaw).
    // Q2 Yaw is rotation around Z.
    // Angles: {x: 0, y: 90, z: 0}

    // If rotated 90 deg around Z (Yaw), the X-axis length (50) becomes Y-axis length.
    // So it should extend from Y=-25 to Y=25. And X thickness is 2 (-1 to 1).
    // Center is 100, 0, 0.
    // So it occupies X: 99-101, Y: -25 to 25.

    // Ray shooting along Y axis at X=100.
    // Origin: 100, -50, 0. Direction: 0, 1, 0.
    // Should hit the side of the rotated box.

    createEntity(sys,
      [100, 0, 0],
      [-25, -1, -1],
      [25, 1, 1],
      [0, 90, 0] // 90 deg yaw
    );

    const ray: Ray = {
      origin: vec3.fromValues(100, -50, 0),
      direction: vec3.fromValues(0, 1, 0)
    };

    const hits = rayCastEntities(sys, ray);
    expect(hits.length).toBe(1);
    // Local X [-25, 25] becomes Global Y extents [-25, 25].
    // Ray starts at Y=-50, enters at Y=-25. Distance 25.
    expect(hits[0].distance).toBeCloseTo(25);
  });

  it('should NOT hit a rotated entity if the ray misses the OBB but would hit the bounding sphere/large AABB', () => {
     // Same setup: Rotated 90 deg.
     // Effectively X width is 2 (99 to 101).

     // Ray shoots at X=105.
     // If it was unrotated, X extent is -25 to 25 -> 75 to 125. 105 would hit.
     // But rotated, X extent is only 99 to 101. 105 should miss.

     createEntity(sys,
      [100, 0, 0],
      [-25, -1, -1],
      [25, 1, 1],
      [0, 90, 0]
    );

    const ray: Ray = {
      origin: vec3.fromValues(105, -50, 0),
      direction: vec3.fromValues(0, 1, 0)
    };

    const hits = rayCastEntities(sys, ray);
    expect(hits.length).toBe(0);
  });
});
