import { describe, it, expect, vi } from 'vitest';
import { registerFuncSpawns } from '../../../src/entities/funcs.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createTestContext } from '@quake2ts/test-utils';

describe('func_areaportal', () => {
  it('should register func_areaportal', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);
    expect(registry.get('func_areaportal')).toBeDefined();
  });

  it('should initialize func_areaportal', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    const entity = {
      classname: 'func_areaportal',
      use: undefined,
    } as Entity;

    const context = createTestContext();

    const spawn = registry.get('func_areaportal');
    spawn?.(entity, context);

    // Should be useable to toggle
    expect(entity.use).toBeDefined();
  });
});
