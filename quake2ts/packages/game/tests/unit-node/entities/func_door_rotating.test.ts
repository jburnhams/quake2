import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFuncSpawns, DoorState } from '../../src/entities/funcs.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';
import { SpawnRegistry } from '../../src/entities/spawn.js';

describe('func_door_rotating', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    entity = new Entity(1);
    // Default func_door_rotating properties
    entity.classname = 'func_door_rotating';
    entity.angles = { x: 0, y: 0, z: 0 };
    entity.mins = { x: -10, y: -10, z: -10 };
    entity.maxs = { x: 10, y: 10, z: 10 };
    // We need to mock distance if it comes from map keys (it's not on entity usually)
    // But in our spawn function, we read it from entity property (which is mapped from keyvalues)
    (entity as any).distance = 90;
  });

  it('should initialize with default Z-axis rotation', () => {
    const spawnFn = registry.get('func_door_rotating');
    expect(spawnFn).toBeDefined();
    spawnFn?.(entity, context);

    expect(entity.speed).toBe(100);
    expect(entity.wait).toBe(3);
    expect(entity.dmg).toBe(2);
    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.Push);

    // Default movedir should be Z axis (0, 0, 1) to rotate around Z (Yaw)
    // Actually code sets movedir index 1 (Y) for Z_AXIS default... wait.
    // In SP_func_door_rotating:
    // else // Z_AXIS
    //    ent->movedir[1] = 1.0;

    // My implementation:
    // } else {
    //    // Z_AXIS (Default)
    //    entity.movedir = { x: 0, y: 1.0, z: 0 }; // Index 1 -> Y
    // }

    // This matches C code.
    // Why? Quake angles are [Pitch, Yaw, Roll].
    // Index 1 is Yaw (rotation around Z).
    // So setting movedir[1] = 1 means we modify Yaw.

    expect(entity.movedir).toEqual({ x: 0, y: 1, z: 0 });

    // pos1 = angles (0,0,0)
    expect(entity.pos1).toEqual({ x: 0, y: 0, z: 0 });

    // pos2 = angles + movedir * distance
    // 0 + 1 * 90 = 90
    expect(entity.pos2).toEqual({ x: 0, y: 90, z: 0 });
  });

  it('should handle X_AXIS spawnflag', () => {
    // SPAWNFLAG_DOOR_ROTATING_X_AXIS = 64
    entity.spawnflags = 64;
    const spawnFn = registry.get('func_door_rotating');
    spawnFn?.(entity, context);

    // X_AXIS sets movedir[2] = 1 (Roll / X-axis rotation)
    // entity.movedir = { x: 0, y: 0, z: 1.0 };
    expect(entity.movedir).toEqual({ x: 0, y: 0, z: 1 });

    expect(entity.pos2).toEqual({ x: 0, y: 0, z: 90 });
  });

  it('should handle Y_AXIS spawnflag', () => {
    // SPAWNFLAG_DOOR_ROTATING_Y_AXIS = 128
    entity.spawnflags = 128;
    const spawnFn = registry.get('func_door_rotating');
    spawnFn?.(entity, context);

    // Y_AXIS sets movedir[0] = 1 (Pitch / Y-axis rotation)
    expect(entity.movedir).toEqual({ x: 1, y: 0, z: 0 });

    expect(entity.pos2).toEqual({ x: 90, y: 0, z: 0 });
  });

  it('should handle REVERSE spawnflag', () => {
    // SPAWNFLAG_DOOR_REVERSE = 2
    entity.spawnflags = 2;
    const spawnFn = registry.get('func_door_rotating');
    spawnFn?.(entity, context);

    // Default Z axis (movedir Y=1), reversed -> Y=-1
    // We expect values to be close to -1/0/etc to avoid signed zero issues
    expect(entity.movedir.x).toBeCloseTo(0);
    expect(entity.movedir.y).toBeCloseTo(-1);
    expect(entity.movedir.z).toBeCloseTo(0);

    expect(entity.pos2.x).toBeCloseTo(0);
    expect(entity.pos2.y).toBeCloseTo(-90);
    expect(entity.pos2.z).toBeCloseTo(0);
  });

  it('should rotate when used', () => {
    const spawnFn = registry.get('func_door_rotating');
    spawnFn?.(entity, context);

    // Initially closed (pos1)
    expect(entity.angles).toEqual({ x: 0, y: 0, z: 0 });
    expect(entity.state).toBe(DoorState.Closed);

    // Use it
    const other = new Entity(2);
    entity.use?.(entity, other, other);

    // Should be opening
    expect(entity.state).toBe(DoorState.Opening);
    expect(entity.think).toBeDefined();

    // Mock time passing to finish open
    // We can't easily simulate physics/think loop here without full system
    // But we can check if it scheduled a think
    expect(context.entities.scheduleThink).toHaveBeenCalled();
  });

  it('should handle TOGGLE spawnflag', () => {
    // SPAWNFLAG_DOOR_TOGGLE = 32
    entity.spawnflags = 32;
    const spawnFn = registry.get('func_door_rotating');
    spawnFn?.(entity, context);

    entity.use?.(entity, null, null);
    expect(entity.state).toBe(DoorState.Opening);

    // Force open state
    entity.state = DoorState.Open;
    entity.angles = entity.pos2;

    entity.use?.(entity, null, null);
    expect(entity.state).toBe(DoorState.Closing);
  });
});
