
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType } from '../../../src/entities/entity';
import { M_CheckBottom } from '../../../src/ai/movement';
import { createTestContext } from '@quake2ts/test-utils';

describe('Gravity Vector Support', () => {
  let entity: Entity;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    const system = testContext.entities;

    entity = system.spawn();
    Object.assign(entity, {
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      gravityVector: { x: 0, y: 0, z: -1 }, // Default gravity
      svflags: 0,
      movetype: MoveType.Step,
      flags: 0,
    });
    // Ensure spawnflags is a number as defined in the entity class
    entity.spawnflags = 0;
  });

  it('should check bottom for standard gravity (down)', () => {
    const traceSpy = vi.mocked(testContext.entities.trace);
    const pointcontentsSpy = vi.mocked(testContext.entities.pointcontents);

    // Mock trace to hit ground
    traceSpy.mockReturnValue({
      fraction: 0.5,
      endpos: { x: 0, y: 0, z: -18 }, // Hit something below
      ent: {},
    });
    // Ensure fast check fails so we hit the trace logic
    pointcontentsSpy.mockReturnValue(0);

    M_CheckBottom(entity, testContext.entities);

    // We expect it to verify ground exists
    // The implementation of M_CheckBottom typically calls trace downwards
    expect(traceSpy).toHaveBeenCalled();
    const callArgs = traceSpy.mock.calls[0];
    // Start Z should be origin.z + mins.z = -24
    // Stop Z should be start.z - STEPSIZE*2 = -24 - 36 = -60
    expect(callArgs[3].z).toBeLessThan(callArgs[0].z);
  });

  it('should check bottom for inverted gravity (ceiling walker)', () => {
    const traceSpy = vi.mocked(testContext.entities.trace);
    const pointcontentsSpy = vi.mocked(testContext.entities.pointcontents);

    entity.gravityVector = { x: 0, y: 0, z: 1 }; // Upward gravity

    traceSpy.mockReturnValue({
      fraction: 0.5,
      endpos: { x: 0, y: 0, z: 40 }, // Hit something above
      ent: {},
    });
    // Ensure fast check fails so we hit the trace logic
    pointcontentsSpy.mockReturnValue(0);

    M_CheckBottom(entity, testContext.entities);

    expect(traceSpy).toHaveBeenCalled();
    const callArgs = traceSpy.mock.calls[0];

    // With upward gravity, we check ABOVE the entity
    // Start Z should be origin.z + maxs.z = 32
    // Stop Z should be start.z + STEPSIZE*2 = 32 + 36 = 68
    expect(callArgs[3].z).toBeGreaterThan(callArgs[0].z);
  });
});
