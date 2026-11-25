import { describe, it, expect, vi } from 'vitest';
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

    const entity = createEntityFactory({ classname: 'path_corner', targetname: 'p1' });

    const spawn = registry.get('path_corner');
    const linkentity = vi.fn();
    spawn?.(entity, { entities: { linkentity }, warn: vi.fn(), free: vi.fn() } as any);

    // SP_path_corner: a trigger, so a monster walking into it touches it.
    expect(entity.solid).toBe(Solid.Trigger);
    expect(entity.touch).toBeDefined();
    expect(entity.mins).toEqual({ x: -8, y: -8, z: -8 });
    expect(linkentity).toHaveBeenCalledWith(entity);
  });

  it('frees a path_corner with no targetname', () => {
    const registry = new SpawnRegistry();
    registerPathSpawns(registry);
    const entity = createEntityFactory({ classname: 'path_corner' });
    const free = vi.fn();
    registry.get('path_corner')?.(entity, { entities: { linkentity: vi.fn() }, warn: vi.fn(), free } as any);
    expect(free).toHaveBeenCalledWith(entity);
  });
});
