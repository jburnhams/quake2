import { describe, expect, it, vi } from 'vitest';
import { runGravity } from '../../src/physics/movement.js';
import { Entity, MoveType } from '../../src/entities/entity.js';
import { type Vec3 } from '@quake2ts/shared';

describe('physics movement', () => {
  const gravity: Vec3 = { x: 0, y: 0, z: -800 };
  const frametime = 0.1;

  it('should apply full gravity when not in water', () => {
    const ent = new Entity(1);
    ent.movetype = MoveType.Toss;
    ent.velocity = { x: 0, y: 0, z: 0 };
    ent.origin = { x: 0, y: 0, z: 100 };
    ent.waterlevel = 0;

    runGravity(ent, gravity, frametime);

    // z velocity should be -800 * 0.1 = -80
    expect(ent.velocity.z).toBe(-80);
    // z origin should decrease by -80 * 0.1 = -8
    expect(ent.origin.z).toBe(92);
  });

  it('should apply reduced gravity and friction when in water', () => {
    const ent = new Entity(1);
    ent.movetype = MoveType.Toss;
    ent.velocity = { x: 0, y: 0, z: -100 };
    ent.origin = { x: 0, y: 0, z: 100 };
    ent.waterlevel = 2; // Submerged

    runGravity(ent, gravity, frametime);

    // Gravity is 0.1x: -800 * 0.1 * 0.1 = -8 added to velocity
    // Friction is 2 * frametime * speed = 0.2 * 100 = 20 reduced from speed.
    // Original speed 100. New speed due to friction = 80.
    // Velocity after friction: -80.
    // Then add gravity (-8): -88.

    // Let's trace the exact order in code:
    // 1. Drag: speed=100. newspeed = 100 - 0.1*100*2 = 80. scale = 0.8.
    // ent.velocity becomes {0, 0, -80}
    // 2. Gravity: add (gravity * 0.1 * frametime). -800 * 0.1 * 0.1 = -8.
    // ent.velocity becomes {0, 0, -88}

    expect(ent.velocity.z).toBeCloseTo(-88);

    // Origin update: origin + velocity * frametime
    // 100 + (-88 * 0.1) = 100 - 8.8 = 91.2
    expect(ent.origin.z).toBeCloseTo(91.2);
  });
});
