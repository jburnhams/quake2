import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  M_CheckBottom,
  M_CheckBottomEx,
} from '../../src/index.js';
import { MoveType, Solid } from '../../src/entities/entity.js';
import { CONTENTS_SOLID, CONTENTS_WATER, CONTENTS_SLIME, CONTENTS_LAVA } from '@quake2ts/shared';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

// Constants expected to be exported or defined
export const BOTTOM_EMPTY = 0;
export const BOTTOM_SOLID = 1;
export const BOTTOM_WATER = 2;
export const BOTTOM_SLIME = 3;
export const BOTTOM_LAVA = 4;

describe('M_CheckBottom', () => {
  let context: any;
  let ent: any;

  beforeEach(() => {
    const testCtx = createTestContext();
    context = testCtx.entities;

    ent = spawnEntity(context, createEntityFactory({
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      movetype: MoveType.Step,
      solid: Solid.Bbox,
    }));

    // Default trace: in air (fraction 1.0)
    vi.spyOn(context, 'trace').mockReturnValue({
      fraction: 1.0,
      allsolid: false,
      startsolid: false,
      ent: null,
      endpos: { x: 0, y: 0, z: 0 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });

    // Default pointcontents: empty
    vi.spyOn(context, 'pointcontents').mockReturnValue(0);
  });

  it('returns true if all 4 corners are in solid (Fast Check)', () => {
    // pointcontents returns CONTENTS_SOLID for all calls
    context.pointcontents.mockReturnValue(CONTENTS_SOLID);

    expect(M_CheckBottom(ent, context)).toBe(true);

    // Should check 4 corners
    expect(context.pointcontents).toHaveBeenCalledTimes(4);
  });

  it('falls back to Slow Check if any corner is not solid', () => {
    // First corner empty, forcing slow check
    context.pointcontents.mockReturnValueOnce(0);

    // Slow check trace: hits ground immediately (fraction 0, or close)
    context.trace.mockReturnValue({
      fraction: 0.1,
      endpos: { x: 0, y: 0, z: ent.origin.z + ent.mins.z }, // landed on ground
      ent: {} as any, // hit something
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });

    // The slow check does a center trace first, then 4 quadrant traces.
    // If center trace hits, and quadrants hit within stepsize, it returns true.

    expect(M_CheckBottom(ent, context)).toBe(true);
  });

  it('returns false if center trace hits nothing (floating in air)', () => {
    context.pointcontents.mockReturnValue(0); // Fail fast check

    // Center trace returns fraction 1.0 (empty)
    context.trace.mockReturnValue({
      fraction: 1.0,
      endpos: { x: 0, y: 0, z: -100 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });

    expect(M_CheckBottom(ent, context)).toBe(false);
  });

  it('returns false if a corner drops too far (hanging off ledge)', () => {
    context.pointcontents.mockReturnValue(0); // Fail fast check

    // Center trace hits ground at z = -24 (base of entity)
    context.trace.mockReturnValueOnce({
      fraction: 0.1,
      endpos: { x: 0, y: 0, z: -24 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });

    // Sub-traces:
    // 3 corners hit at -24
    // 1 corner hits at -100 (cliff)
    context.trace
      .mockReturnValueOnce({ fraction: 0.1, endpos: { x: 0, y: 0, z: -24 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } })
      .mockReturnValueOnce({ fraction: 0.1, endpos: { x: 0, y: 0, z: -24 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } })
      .mockReturnValueOnce({ fraction: 0.1, endpos: { x: 0, y: 0, z: -24 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } })
      .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: -100 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } }); // cliff

    expect(M_CheckBottom(ent, context)).toBe(false);
  });
});

describe('M_CheckBottomEx', () => {
  let context: any;
  let ent: any;

  beforeEach(() => {
    const testCtx = createTestContext();
    context = testCtx.entities;

    ent = spawnEntity(context, createEntityFactory({
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      movetype: MoveType.Step,
      solid: Solid.Bbox,
    }));

     // Default trace: in air (fraction 1.0)
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

  it('returns BOTTOM_SOLID when on solid ground', () => {
    context.pointcontents.mockReturnValue(CONTENTS_SOLID); // Fast check pass
    expect(M_CheckBottomEx(ent, context)).toBe(BOTTOM_SOLID);
  });

  it('returns BOTTOM_EMPTY when in air', () => {
    context.pointcontents.mockReturnValue(0);
    context.trace.mockReturnValue({ fraction: 1.0, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } });

    expect(M_CheckBottomEx(ent, context)).toBe(BOTTOM_EMPTY);
  });

  it('returns BOTTOM_WATER when standing in water', () => {
    context.pointcontents.mockReturnValue(0); // Not solid

    // Trace hits something
    context.trace.mockReturnValue({
      fraction: 0.1,
      endpos: { x: 0, y: 0, z: -24 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
    });

    // pointcontents at hit point is water
    context.pointcontents.mockImplementation((pos: any) => {
       if (pos.z <= -24) return CONTENTS_WATER;
       return 0;
    });

    expect(M_CheckBottomEx(ent, context)).toBe(BOTTOM_WATER);
  });
});
