import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_worldspawn } from '../../src/entities/worldspawn.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { SpawnContext } from '../../src/entities/spawn.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { EntitySystem } from '../../src/entities/system.js';

describe('Worldspawn Entity', () => {
  let entity: Entity;
  let context: SpawnContext;
  let mockConfigString: any;

  beforeEach(() => {
    entity = {
      classname: '',
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    } as any;

    mockConfigString = vi.fn();

    context = {
      entities: {
        imports: {
          configstring: mockConfigString
        }
      } as any,
      keyValues: {}
    };
  });

  it('should set basic properties', () => {
    SP_worldspawn(entity, context);
    expect(entity.classname).toBe('worldspawn');
    expect(entity.movetype).toBe(MoveType.Push);
    expect(entity.solid).toBe(Solid.Bsp);
  });

  it('should set CS_SKY configstring if sky key is present', () => {
    context.keyValues['sky'] = 'unit1_';
    SP_worldspawn(entity, context);
    expect(mockConfigString).toHaveBeenCalledWith(ConfigStringIndex.Sky, 'unit1_');
  });

  it('should set CS_SKYROTATE configstring if skyrotate key is present', () => {
    context.keyValues['skyrotate'] = '10';
    SP_worldspawn(entity, context);
    expect(mockConfigString).toHaveBeenCalledWith(ConfigStringIndex.SkyRotate, '10');
  });

  it('should set CS_SKYAXIS configstring if skyaxis key is present', () => {
    context.keyValues['skyaxis'] = '0 0 1';
    SP_worldspawn(entity, context);
    expect(mockConfigString).toHaveBeenCalledWith(ConfigStringIndex.SkyAxis, '0 0 1');
  });

  it('should set CS_CDTRACK configstring if sounds key is present', () => {
    context.keyValues['sounds'] = '5';
    SP_worldspawn(entity, context);
    expect(mockConfigString).toHaveBeenCalledWith(ConfigStringIndex.CdTrack, '5');
  });
});
