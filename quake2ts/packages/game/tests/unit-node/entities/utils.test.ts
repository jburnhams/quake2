import { describe, it, expect, vi } from 'vitest';
import { touchTriggers, velocityForDamage, clipVelocity } from '../../../src/entities/utils.js';
import { Entity, Solid } from '../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';

describe('touchTriggers', () => {
  it('should call touch on overlapping triggers', () => {
    const ctx = createTestContext();
    const system = ctx.entities;

    const ent = system.spawn();
    ent.client = {} as any; // Trigger requirement
    ent.absmin = { x: 0, y: 0, z: 0 };
    ent.absmax = { x: 10, y: 10, z: 10 };

    const trigger = system.spawn();
    trigger.solid = Solid.Trigger;
    trigger.absmin = { x: 5, y: 5, z: 5 };
    trigger.absmax = { x: 15, y: 15, z: 15 };
    trigger.touch = vi.fn();

    const noTouch = system.spawn();
    noTouch.solid = Solid.Trigger;
    noTouch.absmin = { x: 20, y: 20, z: 20 };
    noTouch.absmax = { x: 30, y: 30, z: 30 };
    noTouch.touch = vi.fn();

    touchTriggers(ent, system);

    expect(trigger.touch).toHaveBeenCalledWith(trigger, ent);
    expect(noTouch.touch).not.toHaveBeenCalled();
  });

  it('should ignore non-triggers', () => {
    const ctx = createTestContext();
    const system = ctx.entities;

    const ent = system.spawn();
    ent.client = {} as any;
    ent.absmin = { x: 0, y: 0, z: 0 };
    ent.absmax = { x: 10, y: 10, z: 10 };

    const solid = system.spawn();
    solid.solid = Solid.Bsp;
    solid.absmin = { x: 5, y: 5, z: 5 };
    solid.absmax = { x: 15, y: 15, z: 15 };
    solid.touch = vi.fn();

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
