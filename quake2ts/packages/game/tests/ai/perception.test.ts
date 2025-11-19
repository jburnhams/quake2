import { describe, expect, it } from 'vitest';
import {
  Entity,
  RangeCategory,
  classifyRange,
  infront,
  rangeTo,
  visible,
} from '../../src/index.js';
import { FL_NOVISIBLE, RANGE_MELEE, RANGE_MID, RANGE_NEAR, SPAWNFLAG_MONSTER_AMBUSH, TraceMask } from '../../src/ai/constants.js';
import type { TraceFunction } from '../../src/ai/perception.js';

function createEntity(): Entity {
  const entity = new Entity(0);
  entity.inUse = true;
  return entity;
}

function withBounds(entity: Entity, origin: [number, number, number], mins: [number, number, number], maxs: [number, number, number]): Entity {
  entity.origin = { x: origin[0], y: origin[1], z: origin[2] };
  entity.mins = { x: mins[0], y: mins[1], z: mins[2] };
  entity.maxs = { x: maxs[0], y: maxs[1], z: maxs[2] };
  return entity;
}

describe('rangeTo', () => {
  it('returns zero for overlapping bounds', () => {
    const a = withBounds(createEntity(), [0, 0, 0], [-1, -1, -1], [1, 1, 1]);
    const b = withBounds(createEntity(), [0.5, 0.5, 0], [-1, -1, -1], [1, 1, 1]);

    expect(rangeTo(a, b)).toBe(0);
  });

  it('matches rerelease bounding box distance along one axis', () => {
    const a = withBounds(createEntity(), [0, 0, 0], [-1, -1, -1], [1, 1, 1]);
    const b = withBounds(createEntity(), [3, 0, 0], [-1, -1, -1], [1, 1, 1]);

    expect(rangeTo(a, b)).toBeCloseTo(1, 6);
  });

  it('sums separation on multiple axes before square root', () => {
    const a = withBounds(createEntity(), [0, 0, 0], [-1, -1, -1], [1, 1, 1]);
    const b = withBounds(createEntity(), [5, 5, 0], [-1, -1, -1], [1, 1, 1]);

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
    const self = createEntity();
    const other = createEntity();
    other.origin = { x: -1, y: 0, z: 0 };
    expect(infront(self, other)).toBe(false);

    other.origin = { x: 0.5, y: 0.5, z: 0 };
    expect(infront(self, other)).toBe(true);
  });

  it('tightens FOV for ambush monsters without a target trail', () => {
    const self = createEntity();
    self.spawnflags |= SPAWNFLAG_MONSTER_AMBUSH;
    const other = createEntity();
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
  function createTracer(result: { fraction: number; entity: Entity | null; expectedMask?: TraceMask }): TraceFunction {
    return (start, end, ignore, mask) => {
      expect(ignore).toBeDefined();
      if (result.expectedMask !== undefined) {
        expect(mask).toBe(result.expectedMask);
      }
      return result;
    };
  }

  it('returns false when the target is flagged invisible', () => {
    const self = createEntity();
    const other = createEntity();
    other.flags |= FL_NOVISIBLE;

    const tracer = createTracer({ fraction: 0, entity: null });
    expect(visible(self, other, tracer)).toBe(false);
  });

  it('accepts full traces or direct hits as visible', () => {
    const self = createEntity();
    self.viewheight = 24;
    const other = createEntity();
    other.viewheight = 16;

    let capturedStart: { x: number; y: number; z: number } | undefined;
    let capturedEnd: { x: number; y: number; z: number } | undefined;
    const tracer: TraceFunction = (start, end) => {
      capturedStart = start;
      capturedEnd = end;
      return { fraction: 1, entity: null };
    };

    expect(visible(self, other, tracer)).toBe(true);
    expect(capturedStart).toEqual({ x: 0, y: 0, z: 24 });
    expect(capturedEnd).toEqual({ x: 0, y: 0, z: 16 });

    const hitTracer = createTracer({ fraction: 0.25, entity: other });
    expect(visible(self, other, hitTracer)).toBe(true);
  });

  it('passes the expected trace mask for glass and opaque checks', () => {
    const self = createEntity();
    const other = createEntity();

    const opaqueTracer = createTracer({ fraction: 0, entity: null, expectedMask: TraceMask.Opaque | TraceMask.Window });
    visible(self, other, opaqueTracer);

    const glassTracer = createTracer({ fraction: 1, entity: null, expectedMask: TraceMask.Opaque });
    visible(self, other, glassTracer, { throughGlass: true });
  });
});
