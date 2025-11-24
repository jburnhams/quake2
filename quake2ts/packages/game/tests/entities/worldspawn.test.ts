import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_worldspawn } from '../../src/entities/worldspawn.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { SpawnContext } from '../../src/entities/spawn.js';

describe('SP_worldspawn', () => {
  let entity: Entity;
  let context: SpawnContext;
  let keyValues: Record<string, string>;

  beforeEach(() => {
    entity = new Entity(0);
    keyValues = {};
    context = {
      keyValues,
      entities: {
        world: entity,
        spawn: () => new Entity(1),
        free: vi.fn(),
        finalizeSpawn: vi.fn(),
        freeImmediate: vi.fn()
      } as any,
      warn: vi.fn(),
      free: vi.fn(),
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

    // Since logic is console.log/TODO, we just ensure execution completes
    expect(entity.classname).toBe('worldspawn');
  });

  it('parses sounds key', () => {
     context.keyValues['sounds'] = '5';
     SP_worldspawn(entity, context);
     // Logic is TODO, just verify it runs
  });
});
