import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_worldspawn } from '../../../src/entities/worldspawn.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('SP_worldspawn', () => {
  let entity: Entity;
  let context: SpawnContext;
  let keyValues: Record<string, string>;
  let configstringMock: any;

  beforeEach(() => {
    entity = new Entity(0);
    keyValues = {};
    configstringMock = vi.fn();
    context = {
      keyValues,
      entities: {
        world: entity,
        spawn: () => new Entity(1),
        free: vi.fn(),
        finalizeSpawn: vi.fn(),
        freeImmediate: vi.fn(),
        imports: {
            configstring: configstringMock
        }
      } as any,
      warn: vi.fn(),
      free: vi.fn(),
      health_multiplier: 1
    };
  });

  it('initializes default values', () => {
    SP_worldspawn(entity, context);
    expect(entity.classname).toBe('worldspawn');
    expect(entity.movetype).toBe(MoveType.Push);
    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.modelindex).toBe(1);
  });

  it('preserves existing modelindex', () => {
    entity.modelindex = 5;
    SP_worldspawn(entity, context);
    expect(entity.modelindex).toBe(5);
  });

  it('parses sky keys (logging only for now)', () => {
    // This test primarily verifies it doesn't crash on keys
    context.keyValues['sky'] = 'unit1_sky';
    context.keyValues['skyrotate'] = '0 10 0';
    context.keyValues['skyaxis'] = '0 0 1';

    SP_worldspawn(entity, context);

    expect(configstringMock).toHaveBeenCalledWith(ConfigStringIndex.Sky, 'unit1_sky');
    expect(configstringMock).toHaveBeenCalledWith(ConfigStringIndex.SkyRotate, '0 10 0');
    expect(configstringMock).toHaveBeenCalledWith(ConfigStringIndex.SkyAxis, '0 0 1');
  });

  it('parses sounds key', () => {
     context.keyValues['sounds'] = '5';
     SP_worldspawn(entity, context);
     expect(configstringMock).toHaveBeenCalledWith(ConfigStringIndex.CdTrack, '5');
  });
});
