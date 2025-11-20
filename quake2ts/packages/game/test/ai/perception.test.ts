import { describe, expect, it } from 'vitest';
import { FL_NOVISIBLE, SPAWNFLAG_MONSTER_AMBUSH, TraceMask } from '../../src/ai/constants.js';
import {
  RangeCategory,
  classifyRange,
  infront,
  rangeTo,
  visible,
  type TraceFunction,
} from '../../src/ai/perception.js';
import { Entity } from '../../src/entities/entity.js';

function makeEntity(index: number): Entity {
  const entity = new Entity(index);
  entity.inUse = true;
  return entity;
}

describe('range classification', () => {
  it('measures distance between bounding boxes', () => {
    const self = makeEntity(1);
    const other = makeEntity(2);

    self.mins = { x: -16, y: -16, z: -16 };
    self.maxs = { x: 16, y: 16, z: 16 };

    other.mins = { x: -16, y: -16, z: -16 };
    other.maxs = { x: 16, y: 16, z: 16 };

    // Overlapping boxes are zero distance.
    expect(rangeTo(self, other)).toBe(0);

    // Move the second entity so the boxes are 8 units apart edge-to-edge.
    other.origin = { x: 40, y: 0, z: 0 };
    expect(rangeTo(self, other)).toBe(8);
  });

  it('matches rerelease range buckets at threshold boundaries', () => {
    expect(classifyRange(20)).toBe(RangeCategory.Melee);
    expect(classifyRange(21)).toBe(RangeCategory.Near);
    expect(classifyRange(440)).toBe(RangeCategory.Near);
    expect(classifyRange(441)).toBe(RangeCategory.Mid);
    expect(classifyRange(940)).toBe(RangeCategory.Mid);
    expect(classifyRange(941)).toBe(RangeCategory.Far);
  });
});

describe('field of view checks', () => {
  it('accepts a wide cone for standard monsters', () => {
    const self = makeEntity(3);
    const target = makeEntity(4);

    self.angles.y = 0;
    target.origin = { x: 0, y: 32, z: 0 }; // 90 degrees to the right

    expect(infront(self, target)).toBe(true);
  });

  it('uses a narrow cone for ambush monsters without a trail or enemy', () => {
    const self = makeEntity(5);
    const target = makeEntity(6);

    self.angles.y = 0;
    self.spawnflags |= SPAWNFLAG_MONSTER_AMBUSH;
    target.origin = { x: 0, y: 32, z: 0 }; // 90 degrees to the right

    expect(infront(self, target)).toBe(false);

    // Once an enemy is assigned, ambush monsters revert to the wider check.
    self.enemy = target;
    expect(infront(self, target)).toBe(true);
  });
});

describe('visibility checks', () => {
  function makeTrace(
    result: { fraction: number; entity: Entity | null },
    assertions: (start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }, ignore: Entity, mask: TraceMask) => void,
  ): TraceFunction {
    return (start, end, ignore, mask) => {
      assertions(start, end, ignore, mask);
      return result;
    };
  }

  it('traces from eye heights and respects windows by default', () => {
    const self = makeEntity(7);
    const target = makeEntity(8);

    self.origin = { x: 0, y: 0, z: 0 };
    self.viewheight = 24;
    target.origin = { x: 0, y: 0, z: 32 };
    target.viewheight = 16;

    let called = false;
    const trace = makeTrace({ fraction: 1, entity: null }, (start, end, ignore, mask) => {
      called = true;
      expect(start).toEqual({ x: 0, y: 0, z: 24 });
      expect(end).toEqual({ x: 0, y: 0, z: 48 });
      expect(ignore).toBe(self);
      expect(mask).toBe(TraceMask.Opaque | TraceMask.Window);
    });

    expect(visible(self, target, trace)).toBe(true);
    expect(called).toBe(true);
  });

  it('accepts direct hits on the target entity', () => {
    const self = makeEntity(9);
    const target = makeEntity(10);

    const trace = makeTrace({ fraction: 0.25, entity: target }, () => {});

    expect(visible(self, target, trace)).toBe(true);
  });

  it('rejects targets flagged as not visible', () => {
    const self = makeEntity(11);
    const target = makeEntity(12);

    target.flags = FL_NOVISIBLE;

    const trace = makeTrace({ fraction: 1, entity: null }, () => {
      throw new Error('trace should not be invoked');
    });

    expect(visible(self, target, trace)).toBe(false);
  });

  it('omits window surfaces when throughGlass is true', () => {
    const self = makeEntity(13);
    const target = makeEntity(14);

    const trace = makeTrace({ fraction: 1, entity: null }, (_start, _end, _ignore, mask) => {
      expect(mask).toBe(TraceMask.Opaque);
    });

    expect(visible(self, target, trace, { throughGlass: true })).toBe(true);
  });
});
