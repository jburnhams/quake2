import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType, Solid, EntityFlags } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { registerFuncSpawns } from '../../../src/entities/funcs.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('func_plat2', () => {
  let context: ReturnType<typeof createTestContext>;
  let sys: EntitySystem;
  let spawnRegistry: SpawnRegistry;
  let spawn: (classname: string) => Entity;

  beforeEach(async () => {
    context = createTestContext();
    sys = context.entities; // Correctly access entities system
    spawnRegistry = new SpawnRegistry();
    registerFuncSpawns(spawnRegistry);

    // We don't strictly need to set it on sys for unit testing the spawn function directly,
    // but it helps if internal logic uses sys.getSpawnFunction or similar.
    // sys.setSpawnRegistry(spawnRegistry); // Mocked function

    spawn = (classname) => {
      const ent = sys.spawn();
      ent.classname = classname;
      return ent;
    };
  });

  it('should spawn with correct defaults', () => {
    const ent = spawn('func_plat2');
    ent.angles = { x: 0, y: 0, z: 0 };
    ent.mins = { x: -16, y: -16, z: 0 };
    ent.maxs = { x: 16, y: 16, z: 16 };
    // size is calc'd by applyEntityKeyValues usually, but we set manually for test
    ent.size = { x: 32, y: 32, z: 16 };

    const spawnFunc = spawnRegistry.get('func_plat2');
    expect(spawnFunc).toBeDefined();
    if (spawnFunc) {
        spawnFunc(ent, context);
    }

    expect(ent.solid).toBe(Solid.Bsp);
    expect(ent.movetype).toBe(MoveType.Push);

    // func_plat2 specific defaults from C code
    // if (!ent->speed) ent->speed = 20; else ent->speed *= 0.1;
    // speed 20 -> 20. But logic says: if !speed, speed=20.
    // wait, existing func_plat defaults to 200. func_plat2 C code says 20.
    // And scaling: "speed overrides default 200". "speed" default 150 (comment) vs 20 (code).
    expect(ent.speed).toBe(20);

    expect(ent.accel).toBe(5);
    expect(ent.decel).toBe(5);
    expect(ent.wait).toBe(3);
    expect(ent.lip).toBe(8);
  });

  it('should create an internal trigger', () => {
    const ent = spawn('func_plat2');
    ent.angles = { x: 0, y: 0, z: 0 };
    ent.mins = { x: 0, y: 0, z: 0 };
    ent.maxs = { x: 32, y: 32, z: 32 };

    // Spy on spawn to capture trigger
    const spawnSpy = vi.spyOn(sys, 'spawn');

    const spawnFunc = spawnRegistry.get('func_plat2');
    if (spawnFunc) {
        spawnFunc(ent, context);
    }

    // Expect at least one extra spawn (the trigger)
    // Actually possibly 2 if bad_area logic runs? No, bad_area is spawned on move.
    // But plat_spawn_inside_trigger calls spawn.
    expect(spawnSpy).toHaveBeenCalled();

    // Check if a trigger was linked
    expect(sys.linkentity).toHaveBeenCalled();
  });

  it('should initialize state correctly', () => {
    const ent = spawn('func_plat2');
    ent.angles = { x: 0, y: 0, z: 0 };
    ent.mins = { x: 0, y: 0, z: 0 };
    ent.maxs = { x: 32, y: 32, z: 32 };
    ent.size = { x: 32, y: 32, z: 32 };
    ent.origin = { x: 0, y: 0, z: 100 };

    const spawnFunc = spawnRegistry.get('func_plat2');
    if (spawnFunc) {
        spawnFunc(ent, context);
    }

    // Default: starts at TOP (pos1), moves to BOTTOM (pos2)
    // Unless PLAT2_TOP flag is set, then default position is TOP?
    // C code: if(!(ent->spawnflags & PLAT2_TOP)) { VectorCopy(pos2, origin); state = STATE_BOTTOM; }
    // So by default (no flags), it starts at BOTTOM.

    expect(ent.moveinfo).toBeDefined();
    // 1 = Bottom (PlatState.Down)
    expect(ent.moveinfo?.state).toBe(1);

    // Check origin is at pos2 (bottom)
    // pos1 = 100. pos2 = 100 - (32 - 8) = 76.
    expect(ent.origin.z).toBeCloseTo(76);
  });
});
