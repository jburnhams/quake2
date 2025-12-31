import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  M_CheckBottom,
  M_CheckBottomEx,
} from '../../src/index.js';
import { MoveType } from '../../src/entities/entity.js';
import { CONTENTS_SOLID, CONTENTS_WATER, CONTENTS_SLIME, CONTENTS_LAVA, TraceResult } from '@quake2ts/shared';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { createEntityFactory } from '@quake2ts/test-utils';

// Constants expected to be exported or defined
export const BOTTOM_EMPTY = 0;
export const BOTTOM_SOLID = 1;
export const BOTTOM_WATER = 2;
export const BOTTOM_SLIME = 3;
export const BOTTOM_LAVA = 4;

describe('M_CheckBottom', () => {
  let context: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    context = createTestContext();
    // Reset mocks for each test
    context.entities.trace = vi.fn().mockReturnValue({
      fraction: 1.0,
      allsolid: false,
      startsolid: false,
      ent: null,
      endpos: { x: 0, y: 0, z: 0 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    } as TraceResult);
    context.entities.pointcontents = vi.fn().mockReturnValue(0);
  });

  function createEntity() {
    const ent = context.entities.spawn();
    Object.assign(ent, createEntityFactory({
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      flags: 0,
      movetype: MoveType.Step
    }));
    return ent;
  }

  it('returns true if all 4 corners are in solid (Fast Check)', () => {
    const ent = createEntity();
    // pointcontents returns CONTENTS_SOLID for all calls
    (context.entities.pointcontents as any).mockReturnValue(CONTENTS_SOLID);

    expect(M_CheckBottom(ent, context.entities)).toBe(true);

    // Should check 4 corners
    expect(context.entities.pointcontents).toHaveBeenCalledTimes(4);
  });

  it('falls back to Slow Check if any corner is not solid', () => {
    const ent = createEntity();
    // First corner empty, forcing slow check
    (context.entities.pointcontents as any).mockReturnValueOnce(0);

    // Slow check trace: hits ground immediately (fraction 0, or close)
    (context.entities.trace as any).mockReturnValue({
      fraction: 0.1,
      endpos: { x: 0, y: 0, z: ent.origin.z + ent.mins.z }, // landed on ground
      ent: {}, // hit something
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    } as TraceResult);

    // The slow check does a center trace first, then 4 quadrant traces.
    // If center trace hits, and quadrants hit within stepsize, it returns true.

    expect(M_CheckBottom(ent, context.entities)).toBe(true);
  });

  it('returns false if center trace hits nothing (floating in air)', () => {
    const ent = createEntity();
    (context.entities.pointcontents as any).mockReturnValue(0); // Fail fast check

    // Center trace returns fraction 1.0 (empty)
    (context.entities.trace as any).mockReturnValue({
      fraction: 1.0,
      endpos: { x: 0, y: 0, z: -100 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    } as TraceResult);

    expect(M_CheckBottom(ent, context.entities)).toBe(false);
  });

  it('returns false if a corner drops too far (hanging off ledge)', () => {
    const ent = createEntity();
    (context.entities.pointcontents as any).mockReturnValue(0); // Fail fast check

    // Center trace hits ground at z = -24 (base of entity)
    const hitGround = {
      fraction: 0.1,
      endpos: { x: 0, y: 0, z: -24 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    } as TraceResult;

    const hitCliff = {
      fraction: 1.0,
      endpos: { x: 0, y: 0, z: -100 }, // cliff
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    } as TraceResult;

    const traceMock = context.entities.trace as any;

    traceMock
      .mockReturnValueOnce(hitGround)
      .mockReturnValueOnce(hitGround)
      .mockReturnValueOnce(hitGround)
      .mockReturnValueOnce(hitGround)
      .mockReturnValueOnce(hitCliff); // One corner fails

    expect(M_CheckBottom(ent, context.entities)).toBe(false);
  });
});

describe('M_CheckBottomEx', () => {
  let context: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    context = createTestContext();
    context.entities.trace = vi.fn();
    context.entities.pointcontents = vi.fn();
  });

  function createEntity() {
    const ent = context.entities.spawn();
    Object.assign(ent, createEntityFactory({
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      movetype: MoveType.Step
    }));
    return ent;
  }

  it('returns BOTTOM_SOLID when on solid ground', () => {
    const ent = createEntity();
    (context.entities.pointcontents as any).mockReturnValue(CONTENTS_SOLID); // Fast check pass
    expect(M_CheckBottomEx(ent, context.entities)).toBe(BOTTOM_SOLID);
  });

  it('returns BOTTOM_EMPTY when in air', () => {
    const ent = createEntity();
    (context.entities.pointcontents as any).mockReturnValue(0);
    (context.entities.trace as any).mockReturnValue({ fraction: 1.0, plane: { normal: {x:0, y:0, z:1}, dist:0 } } as TraceResult);

    expect(M_CheckBottomEx(ent, context.entities)).toBe(BOTTOM_EMPTY);
  });

  it('returns BOTTOM_WATER when standing in water', () => {
    const ent = createEntity();
    (context.entities.pointcontents as any).mockReturnValue(0); // Not solid

    // Trace hits something
    (context.entities.trace as any).mockReturnValue({
      fraction: 0.1,
      endpos: { x: 0, y: 0, z: -24 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    } as TraceResult);

    // pointcontents at hit point is water
    (context.entities.pointcontents as any).mockImplementation((pos: any) => {
       if (pos.z <= -24) return CONTENTS_WATER;
       return 0;
    });

    expect(M_CheckBottomEx(ent, context.entities)).toBe(BOTTOM_WATER);
  });
});
