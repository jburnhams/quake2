import { describe, it, expect, vi } from 'vitest';
import { touchTriggers, velocityForDamage, clipVelocity } from '../../src/entities/utils.js';
import { Entity, Solid } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';

describe('touchTriggers', () => {
  it('should call touch on overlapping triggers', () => {
    const ent = {
      client: {},
      absmin: { x: 0, y: 0, z: 0 },
      absmax: { x: 10, y: 10, z: 10 },
    } as Entity;

    const trigger = {
      solid: Solid.Trigger,
      absmin: { x: 5, y: 5, z: 5 },
      absmax: { x: 15, y: 15, z: 15 },
      touch: vi.fn(),
    } as unknown as Entity;

    const noTouch = {
        solid: Solid.Trigger,
        absmin: { x: 20, y: 20, z: 20 },
        absmax: { x: 30, y: 30, z: 30 },
        touch: vi.fn(),
    } as unknown as Entity;

    const system = {
      forEachEntity: (callback: (ent: Entity) => void) => {
        callback(trigger);
        callback(noTouch);
      },
    } as unknown as EntitySystem;

    touchTriggers(ent, system);

    expect(trigger.touch).toHaveBeenCalledWith(trigger, ent);
    expect(noTouch.touch).not.toHaveBeenCalled();
  });

  it('should ignore non-triggers', () => {
    const ent = { client: {}, absmin: { x: 0, y: 0, z: 0 }, absmax: { x: 10, y: 10, z: 10 } } as Entity;
    const solid = {
        solid: Solid.Bsp,
        absmin: { x: 5, y: 5, z: 5 },
        absmax: { x: 15, y: 15, z: 15 },
        touch: vi.fn(),
    } as unknown as Entity;

    const system = {
        forEachEntity: (callback: (ent: Entity) => void) => {
            callback(solid);
        }
    } as unknown as EntitySystem;

    touchTriggers(ent, system);
    expect(solid.touch).not.toHaveBeenCalled();
  });
});

import { createRandomGenerator } from '@quake2ts/shared';

describe('velocityForDamage', () => {
    it('should return a vector scaled by damage and kick', () => {
        const rng = createRandomGenerator(12345);
        const v = velocityForDamage(10, 5, rng);
        // length should be approx 50
        const len = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
        expect(len).toBeCloseTo(50);
    });
});

describe('clipVelocity', () => {
    it('should return clipped velocity', () => {
        const vel = { x: 100, y: 100, z: 0 };
        const normal = { x: -1, y: 0, z: 0 }; // Wall to the right
        const overbounce = 1.0;

        const clipped = clipVelocity(vel, normal, overbounce);

        // Should lose X velocity (bounces off wall)
        expect(clipped.x).toBeCloseTo(0); // Depending on overbounce
        expect(clipped.y).toBe(100);
        expect(clipped.z).toBe(0);
    });
});
