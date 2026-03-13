import { describe, it, expect, vi } from 'vitest';
import { registerFuncSpawns } from '../../../src/entities/funcs.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('func_plat', () => {
  it('should register func_plat', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);
    expect(registry.get('func_plat')).toBeDefined();
  });

  it('should initialize func_plat', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    const context = createTestContext();
    const system = context.entities;

    const entity = spawnEntity(system, createEntityFactory({
      classname: 'func_plat',
      angles: { x: 0, y: 0, z: 0 },
      origin: { x: 0, y: 0, z: 100 },
      mins: { x: -10, y: -10, z: -10 },
      maxs: { x: 10, y: 10, z: 10 },
      size: { x: 20, y: 20, z: 20 }, // Added size
    }));

    vi.spyOn(system, 'spawn');

    const spawn = registry.get('func_plat');
    spawn?.(entity, context);

    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.Push);
    expect(entity.blocked).toBeDefined();
    expect(entity.use).toBeDefined();

    expect(entity.pos1).toBeDefined();
    expect(entity.pos2).toBeDefined();

    // Check that a trigger was spawned
    expect(system.spawn).toHaveBeenCalled();
  });
});
