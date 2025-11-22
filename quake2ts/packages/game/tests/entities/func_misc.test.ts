import { describe, it, expect, vi } from 'vitest';
import { registerFuncSpawns } from '../../src/entities/funcs.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';

describe('func_misc', () => {
  it('should register misc func spawns', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);
    expect(registry.get('func_conveyor')).toBeDefined();
    expect(registry.get('func_water')).toBeDefined();
    expect(registry.get('func_explosive')).toBeDefined();
    expect(registry.get('func_killbox')).toBeDefined();
  });

  it('should initialize func_explosive', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);
    const spawn = registry.get('func_explosive');
    const entity = { classname: 'func_explosive' } as Entity;
    spawn?.(entity, { entities: {} } as any);

    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.takedamage).toBe(true);
    expect(entity.die).toBeDefined();
  });

  it('should initialize func_killbox', () => {
      const registry = new SpawnRegistry();
      registerFuncSpawns(registry);
      const spawn = registry.get('func_killbox');
      const entity = { classname: 'func_killbox' } as Entity;

      const system = {
          killBox: vi.fn(),
      } as unknown as EntitySystem;

      spawn?.(entity, { entities: system } as any);

      expect(entity.solid).toBe(Solid.Not);
      expect(entity.touch).toBeUndefined();
      expect(entity.use).toBeDefined();

      entity.use?.(entity, {} as Entity, {} as Entity);
      expect(system.killBox).toHaveBeenCalledWith(entity);
  });

  it('should initialize func_conveyor', () => {
      const registry = new SpawnRegistry();
      registerFuncSpawns(registry);
      const spawn = registry.get('func_conveyor');
      const entity = { classname: 'func_conveyor' } as Entity;
      spawn?.(entity, { entities: {} } as any);

      expect(entity.solid).toBe(Solid.Bsp);
      expect(entity.movetype).toBe(MoveType.None);
  });
});
