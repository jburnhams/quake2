import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType, Solid, EntityFlags } from '../../../../src/entities/entity.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { registerFuncSpawns } from '../../../../src/entities/funcs.js';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';
import { SpawnRegistry } from '../../../../src/entities/spawn.js';

describe('func_plat2', () => {
  let context: ReturnType<typeof createTestContext>;
  let sys: EntitySystem;
  let spawnRegistry: SpawnRegistry;

  beforeEach(async () => {
    context = createTestContext();
    sys = context.entities; // Correctly access entities system
    spawnRegistry = new SpawnRegistry();
    registerFuncSpawns(spawnRegistry);
  });

  it('should spawn with correct defaults', () => {
    const ent = spawnEntity(sys, createEntityFactory({
      classname: 'func_plat2',
      angles: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: 0 },
      maxs: { x: 16, y: 16, z: 16 },
      size: { x: 32, y: 32, z: 16 }
    }));

    const spawnFunc = spawnRegistry.get('func_plat2');
    expect(spawnFunc).toBeDefined();
    if (spawnFunc) {
        spawnFunc(ent, context);
    }

    expect(ent.solid).toBe(Solid.Bsp);
    expect(ent.movetype).toBe(MoveType.Push);

    expect(ent.speed).toBe(20);

    expect(ent.accel).toBe(5);
    expect(ent.decel).toBe(5);
    expect(ent.wait).toBe(3);
    expect(ent.lip).toBe(8);
  });

  it('should create an internal trigger', () => {
    const ent = spawnEntity(sys, createEntityFactory({
      classname: 'func_plat2',
      angles: { x: 0, y: 0, z: 0 },
      mins: { x: 0, y: 0, z: 0 },
      maxs: { x: 32, y: 32, z: 32 },
    }));

    // Spy on spawn to capture trigger
    const spawnSpy = vi.spyOn(sys, 'spawn');

    const spawnFunc = spawnRegistry.get('func_plat2');
    if (spawnFunc) {
        spawnFunc(ent, context);
    }

    // Expect at least one extra spawn (the trigger)
    expect(spawnSpy).toHaveBeenCalled();

    // Check if a trigger was linked
    expect(sys.linkentity).toHaveBeenCalled();
  });

  it('should initialize state correctly', () => {
    const ent = spawnEntity(sys, createEntityFactory({
      classname: 'func_plat2',
      angles: { x: 0, y: 0, z: 0 },
      mins: { x: 0, y: 0, z: 0 },
      maxs: { x: 32, y: 32, z: 32 },
      size: { x: 32, y: 32, z: 32 },
      origin: { x: 0, y: 0, z: 100 }
    }));

    const spawnFunc = spawnRegistry.get('func_plat2');
    if (spawnFunc) {
        spawnFunc(ent, context);
    }

    // Default: starts at BOTTOM
    expect(ent.moveinfo).toBeDefined();
    // 1 = Bottom (PlatState.Down)
    expect(ent.moveinfo?.state).toBe(1);

    // Check origin is at pos2 (bottom)
    // pos1 = 100. pos2 = 100 - (32 - 8) = 76.
    expect(ent.origin.z).toBeCloseTo(76);
  });
});
