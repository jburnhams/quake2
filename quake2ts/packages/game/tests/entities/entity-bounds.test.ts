import { describe, it, expect, vi } from 'vitest';
import { Entity } from '../../src/entities/entity';
import { Vec3 } from '@quake2ts/shared';

describe('Entity worldBounds', () => {
  it('should return correct world bounds from absmin and absmax', () => {
    const entity = new Entity(1);
    const absmin: Vec3 = { x: -10, y: -20, z: -30 };
    const absmax: Vec3 = { x: 10, y: 20, z: 30 };

    // Simulate engine updating absmin/absmax
    entity.absmin = absmin;
    entity.absmax = absmax;

    const bounds = entity.worldBounds;

    expect(bounds.min).toEqual(absmin);
    expect(bounds.max).toEqual(absmax);
  });
});
