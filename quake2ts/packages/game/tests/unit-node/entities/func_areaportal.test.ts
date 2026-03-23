import { describe, it, expect, vi } from 'vitest';
import { registerFuncSpawns } from '../../../src/entities/funcs.js';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('func_areaportal', () => {
  it('should register func_areaportal', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);
    expect(registry.get('func_areaportal')).toBeDefined();
  });

  it('should initialize func_areaportal', () => {
    const context = createTestContext();
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    const entity = spawnEntity(context.entities, createEntityFactory({
      classname: 'func_areaportal',
      use: undefined,
    }));

    const spawn = registry.get('func_areaportal');
    spawn?.(entity, context);

    // Should be useable to toggle
    expect(entity.use).toBeDefined();
  });
});
