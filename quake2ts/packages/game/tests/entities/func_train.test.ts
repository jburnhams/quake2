import { describe, it, expect, vi } from 'vitest';
import { registerFuncSpawns } from '../../src/entities/funcs.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';

describe('func_train', () => {
  it('should register func_train', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);
    expect(registry.get('func_train')).toBeDefined();
  });

  it('should initialize func_train', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    const entity = {
      classname: 'func_train',
      target: 'p1',
      angles: { x: 0, y: 0, z: 0 },
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -10, y: -10, z: -10 },
      maxs: { x: 10, y: 10, z: 10 },
    } as Entity;

    const p1 = {
      targetname: 'p1',
      origin: { x: 100, y: 0, z: 0 },
      target: 'p2',
    } as Entity;

    const system = {
        pickTarget: vi.fn().mockReturnValue(p1),
        scheduleThink: vi.fn(),
        timeSeconds: 0,
    } as unknown as EntitySystem;

    const context = {
        entities: system,
        warn: vi.fn(),
    } as any;

    const spawn = registry.get('func_train');
    spawn?.(entity, context);

    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.Push);
    expect(entity.blocked).toBeDefined();

    // It should schedule a think to find the target
    expect(system.scheduleThink).toHaveBeenCalled();
  });
});
