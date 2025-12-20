import { describe, it, expect, vi } from 'vitest';
import { simulateMovement, simulateGravity, simulateJump, createPhysicsTestScenario } from '../../src/game/helpers/physics.js';
import { createTestContext } from '../../src/game/helpers.js';
import { Entity, MoveType, Solid } from '@quake2ts/game';

describe('Physics Helpers', () => {
  it('simulateMovement moves entity when clear', () => {
    const context = createTestContext();
    const entity = new Entity(1);
    entity.origin = { x: 0, y: 0, z: 0 };
    entity.mins = { x: -16, y: -16, z: -24 };
    entity.maxs = { x: 16, y: 16, z: 32 };

    simulateMovement(entity, { x: 100, y: 0, z: 0 }, context);

    expect(entity.origin).toEqual({ x: 100, y: 0, z: 0 });
    expect(context.entities.trace).toHaveBeenCalled();
  });

  it('simulateGravity applies gravity and moves entity', () => {
    const context = createTestContext();
    const entity = new Entity(1);
    entity.origin = { x: 0, y: 0, z: 100 };
    entity.velocity = { x: 0, y: 0, z: 0 };
    entity.mins = { x: -16, y: -16, z: -24 };
    entity.maxs = { x: 16, y: 16, z: 32 };
    entity.movetype = MoveType.Step;

    simulateGravity(entity, 0.1, context);

    // Gravity 800 * 0.1 = 80 downward velocity
    // Position change = -80 * 0.1 = -8
    expect(entity.velocity.z).toBeCloseTo(-80);
    expect(entity.origin.z).toBeCloseTo(92);
  });

  it('simulateJump applies vertical velocity if on ground', () => {
    // We create a physics scenario which mocks the trace function on the context
    const context = createTestContext();
    createPhysicsTestScenario('basic', context);

    const entity = new Entity(1);
    // Position entities so their bottom (origin.z + mins.z) is exactly on the floor (0)
    // mins.z is -24, so origin.z should be 24.
    entity.origin = { x: 0, y: 0, z: 24 };
    entity.mins = { x: -16, y: -16, z: -24 };
    entity.maxs = { x: 16, y: 16, z: 32 };

    // The createPhysicsTestScenario sets up a trace mock where z=0 is the floor.
    // simulateJump checks trace at z-2.
    // If entity is at 24, bottom is 0.
    // Check trace goes to 24-2 = 22. Bottom would be -2.
    // This crosses 0, so it should hit.

    simulateJump(entity, context);

    expect(entity.velocity.z).toBe(270);
    expect(entity.origin.z).toBeGreaterThan(24); // Nudged up
  });
});
