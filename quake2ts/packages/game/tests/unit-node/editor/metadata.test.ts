import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEntityMetadata,
  getEntityFields,
  getEntityConnections,
  getEntityBounds,
  getEntityModel
} from '../../../src/editor/metadata';
import { EntitySystem } from '../../../src/entities/system';
import { Entity } from '../../../src/entities/entity';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Entity Metadata', () => {
  let mockEntity: Entity;
  let mockSystem: EntitySystem;

  beforeEach(() => {
    const ctx = createTestContext();
    mockSystem = ctx.entities;

    mockEntity = spawnEntity(mockSystem, createEntityFactory({
      index: 42,
      origin: { x: 10, y: 20, z: 30 },
      angles: { x: 0, y: 90, z: 0 },
      modelindex: 10,
      classname: 'func_door',
      model: '*1',
      targetname: 'door1',
      target: 'trigger1',
      spawnflags: 1,
      health: 100,
      absmin: { x: 0, y: 0, z: 0 },
      absmax: { x: 10, y: 10, z: 10 }
    }));
    // Arbitrary field
    (mockEntity as any).speed = 200;

    const targetEntity = spawnEntity(mockSystem, createEntityFactory({
        classname: 'target_speaker',
        targetname: 'trigger1'
    }));
    (mockSystem as any).targetEntity = targetEntity;
  });

  it('should return correct metadata', () => {
    const metadata = getEntityMetadata(mockEntity);
    expect(metadata.id).toBe(mockEntity.index);
    expect(metadata.classname).toBe('func_door');
    expect(metadata.origin[0]).toBe(10);
    expect(metadata.model).toBe('*1');
    expect(metadata.target).toBe('trigger1');
  });

  it('should return entity fields', () => {
    const fields = getEntityFields(mockEntity);
    expect(fields['classname']).toBe('func_door');
    expect(fields['speed']).toBe(200);
    expect(fields['s']).toBeUndefined(); // Excluded explicitly in implementation
  });

  it('should return entity connections', () => {
    const connections = getEntityConnections(mockEntity, mockSystem);
    expect(connections.length).toBe(1);
    expect(connections[0].targetId).toBe((mockSystem as any).targetEntity.index);
    expect(connections[0].targetName).toBe('target_speaker');
    expect(connections[0].type).toBe('target');
  });

  it('should return entity bounds', () => {
    const bounds = getEntityBounds(mockEntity);
    expect(bounds.mins.x).toBe(0);
    expect(bounds.maxs.x).toBe(10);
  });

  it('should return entity model', () => {
    const model = getEntityModel(mockEntity);
    expect(model).not.toBeNull();
    expect(model?.modelName).toBe('*1');
    expect(model?.modelIndex).toBe(10);
  });
});
