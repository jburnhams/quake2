import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerMiscModel } from '../../../../src/entities/misc/more_misc.js';
import { Entity, MoveType, Solid } from '../../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';
import { SpawnRegistry } from '../../../../src/entities/spawn.js';

describe('misc_model', () => {
  let context: ReturnType<typeof createTestContext>;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerMiscModel(registry);
    context.entities.setSpawnRegistry(registry);
    vi.clearAllMocks();
  });

  it('registers misc_model spawn function', () => {
    expect(registry.get('misc_model')).toBeDefined();
  });

  it('sets model index if model provided', () => {
    const spawnFunc = registry.get('misc_model');
    const entity = context.entities.spawn();
    entity.classname = 'misc_model';
    entity.model = 'models/test/tris.md2';

    spawnFunc?.(entity, {
      entities: context.entities,
      keyValues: {},
      warn: vi.fn(),
      free: vi.fn()
    });

    expect(context.entities.modelIndex).toHaveBeenCalledWith('models/test/tris.md2');
    expect(context.entities.linkentity).toHaveBeenCalledWith(entity);
  });

  it('frees entity if no model provided', () => {
    const spawnFunc = registry.get('misc_model');
    const entity = context.entities.spawn();
    entity.classname = 'misc_model';
    // No model

    const warn = vi.fn();
    const free = vi.fn();

    spawnFunc?.(entity, {
        entities: context.entities,
        keyValues: {},
        warn,
        free
    });

    expect(warn).toHaveBeenCalled();
    expect(free).toHaveBeenCalledWith(entity);
    expect(context.entities.linkentity).not.toHaveBeenCalled();
  });
});
