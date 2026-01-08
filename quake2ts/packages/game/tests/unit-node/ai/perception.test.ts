import { describe, expect, it } from 'vitest';
import {
  Entity,
  RangeCategory,
  classifyRange,
  infront,
  rangeTo,
  visible,
} from '../../src/index.js';
import { FL_NOVISIBLE, RANGE_MELEE, RANGE_NEAR, RANGE_MID, SPAWNFLAG_MONSTER_AMBUSH, TraceMask } from '../../src/ai/constants.js';
import type { TraceFunction } from '../../src/ai/perception.js';
import { createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';
import { ZERO_VEC3 } from '@quake2ts/shared';

// Helper to create a full Entity instance from factory data
function createTestEntity(id: number = 1, overrides: Partial<Entity> = {}): Entity {
    const ent = new Entity(id);
    const data = createEntityFactory(overrides);
    Object.assign(ent, data);

    // Ensure minimal required fields for perception if factory skipped them
    if (!ent.origin) ent.origin = { ...ZERO_VEC3 };
    if (!ent.mins) ent.mins = { x: -16, y: -16, z: -24 };
    if (!ent.maxs) ent.maxs = { x: 16, y: 16, z: 32 };

    return ent;
}

function createPlayerTestEntity(id: number = 1, overrides: Partial<Entity> = {}): Entity {
  const ent = new Entity(id);
  const data = createPlayerEntityFactory(overrides);
  Object.assign(ent, data);
  if (!ent.origin) ent.origin = { ...ZERO_VEC3 };
  return ent;
}

function withBounds(entity: Entity, origin: [number, number, number], mins: [number, number, number], maxs: [number, number, number]): Entity {
  entity.origin = { x: origin[0], y: origin[1], z: origin[2] };
  entity.mins = { x: mins[0], y: mins[1], z: mins[2] };
  entity.maxs = { x: maxs[0], y: maxs[1], z: maxs[2] };
  return entity;
}

describe('rangeTo', () => {
  it('returns zero for overlapping bounds', () => {
    const a = withBounds(createTestEntity(1), [0, 0, 0], [-1, -1, -1], [1, 1, 1]);
    const b = withBounds(createTestEntity(2), [0.5, 0.5, 0], [-1, -1, -1], [1, 1, 1]);

    expect(rangeTo(a, b)).toBe(0);
  });

  it('matches rerelease bounding box distance along one axis', () => {
    const a = withBounds(createTestEntity(1), [0, 0, 0], [-1, -1, -1], [1, 1, 1]);
    const b = withBounds(createTestEntity(2), [3, 0, 0], [-1, -1, -1], [1, 1, 1]);

    expect(rangeTo(a, b)).toBeCloseTo(1, 6);
  });

  it('sums separation on multiple axes before square root', () => {
    const a = withBounds(createTestEntity(1), [0, 0, 0], [-1, -1, -1], [1, 1, 1]);
    const b = withBounds(createTestEntity(2), [5, 5, 0], [-1, -1, -1], [1, 1, 1]);

    const expectedDistance = Math.sqrt(18);
    expect(rangeTo(a, b)).toBeCloseTo(expectedDistance, 6);
  });
});

describe('classifyRange', () => {
  it('categorizes using rerelease thresholds', () => {
    expect(classifyRange(RANGE_MELEE - 0.01)).toBe(RangeCategory.Melee);
    expect(classifyRange(RANGE_MELEE + 0.01)).toBe(RangeCategory.Near);
    expect(classifyRange(RANGE_NEAR + 0.01)).toBe(RangeCategory.Mid);
    expect(classifyRange(RANGE_MID + 0.01)).toBe(RangeCategory.Far);
  });
});

describe('infront', () => {
  it('uses the wide cone for normal monsters', () => {
    const self = createTestEntity(1, { angles: { x: 0, y: 0, z: 0 } });
    const other = createTestEntity(2);
    other.origin = { x: -1, y: 0, z: 0 };
    expect(infront(self, other)).toBe(false);

    other.origin = { x: 0.5, y: 0.5, z: 0 };
    expect(infront(self, other)).toBe(true);
  });

  it('tightens FOV for ambush monsters without a target trail', () => {
    const self = createTestEntity(1, {
        spawnflags: SPAWNFLAG_MONSTER_AMBUSH,
        angles: { x: 0, y: 0, z: 0 },
        trail_time: 0
    });

    const other = createTestEntity(2);
    other.origin = { x: 0.1, y: 1, z: 0 };

    expect(infront(self, other)).toBe(false);

    other.origin = { x: 1, y: 0, z: 0 };
    expect(infront(self, other)).toBe(true);

    self.trail_time = 1;
    other.origin = { x: 0.5, y: 0.5, z: 0 };
    expect(infront(self, other)).toBe(true);
  });
});

describe('visible', () => {
  function createTracer(result: { fraction: number; ent: Entity | null; expectedMask?: TraceMask }): TraceFunction {
    return (start, mins, maxs, end, ignore, mask) => {
      // Vitest expect in callback can be tricky if not awaited, but synchronous call here works
      if (result.expectedMask !== undefined) {
        // We do a loose check or exact check depending on needs
        if (mask !== undefined) expect(mask).toBe(result.expectedMask);
      }
      return { ...result, entity: result.ent, startsolid: false, allsolid: false, endpos: end, plane: { normal: { x:0, y:0, z:1}, dist:0 } as any };
    };
  }

  it('returns false when the target is flagged invisible', () => {
    const self = createTestEntity(1);
    const other = createTestEntity(2, { flags: FL_NOVISIBLE });

    const tracer = createTracer({ fraction: 0, ent: null });
    expect(visible(self, other, tracer)).toBe(false);
  });

  it('accepts full traces or direct hits as visible', () => {
    const self = createTestEntity(1, { viewheight: 24 });
    const other = createTestEntity(2, { viewheight: 16 });

    let capturedStart: { x: number; y: number; z: number } | undefined;
    let capturedEnd: { x: number; y: number; z: number } | undefined;
    const tracer: TraceFunction = (start, mins, maxs, end) => {
      capturedStart = start;
      capturedEnd = end;
      return { fraction: 1, ent: null, entity: null, startsolid: false, allsolid: false, endpos: end, plane: { normal: { x:0, y:0, z:1}, dist:0 } as any };
    };

    expect(visible(self, other, tracer)).toBe(true);
    expect(capturedStart).toEqual({ x: 0, y: 0, z: 24 });
    expect(capturedEnd).toEqual({ x: 0, y: 0, z: 16 });

    const hitTracer = createTracer({ fraction: 0.25, ent: other });
    expect(visible(self, other, hitTracer)).toBe(true);
  });

  it('passes the expected trace mask for glass and opaque checks', () => {
    const self = createTestEntity(1);
    const other = createTestEntity(2);

    const opaqueTracer = createTracer({ fraction: 0, ent: null, expectedMask: TraceMask.Opaque | TraceMask.Window });
    visible(self, other, opaqueTracer);

    const glassTracer = createTracer({ fraction: 1, ent: null, expectedMask: TraceMask.Opaque });
    visible(self, other, glassTracer, { throughGlass: true });
  });

  it('handles invisibility powerup correctly', () => {
      const self = createTestEntity(1);
      // Use createPlayerEntityFactory to set up client structure automatically
      const other = createPlayerTestEntity(2, {
          client: {
              inventory: { armor: null, powerups: new Map(), items: new Set(), keys: new Set(), ammo: { counts: [], caps: [] }, ownedWeapons: new Set() },
              buttons: 0,
              fov: 90,
              gun_frame: 0,
              pers: {} as any,
              pm_flags: 0,
              pm_time: 0,
              pm_type: 0,
              rdflags: 0,
              weaponStates: {} as any,
              stats: [],
              kick_angles: { x: 0, y: 0, z: 0 },
              kick_origin: { x: 0, y: 0, z: 0 },
              gunoffset: { x: 0, y: 0, z: 0 },
              gunangles: { x: 0, y: 0, z: 0 },
              gunindex: 0,
              blend: [0, 0, 0, 0],
              ps: {} as any,
              invisible_time: 0,
              invisibility_fade_time: 0
          } as any // Partially mock client for specific test needs if factory defaults aren't enough, but factory should handle structure
      });

      // The factory provides the structure, we just need to override values relevant to the test
      if (other.client) {
          other.client.invisible_time = 0;
          other.client.invisibility_fade_time = 0;
      }

      const tracer: TraceFunction = (s, m1, m2, e) => ({ fraction: 1, ent: null, entity: null, startsolid: false, allsolid: false, endpos: e, plane: { normal: { x:0, y:0, z:1}, dist:0 } as any });

      // No invisibility
      expect(visible(self, other, tracer, { timeSeconds: 10 })).toBe(true);

      // Invisible active, not fading
      other.client!.invisible_time = 20; // expires at 20
      other.client!.invisibility_fade_time = 17; // fades at 17

      // Current time 10: fully invisible
      expect(visible(self, other, tracer, { timeSeconds: 10 })).toBe(false);

      // Current time 18: fading. Need to check random chance.
      const randomMock = () => 0.5;

      // Time 18 > fade 17. So we check random.
      // alpha 0. random 0.5 > 0 -> return false.
      expect(visible(self, other, tracer, { timeSeconds: 18, random: randomMock })).toBe(false);

      // Set alpha to 0.8 (mostly visible)
      other.alpha = 0.8;
      // random 0.5 <= 0.8 -> return true (visible)
      // wait: if (random() > other.alpha) return false;
      // 0.5 > 0.8 is false. So it proceeds to trace and returns true.
      expect(visible(self, other, tracer, { timeSeconds: 18, random: randomMock })).toBe(true);

      // Set alpha to 0.2 (mostly invisible)
      other.alpha = 0.2;
      // random 0.5 > 0.2 is true. Returns false.
      expect(visible(self, other, tracer, { timeSeconds: 18, random: randomMock })).toBe(false);
  });
});
