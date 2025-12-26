import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType, Solid, EntityFlags } from '../../src/entities/entity';
import { M_MoveStep } from '../../src/ai/movement';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Sloping Surface Traversal', () => {
  let context: any;
  let entity: Entity;

  beforeEach(() => {
    const testCtx = createTestContext();
    context = testCtx.entities;

    entity = spawnEntity(context, createEntityFactory({
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      movetype: MoveType.Step,
      flags: 0,
      groundentity: {} as any, // Simulate grounded
      waterlevel: 0,
      solid: Solid.Bbox,
    }));

    vi.spyOn(context, 'trace').mockReturnValue({
      fraction: 1.0,
      allsolid: false,
      startsolid: false,
      ent: null,
      endpos: { x: 0, y: 0, z: 0 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });

    vi.spyOn(context, 'pointcontents').mockReturnValue(0);
  });

  it('should adjust move for slopes when blocked', () => {
    const move = { x: 10, y: 0, z: 0 };

    // 1. Initial move blocked (hit slope)
    context.trace.mockReturnValueOnce({
      fraction: 0.5,
      endpos: { x: 5, y: 0, z: 0 },
      startsolid: false,
      allsolid: false,
      plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 }
    });

    // 2. Upward trace (lift step)
    context.trace.mockReturnValueOnce({
      fraction: 1.0,
      endpos: { x: 0, y: 0, z: 18 }, // Moved up
      startsolid: false,
      allsolid: false,
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });

    // 3. Forward trace (at raised height)
    context.trace.mockReturnValueOnce({
      fraction: 1.0,
      endpos: { x: 10, y: 0, z: 18 }, // Moved forward at height
      startsolid: false,
      allsolid: false,
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });

    // 4. Downward trace (step down)
    context.trace.mockReturnValueOnce({
        fraction: 0.5, // Hit slope ground
        endpos: { x: 10, y: 0, z: 5 }, // Landed on slope
        startsolid: false,
        allsolid: false,
        ent: {} as any, // Ground entity
        plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });

    // Mock check bottom (ground check)
    // NOTE: CheckBottom calls trace again. We need to make sure it hits something reasonable.
    // If we are at z=5, a check bottom trace from z=5 down to -31 should hit something.
    // Let's say it hits at -20 (solid ground).
    context.trace.mockReturnValue({
        fraction: 0.5,
        endpos: { x: 10, y: 0, z: 5 }, // hit the ground at 5
        ent: {} as any,
        plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });
    context.pointcontents.mockReturnValue(0);

    const result = M_MoveStep(entity, move, true, context);

    expect(result).toBe(true);
    // Because check ground snaps to ground if within 0.25 units? No, CheckGround snaps if fraction < 1.0.
    // If CheckGround hits at z=5, entity origin becomes z=5.
    expect(entity.origin).toEqual({ x: 10, y: 0, z: 5 });
  });

  it('should not climb steep slopes', () => {
     const move = { x: 10, y: 0, z: 0 };

    // 1. Initial move blocked
    context.trace.mockReturnValueOnce({
      fraction: 0.5,
      endpos: { x: 5, y: 0, z: 0 },
      startsolid: false,
      allsolid: false,
      plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 }
    });

    // 2. Upward trace (lift step)
    context.trace.mockReturnValueOnce({
      fraction: 1.0,
      endpos: { x: 0, y: 0, z: 18 },
      startsolid: false,
      allsolid: false,
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });

    // 3. Forward trace (at raised height) blocked by wall
    context.trace.mockReturnValueOnce({
      fraction: 0.1,
      endpos: { x: 1, y: 0, z: 18 },
      startsolid: false,
      allsolid: false,
      plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 }
    });

    // Since forward trace failed (fraction low), it should likely fail or try step
    // The logic in M_MoveStep compares up_trace and fwd_trace.
    // If both are blocked, it returns false.

    // Let's assume M_MoveStep will trace fwd from original position too
    // 4. Forward trace from original position (blocked)
    context.trace.mockReturnValueOnce({
        fraction: 0.1,
        endpos: { x: 1, y: 0, z: 0 },
        startsolid: false,
        allsolid: false,
        plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 }
    });

    const result = M_MoveStep(entity, move, true, context);
    expect(result).toBe(false);
  });
});
