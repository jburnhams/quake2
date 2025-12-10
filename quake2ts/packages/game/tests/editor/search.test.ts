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
      index: props.id,
      origin: props.origin || { x: 0, y: 0, z: 0 },
      absmin: { x: 0, y: 0, z: 0 },
      absmax: { x: 0, y: 0, z: 0 },
      inUse: true,
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
    addEntity({ id: 1, origin: { x: 0, y: 0, z: 0 } } as any);
    addEntity({ id: 2, origin: { x: 10, y: 0, z: 0 } } as any);
    addEntity({ id: 3, origin: { x: 20, y: 0, z: 0 } } as any);

    const results = findEntitiesInRadius(mockSystem, vec3.fromValues(0, 0, 0), 15);
    expect(results).toEqual([1, 2]);
  });

  it('should find entities in bounds', () => {
    // Entity inside
    const e1 = addEntity({ id: 1 });
    e1.absmin = { x: 0, y: 0, z: 0 };
    e1.absmax = { x: 10, y: 10, z: 10 };

    // Entity outside
    const e2 = addEntity({ id: 2 });
    e2.absmin = { x: 20, y: 20, z: 20 };
    e2.absmax = { x: 30, y: 30, z: 30 };

    // Entity overlapping
    const e3 = addEntity({ id: 3 });
    e3.absmin = { x: 5, y: 5, z: 5 };
    e3.absmax = { x: 15, y: 15, z: 15 };

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
