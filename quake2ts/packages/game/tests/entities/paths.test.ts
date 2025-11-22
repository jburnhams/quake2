import { describe, it, expect } from 'vitest';
import { registerPathSpawns } from '../../src/entities/paths.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { Entity, Solid } from '../../src/entities/entity.js';

describe('path_corner', () => {
  it('should register path_corner', () => {
    const registry = new SpawnRegistry();
    registerPathSpawns(registry);
    expect(registry.get('path_corner')).toBeDefined();
  });

  it('should spawn a path_corner with correct defaults', () => {
    const registry = new SpawnRegistry();
    registerPathSpawns(registry);

    const entity = {
      classname: 'path_corner',
    } as Entity;

    const spawn = registry.get('path_corner');
    spawn?.(entity, {} as any);

    expect(entity.solid).toBe(Solid.Not);
    expect(entity.touch).toBeDefined();
  });
});
