import { describe, it, expect, beforeEach } from 'vitest';
import { getEntityGraph, getEntityTargets, getEntitySources } from '../../../src/editor/graph';
import { EntitySystem } from '../../../src/entities/system';
import { Entity } from '../../../src/entities/entity';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Entity Graph', () => {
  let mockEntitySystem: EntitySystem;
  let context: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    context = createTestContext();
    mockEntitySystem = context.entities;
  });

  function createEntity(id: number, classname: string, targetname?: string, target?: string, killtarget?: string): Entity {
    return spawnEntity(mockEntitySystem, createEntityFactory({
      classname,
      targetname,
      target,
      killtarget
    }));
  }

  it('should generate a graph with nodes and edges', () => {
    const e1 = createEntity(1, 'trigger_once', undefined, 'door1');
    const e2 = createEntity(2, 'func_door', 'door1');

    const graph = getEntityGraph(mockEntitySystem);
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]).toEqual({
      from: e1.index,
      to: e2.index,
      type: 'target'
    });
  });

  it('should handle killtargets', () => {
    const e1 = createEntity(1, 'trigger_multiple', undefined, undefined, 'monster1');
    const e2 = createEntity(2, 'monster_soldier', 'monster1');

    const graph = getEntityGraph(mockEntitySystem);
    expect(graph.edges[0]).toEqual({
      from: e1.index,
      to: e2.index,
      type: 'killtarget'
    });
  });

  it('should get forward targets', () => {
    const e1 = createEntity(1, 'trigger_once', undefined, 'target1');
    const e2 = createEntity(2, 'func_door', 'target1');
    const e3 = createEntity(3, 'func_door', 'target1');

    const targets = getEntityTargets(mockEntitySystem, e1.index);
    expect(targets).toHaveLength(2);
    expect(targets).toContain(e2.index);
    expect(targets).toContain(e3.index);
  });

  it('should get reverse sources', () => {
    const e1 = createEntity(1, 'trigger_once', undefined, 'door1');
    const e2 = createEntity(2, 'trigger_multiple', undefined, 'door1');
    const e3 = createEntity(3, 'func_door', 'door1');

    const sources = getEntitySources(mockEntitySystem, e3.index);
    expect(sources).toHaveLength(2);
    expect(sources).toContain(e1.index);
    expect(sources).toContain(e2.index);
  });
});
