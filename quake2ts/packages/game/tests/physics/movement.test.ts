import { describe, expect, it } from 'vitest';
import { runGravity } from '../../src/physics/movement.js';
import { MoveType } from '../../src/entities/entity.js';
import { type Vec3 } from '@quake2ts/shared';
import { createEntity } from '@quake2ts/test-utils';

describe('physics movement', () => {
  const gravity: Vec3 = { x: 0, y: 0, z: -800 };
  const frametime = 0.1;

  it('should apply full gravity when not in water', () => {
    const ent = createEntity({
      movetype: MoveType.Toss,
      velocity: { x: 0, y: 0, z: 0 },
      origin: { x: 0, y: 0, z: 100 },
      waterlevel: 0,
    });

    runGravity(ent as any, gravity, frametime);

    // z velocity should be -800 * 0.1 = -80
    expect(ent.velocity!.z).toBe(-80);
    // z origin should decrease by -80 * 0.1 = -8
    expect(ent.origin!.z).toBe(92);
  });

  it('should apply reduced gravity and friction when in water', () => {
    const ent = createEntity({
      movetype: MoveType.Toss,
      velocity: { x: 0, y: 0, z: -100 },
      origin: { x: 0, y: 0, z: 100 },
      waterlevel: 2, // Submerged
    });

    runGravity(ent as any, gravity, frametime);

    // Gravity is 0.1x: -800 * 0.1 * 0.1 = -8 added to velocity
    // Friction is 2 * frametime * speed = 0.2 * 100 = 20 reduced from speed.
    // Original speed 100. New speed due to friction = 80.
    // Velocity after friction: -80.
    // Then add gravity (-8): -88.

    expect(ent.velocity!.z).toBeCloseTo(-88);

    // Origin update: origin + velocity * frametime
    // 100 + (-88 * 0.1) = 100 - 8.8 = 91.2
    expect(ent.origin!.z).toBeCloseTo(91.2);
  });
});
