import { describe, it, expect, beforeEach } from 'vitest';
import { rayCastEntities, Ray } from '../../../src/editor/selection';
import { EntitySystem } from '../../../src/entities/system';
import { Entity } from '../../../src/entities/entity';
import { vec3 } from 'gl-matrix';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Entity Selection', () => {
  let mockEntitySystem: EntitySystem;

  beforeEach(() => {
    const ctx = createTestContext();
    mockEntitySystem = ctx.entities;
  });

  function createEntity(mins: number[], maxs: number[]): Entity {
    return spawnEntity(mockEntitySystem, createEntityFactory({
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      mins: { x: mins[0], y: mins[1], z: mins[2] },
      maxs: { x: maxs[0], y: maxs[1], z: maxs[2] },
      absmin: { x: mins[0], y: mins[1], z: mins[2] },
      absmax: { x: maxs[0], y: maxs[1], z: maxs[2] }
    }));
  }

  it('should hit an entity in front of the ray', () => {
    const e = createEntity([10, -5, -5], [20, 5, 5]);
    const ray: Ray = {
      origin: vec3.fromValues(0, 0, 0),
      direction: vec3.fromValues(1, 0, 0)
    };

    const hits = rayCastEntities(mockEntitySystem, ray);
    expect(hits.length).toBe(1);
    expect(hits[0].entity).toBe(e);
    expect(hits[0].distance).toBeCloseTo(10);
    expect(hits[0].normal[0]).toBeCloseTo(-1);
  });

  it('should not hit an entity behind the ray', () => {
    createEntity([-20, -5, -5], [-10, 5, 5]);
    const ray: Ray = {
      origin: vec3.fromValues(0, 0, 0),
      direction: vec3.fromValues(1, 0, 0)
    };

    const hits = rayCastEntities(mockEntitySystem, ray);
    expect(hits.length).toBe(0);
  });

  it('should sort hits by distance', () => {
    const e2 = createEntity([30, -5, -5], [40, 5, 5]); // Far
    const e1 = createEntity([10, -5, -5], [20, 5, 5]); // Near

    const ray: Ray = {
      origin: vec3.fromValues(0, 0, 0),
      direction: vec3.fromValues(1, 0, 0)
    };

    const hits = rayCastEntities(mockEntitySystem, ray);
    expect(hits.length).toBe(2);
    expect(hits[0].entity).toBe(e1);
    expect(hits[1].entity).toBe(e2);
  });
});
