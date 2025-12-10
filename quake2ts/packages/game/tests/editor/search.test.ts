import { describe, it, expect, beforeEach } from 'vitest';
import {
  findEntitiesByClassname,
  findEntitiesByTargetname,
  findEntitiesInRadius,
  findEntitiesInBounds,
  searchEntityFields,
  getAllEntityClassnames
} from '../../src/editor/search';
import { Entity } from '../../src/entities/entity';
import { vec3 } from 'gl-matrix';

describe('Entity Search', () => {
  let mockSystem: any;
  let entities: Entity[] = [];

  beforeEach(() => {
    entities = [];
    mockSystem = {
      forEachEntity: (cb: (e: Entity) => void) => {
        entities.forEach(cb);
      }
    };
  });

  function addEntity(props: Partial<Entity> & { id: number }) {
    const e = {
      s: {
        number: props.id,
        origin: props.s?.origin || vec3.create()
      },
      absmin: vec3.create(),
      absmax: vec3.create(),
      inuse: true,
      ...props
    } as any;
    entities.push(e);
    return e;
  }

  it('should find entities by classname', () => {
    addEntity({ id: 1, classname: 'foo' });
    addEntity({ id: 2, classname: 'bar' });
    addEntity({ id: 3, classname: 'foo' });

    const results = findEntitiesByClassname(mockSystem, 'foo');
    expect(results).toEqual([1, 3]);
  });

  it('should find entities by targetname', () => {
    addEntity({ id: 1, targetname: 't1' });
    addEntity({ id: 2, targetname: 't2' });

    const results = findEntitiesByTargetname(mockSystem, 't1');
    expect(results).toEqual([1]);
  });

  it('should find entities in radius', () => {
    addEntity({ id: 1, s: { number: 1, origin: vec3.fromValues(0, 0, 0) } } as any);
    addEntity({ id: 2, s: { number: 2, origin: vec3.fromValues(10, 0, 0) } } as any);
    addEntity({ id: 3, s: { number: 3, origin: vec3.fromValues(20, 0, 0) } } as any);

    const results = findEntitiesInRadius(mockSystem, vec3.fromValues(0, 0, 0), 15);
    expect(results).toEqual([1, 2]);
  });

  it('should find entities in bounds', () => {
    // Entity inside
    const e1 = addEntity({ id: 1 });
    vec3.set(e1.absmin, 0, 0, 0);
    vec3.set(e1.absmax, 10, 10, 10);

    // Entity outside
    const e2 = addEntity({ id: 2 });
    vec3.set(e2.absmin, 20, 20, 20);
    vec3.set(e2.absmax, 30, 30, 30);

    // Entity overlapping
    const e3 = addEntity({ id: 3 });
    vec3.set(e3.absmin, 5, 5, 5);
    vec3.set(e3.absmax, 15, 15, 15);

    const mins = vec3.fromValues(-5, -5, -5);
    const maxs = vec3.fromValues(12, 12, 12);

    const results = findEntitiesInBounds(mockSystem, mins, maxs);
    expect(results).toContain(1);
    expect(results).toContain(3);
    expect(results).not.toContain(2);
  });

  it('should search entity fields', () => {
    addEntity({ id: 1, health: 100 } as any);
    addEntity({ id: 2, health: 50 } as any);
    addEntity({ id: 3, health: 100 } as any);

    const results = searchEntityFields(mockSystem, 'health', 100);
    expect(results).toEqual([1, 3]);
  });

  it('should get all entity classnames', () => {
    addEntity({ id: 1, classname: 'foo' });
    addEntity({ id: 2, classname: 'bar' });
    addEntity({ id: 3, classname: 'foo' });
    addEntity({ id: 4, classname: 'baz' });

    const results = getAllEntityClassnames(mockSystem);
    expect(results).toEqual(['bar', 'baz', 'foo']);
  });
});
