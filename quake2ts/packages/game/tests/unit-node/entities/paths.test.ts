import { describe, it, expect } from 'vitest';
import { registerPathSpawns } from '../../../src/entities/paths.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { Solid } from '../../../src/entities/entity.js';
import { createEntityFactory } from '@quake2ts/test-utils';

describe('path_corner', () => {
  it('should register path_corner', () => {
    const registry = new SpawnRegistry();
    registerPathSpawns(registry);
    expect(registry.get('path_corner')).toBeDefined();
  });

  it('should spawn a path_corner with correct defaults', () => {
    const registry = new SpawnRegistry();
    registerPathSpawns(registry);

    const entity = createEntityFactory({ classname: 'path_corner' });

    const spawn = registry.get('path_corner');
    spawn?.(entity, {} as any);

    expect(entity.solid).toBe(Solid.Not);
    expect(entity.touch).toBeDefined();
  });
});
