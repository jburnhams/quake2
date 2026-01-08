import { describe, it, expect, vi } from 'vitest';
import { registerFuncSpawns } from '../../src/entities/funcs.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { MoveType, Solid } from '../../src/entities/entity.js';
import { createTestContext, createEntityFactory, createTriggerEntityFactory } from '@quake2ts/test-utils';

describe('func_train', () => {
  it('should register func_train', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);
    expect(registry.get('func_train')).toBeDefined();
  });

  it('should initialize func_train', () => {
    const registry = new SpawnRegistry();
    registerFuncSpawns(registry);
    const context = createTestContext();

    const entity = createEntityFactory({
      classname: 'func_train',
      target: 'p1',
      angles: { x: 0, y: 0, z: 0 },
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -10, y: -10, z: -10 },
      maxs: { x: 10, y: 10, z: 10 },
    });

    const p1 = createTriggerEntityFactory('path_corner', {
      targetname: 'p1',
      origin: { x: 100, y: 0, z: 0 },
      target: 'p2',
    });

    // Mock pickTarget to return p1
    (context.entities.pickTarget as any).mockReturnValue(p1);

    const spawn = registry.get('func_train');
    // @ts-ignore
    spawn?.(entity, context);

    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.Push);
    expect(entity.blocked).toBeDefined();

    // It should schedule a think to find the target
    expect(context.entities.scheduleThink).toHaveBeenCalled();
  });
});
