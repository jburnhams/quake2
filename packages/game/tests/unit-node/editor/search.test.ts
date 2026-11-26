import { describe, it, expect, beforeEach } from 'vitest';
import {
  findEntitiesByClassname,
  findEntitiesByTargetname,
  findEntitiesInRadius,
  findEntitiesInBounds,
  searchEntityFields,
  getAllEntityClassnames
} from '../../../src/editor/search';
import { EntitySystem } from '../../../src/entities/system';
import { Entity } from '../../../src/entities/entity';
import { vec3 } from 'gl-matrix';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Entity Search', () => {
  let mockSystem: EntitySystem;

  beforeEach(() => {
    const ctx = createTestContext();
    mockSystem = ctx.entities;
  });

  function addEntity(props: Partial<Entity>): Entity {
    const e = spawnEntity(mockSystem, createEntityFactory({
      origin: props.origin || { x: 0, y: 0, z: 0 },
      absmin: { x: 0, y: 0, z: 0 },
      absmax: { x: 0, y: 0, z: 0 },
      ...props
    }));
    return e;
  }

  it('should find entities by classname', () => {
    const e1 = addEntity({ classname: 'foo' });
    const e2 = addEntity({ classname: 'bar' });
    const e3 = addEntity({ classname: 'foo' });

    const results = findEntitiesByClassname(mockSystem, 'foo');
    expect(results).toEqual([e1.index, e3.index]);
  });

  it('should find entities by targetname', () => {
    const e1 = addEntity({ targetname: 't1' });
    const e2 = addEntity({ targetname: 't2' });

    const results = findEntitiesByTargetname(mockSystem, 't1');
    expect(results).toEqual([e1.index]);
  });

  it('should find entities in radius', () => {
    const e1 = addEntity({ origin: { x: 0, y: 0, z: 0 } });
    const e2 = addEntity({ origin: { x: 10, y: 0, z: 0 } });
    const e3 = addEntity({ origin: { x: 20, y: 0, z: 0 } });

    const results = findEntitiesInRadius(mockSystem, vec3.fromValues(0, 0, 0), 15);
    expect(results).toEqual([e1.index, e2.index]);
  });

  it('should find entities in bounds', () => {
    // Entity inside
    const e1 = addEntity({});
    e1.absmin = { x: 0, y: 0, z: 0 };
    e1.absmax = { x: 10, y: 10, z: 10 };

    // Entity outside
    const e2 = addEntity({});
    e2.absmin = { x: 20, y: 20, z: 20 };
    e2.absmax = { x: 30, y: 30, z: 30 };

    // Entity overlapping
    const e3 = addEntity({});
    e3.absmin = { x: 5, y: 5, z: 5 };
    e3.absmax = { x: 15, y: 15, z: 15 };

    const mins = vec3.fromValues(-5, -5, -5);
    const maxs = vec3.fromValues(12, 12, 12);

    const results = findEntitiesInBounds(mockSystem, mins, maxs);
    expect(results).toContain(e1.index);
    expect(results).toContain(e3.index);
    expect(results).not.toContain(e2.index);
  });

  it('should search entity fields', () => {
    const e1 = addEntity({ health: 100 });
    const e2 = addEntity({ health: 50 });
    const e3 = addEntity({ health: 100 });

    const results = searchEntityFields(mockSystem, 'health', 100);
    expect(results).toEqual([e1.index, e3.index]);
  });

  it('should get all entity classnames', () => {
    addEntity({ classname: 'foo' });
    addEntity({ classname: 'bar' });
    addEntity({ classname: 'foo' });
    addEntity({ classname: 'baz' });

    const results = getAllEntityClassnames(mockSystem);
    expect(results).toEqual(['bar', 'baz', 'foo']);
  });
});
