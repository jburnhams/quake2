import { describe, it, expect } from 'vitest';
import { registerLightSpawns } from '../../src/entities/lights.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { Solid, MoveType } from '../../src/entities/entity.js';
import { createEntityFactory } from '@quake2ts/test-utils';

describe('lights', () => {
  it('should register light spawns', () => {
    const registry = new SpawnRegistry();
    registerLightSpawns(registry);
    expect(registry.get('light')).toBeDefined();
    expect(registry.get('light_mine1')).toBeDefined();
    expect(registry.get('light_mine2')).toBeDefined();
  });

  it('should spawn lights as non-solid', () => {
    const registry = new SpawnRegistry();
    registerLightSpawns(registry);
    const spawn = registry.get('light');
    const entity = createEntityFactory({ classname: 'light' });

    spawn?.(entity, {} as any);
    expect(entity.solid).toBe(Solid.Not);
    expect(entity.movetype).toBe(MoveType.None);
  });
});
