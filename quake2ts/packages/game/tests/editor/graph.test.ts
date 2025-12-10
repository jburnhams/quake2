import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEntityGraph, getEntityTargets, getEntitySources } from '../../src/editor/graph';
import { EntitySystem } from '../../src/entities/system';
import { Entity } from '../../src/entities/entity';

describe('Entity Graph', () => {
  let mockEntitySystem: any;
  let entities: Entity[] = [];

  beforeEach(() => {
    entities = [];
    mockEntitySystem = {
      forEachEntity: (callback: (e: Entity) => void) => {
        entities.forEach(callback);
      },
      getByIndex: (index: number) => entities.find(e => e.index === index),
      findByTargetName: (name: string) => entities.filter(e => e.targetname === name)
    };
  });

  function createEntity(id: number, classname: string, targetname?: string, target?: string, killtarget?: string): Entity {
    const e = {
      index: id,
      inUse: true,
      classname,
      targetname,
      target,
      killtarget
    } as any;
    entities.push(e);
    return e;
  }

  it('should generate a graph with nodes and edges', () => {
    createEntity(1, 'trigger_once', undefined, 'door1');
    createEntity(2, 'func_door', 'door1');

    const graph = getEntityGraph(mockEntitySystem);
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]).toEqual({
      from: 1,
      to: 2,
      type: 'target'
    });
  });

  it('should handle killtargets', () => {
    createEntity(1, 'trigger_multiple', undefined, undefined, 'monster1');
    createEntity(2, 'monster_soldier', 'monster1');

    const graph = getEntityGraph(mockEntitySystem);
    expect(graph.edges[0]).toEqual({
      from: 1,
      to: 2,
      type: 'killtarget'
    });
  });

  it('should get forward targets', () => {
    const t = createEntity(1, 'trigger_once', undefined, 'target1');
    const e1 = createEntity(2, 'func_door', 'target1');
    const e2 = createEntity(3, 'func_door', 'target1');

    const targets = getEntityTargets(mockEntitySystem, 1);
    expect(targets).toHaveLength(2);
    expect(targets).toContain(2);
    expect(targets).toContain(3);
  });

  it('should get reverse sources', () => {
    const t1 = createEntity(1, 'trigger_once', undefined, 'door1');
    const t2 = createEntity(2, 'trigger_multiple', undefined, 'door1');
    const d = createEntity(3, 'func_door', 'door1');

    const sources = getEntitySources(mockEntitySystem, 3);
    expect(sources).toHaveLength(2);
    expect(sources).toContain(1);
    expect(sources).toContain(2);
  });
});
