
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType, Solid, EntityFlags } from '../../../src/entities/entity.js';
import { M_MoveStep } from '../../../src/ai/movement.js';
import { MASK_MONSTERSOLID } from '@quake2ts/shared';
import { createMonsterEntityFactory, createTestContext, spawnEntity } from '@quake2ts/test-utils';

describe('Sloping Surface Traversal', () => {
  let entity: Entity;
  let context: ReturnType<typeof createTestContext>;
  let mockContext: ReturnType<typeof createTestContext>['entities']; // The entity system part

  beforeEach(() => {
    context = createTestContext();
    mockContext = context.entities;

    const monsterData = createMonsterEntityFactory('monster_test', {
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      gravityVector: { x: 0, y: 0, z: -1 }, // Default gravity
      svflags: 0,
      movetype: MoveType.Step,
      flags: 0,
      groundentity: { index: 1 } as Entity, // Simulate grounded
      waterlevel: 0,
    });
    entity = spawnEntity(mockContext, monsterData);
    entity.spawnflags = 0;
  });

  it('should adjust move for slopes when blocked', () => {
    const move = { x: 10, y: 0, z: 0 };

    // 1. Initial move blocked (hit slope)
    vi.mocked(mockContext.trace).mockReturnValueOnce({
      fraction: 0.5,
      endpos: { x: 5, y: 0, z: 0 },
      startsolid: false,
      allsolid: false,
    } as any);

    // 2. Upward trace (lift step)
    vi.mocked(mockContext.trace).mockReturnValueOnce({
      fraction: 1.0,
      endpos: { x: 0, y: 0, z: 18 }, // Moved up
      startsolid: false,
      allsolid: false,
    } as any);

    // 3. Forward trace (at raised height)
    vi.mocked(mockContext.trace).mockReturnValueOnce({
      fraction: 1.0,
      endpos: { x: 10, y: 0, z: 18 }, // Moved forward at height
      startsolid: false,
      allsolid: false,
    } as any);

    // 4. Downward trace (step down)
    vi.mocked(mockContext.trace).mockReturnValueOnce({
        fraction: 0.5, // Hit slope ground
        endpos: { x: 10, y: 0, z: 5 }, // Landed on slope
        startsolid: false,
        allsolid: false,
        ent: {} // Ground entity
    } as any);

    // Mock check bottom (ground check)
    // NOTE: CheckBottom calls trace again. We need to make sure it hits something reasonable.
    // If we are at z=5, a check bottom trace from z=5 down to -31 should hit something.
    // Let's say it hits at -20 (solid ground).
    vi.mocked(mockContext.trace).mockReturnValue({
        fraction: 0.5,
        endpos: { x: 10, y: 0, z: 5 }, // hit the ground at 5
        ent: {}
    } as any);
    vi.mocked(mockContext.pointcontents).mockReturnValue(0);

    const result = M_MoveStep(entity, move, true, mockContext);

    expect(result).toBe(true);
    // Because check ground snaps to ground if within 0.25 units? No, CheckGround snaps if fraction < 1.0.
    // If CheckGround hits at z=5, entity origin becomes z=5.
    expect(entity.origin).toEqual({ x: 10, y: 0, z: 5 });
  });

  it('should not climb steep slopes', () => {
     const move = { x: 10, y: 0, z: 0 };

    // 1. Initial move blocked
    vi.mocked(mockContext.trace).mockReturnValueOnce({
      fraction: 0.5,
      endpos: { x: 5, y: 0, z: 0 },
      startsolid: false,
      allsolid: false,
    } as any);

    // 2. Upward trace (lift step)
    vi.mocked(mockContext.trace).mockReturnValueOnce({
      fraction: 1.0,
      endpos: { x: 0, y: 0, z: 18 },
      startsolid: false,
      allsolid: false,
    } as any);

    // 3. Forward trace (at raised height) blocked by wall
    vi.mocked(mockContext.trace).mockReturnValueOnce({
      fraction: 0.1,
      endpos: { x: 1, y: 0, z: 18 },
      startsolid: false,
      allsolid: false,
    } as any);

    // Since forward trace failed (fraction low), it should likely fail or try step
    // The logic in M_MoveStep compares up_trace and fwd_trace.
    // If both are blocked, it returns false.

    // Let's assume M_MoveStep will trace fwd from original position too
    // 4. Forward trace from original position (blocked)
    vi.mocked(mockContext.trace).mockReturnValueOnce({
        fraction: 0.1,
        endpos: { x: 1, y: 0, z: 0 },
        startsolid: false,
        allsolid: false,
    } as any);

    const result = M_MoveStep(entity, move, true, mockContext);
    expect(result).toBe(false);
  });
});
