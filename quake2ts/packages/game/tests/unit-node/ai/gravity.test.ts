
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType, Solid, EntityFlags } from '../../src/entities/entity';
import { M_CheckBottom, M_CheckBottomEx } from '../../src/ai/movement';
import { BOTTOM_SOLID, BOTTOM_EMPTY } from '../../src/ai/constants';
import { MASK_MONSTERSOLID, CONTENTS_SOLID } from '@quake2ts/shared';

// Create a mock EntitySystem with necessary methods
const mockContext = {
  trace: vi.fn(),
  pointcontents: vi.fn(),
  linkentity: vi.fn(),
} as any;

describe('Gravity Vector Support', () => {
  let entity: Entity;

  beforeEach(() => {
    vi.clearAllMocks();
    entity = {
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      gravityVector: { x: 0, y: 0, z: -1 }, // Default gravity
      svflags: 0,
      spawnflags: { has: () => false },
      movetype: MoveType.Step,
      flags: 0,
    } as any;
  });

  it('should check bottom for standard gravity (down)', () => {
    // Mock trace to hit ground
    mockContext.trace.mockReturnValue({
      fraction: 0.5,
      endpos: { x: 0, y: 0, z: -18 }, // Hit something below
      ent: {},
    });
    // Ensure fast check fails so we hit the trace logic
    mockContext.pointcontents.mockReturnValue(0);

    const result = M_CheckBottom(entity, mockContext);

    // We expect it to verify ground exists
    // The implementation of M_CheckBottom typically calls trace downwards
    expect(mockContext.trace).toHaveBeenCalled();
    const callArgs = mockContext.trace.mock.calls[0];
    // Start Z should be origin.z + mins.z = -24
    // Stop Z should be start.z - STEPSIZE*2 = -24 - 36 = -60
    expect(callArgs[3].z).toBeLessThan(callArgs[0].z);
  });

  it('should check bottom for inverted gravity (ceiling walker)', () => {
    entity.gravityVector = { x: 0, y: 0, z: 1 }; // Upward gravity

    mockContext.trace.mockReturnValue({
      fraction: 0.5,
      endpos: { x: 0, y: 0, z: 40 }, // Hit something above
      ent: {},
    });
    // Ensure fast check fails so we hit the trace logic
    mockContext.pointcontents.mockReturnValue(0);

    const result = M_CheckBottom(entity, mockContext);

    expect(mockContext.trace).toHaveBeenCalled();
    const callArgs = mockContext.trace.mock.calls[0];

    // With upward gravity, we check ABOVE the entity
    // Start Z should be origin.z + maxs.z = 32
    // Stop Z should be start.z + STEPSIZE*2 = 32 + 36 = 68
    expect(callArgs[3].z).toBeGreaterThan(callArgs[0].z);
  });
});
