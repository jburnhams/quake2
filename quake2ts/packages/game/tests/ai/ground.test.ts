import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  Entity,
  M_CheckBottom,
  M_CheckBottomEx,
} from '../../src/index.js';
import { MoveType } from '../../src/entities/entity.js';
import type { EntitySystem } from '../../src/entities/system.js';
import { CONTENTS_SOLID, CONTENTS_WATER, CONTENTS_SLIME, CONTENTS_LAVA } from '@quake2ts/shared';

// Constants expected to be exported or defined
export const BOTTOM_EMPTY = 0;
export const BOTTOM_SOLID = 1;
export const BOTTOM_WATER = 2;
export const BOTTOM_SLIME = 3;
export const BOTTOM_LAVA = 4;

function createEntity(): Entity {
  const ent = new Entity(0);
  ent.inUse = true;
  ent.origin = { x: 0, y: 0, z: 0 };
  ent.mins = { x: -16, y: -16, z: -24 };
  ent.maxs = { x: 16, y: 16, z: 32 };
  ent.flags = 0;
  ent.movetype = MoveType.Step;
  return ent;
}

// Mock context
const mockTraceFn = vi.fn();
const mockPointcontentsFn = vi.fn();

const mockContext = {
  trace: mockTraceFn,
  pointcontents: mockPointcontentsFn,
} as unknown as EntitySystem;

beforeEach(() => {
  mockTraceFn.mockReset();
  mockPointcontentsFn.mockReset();

  // Default trace: in air (fraction 1.0)
  mockTraceFn.mockReturnValue({
    fraction: 1.0,
    allsolid: false,
    startsolid: false,
    ent: null,
    endpos: { x: 0, y: 0, z: 0 }
  });

  // Default pointcontents: empty
  mockPointcontentsFn.mockReturnValue(0);
});

describe('M_CheckBottom', () => {
  it('returns true if all 4 corners are in solid (Fast Check)', () => {
    const ent = createEntity();
    // pointcontents returns CONTENTS_SOLID for all calls
    mockPointcontentsFn.mockReturnValue(CONTENTS_SOLID);

    expect(M_CheckBottom(ent, mockContext)).toBe(true);

    // Should check 4 corners
    expect(mockPointcontentsFn).toHaveBeenCalledTimes(4);
  });

  it('falls back to Slow Check if any corner is not solid', () => {
    const ent = createEntity();
    // First corner empty, forcing slow check
    mockPointcontentsFn.mockReturnValueOnce(0);

    // Slow check trace: hits ground immediately (fraction 0, or close)
    mockTraceFn.mockReturnValue({
      fraction: 0.1,
      endpos: { x: 0, y: 0, z: ent.origin.z + ent.mins.z }, // landed on ground
      ent: {} // hit something
    });

    // The slow check does a center trace first, then 4 quadrant traces.
    // If center trace hits, and quadrants hit within stepsize, it returns true.

    expect(M_CheckBottom(ent, mockContext)).toBe(true);
  });

  it('returns false if center trace hits nothing (floating in air)', () => {
    const ent = createEntity();
    mockPointcontentsFn.mockReturnValue(0); // Fail fast check

    // Center trace returns fraction 1.0 (empty)
    mockTraceFn.mockReturnValue({
      fraction: 1.0,
      endpos: { x: 0, y: 0, z: -100 }
    });

    expect(M_CheckBottom(ent, mockContext)).toBe(false);
  });

  it('returns false if a corner drops too far (hanging off ledge)', () => {
    const ent = createEntity();
    mockPointcontentsFn.mockReturnValue(0); // Fail fast check

    // Center trace hits ground at z = -24 (base of entity)
    mockTraceFn.mockReturnValueOnce({
      fraction: 0.1,
      endpos: { x: 0, y: 0, z: -24 }
    });

    // Sub-traces:
    // 3 corners hit at -24
    // 1 corner hits at -100 (cliff)
    mockTraceFn
      .mockReturnValueOnce({ fraction: 0.1, endpos: { x: 0, y: 0, z: -24 } })
      .mockReturnValueOnce({ fraction: 0.1, endpos: { x: 0, y: 0, z: -24 } })
      .mockReturnValueOnce({ fraction: 0.1, endpos: { x: 0, y: 0, z: -24 } })
      .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: -100 } }); // cliff

    expect(M_CheckBottom(ent, mockContext)).toBe(false);
  });
});

describe('M_CheckBottomEx', () => {
  it('returns BOTTOM_SOLID when on solid ground', () => {
    const ent = createEntity();
    mockPointcontentsFn.mockReturnValue(CONTENTS_SOLID); // Fast check pass
    expect(M_CheckBottomEx(ent, mockContext)).toBe(BOTTOM_SOLID);
  });

  it('returns BOTTOM_EMPTY when in air', () => {
    const ent = createEntity();
    mockPointcontentsFn.mockReturnValue(0);
    mockTraceFn.mockReturnValue({ fraction: 1.0 });

    expect(M_CheckBottomEx(ent, mockContext)).toBe(BOTTOM_EMPTY);
  });

  it('returns BOTTOM_WATER when standing in water', () => {
    const ent = createEntity();
    mockPointcontentsFn.mockReturnValue(0); // Not solid

    // Trace hits something
    mockTraceFn.mockReturnValue({
      fraction: 0.1,
      endpos: { x: 0, y: 0, z: -24 }
    });

    // pointcontents at hit point is water
    mockPointcontentsFn.mockImplementation((pos) => {
       if (pos.z <= -24) return CONTENTS_WATER;
       return 0;
    });

    expect(M_CheckBottomEx(ent, mockContext)).toBe(BOTTOM_WATER);
  });
});
