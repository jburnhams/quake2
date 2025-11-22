import { describe, it, expect, vi } from 'vitest';
import { registerFuncSpawns } from '../../src/entities/funcs.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';

describe('func_rotating', () => {
  it('should register func_rotating', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);
    expect(registry.get('func_rotating')).toBeDefined();
  });

  it('should initialize func_rotating', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    const entity = {
      classname: 'func_rotating',
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      speed: 100,
    } as Entity;

    const system = {
        timeSeconds: 0,
    } as unknown as EntitySystem;

    const context = {
        entities: system,
        warn: vi.fn(),
    } as any;

    const spawn = registry.get('func_rotating');
    spawn?.(entity, context);

    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.Push);

    // Check avelocity is set (x, y, z depends on logic, but not zero)
    // Default is Z rotation usually
    expect(entity.avelocity).toBeDefined();
    expect(entity.avelocity?.z).toBe(100);
  });
});
