import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFuncSpawns } from '../../../src/entities/funcs.js';
import { Entity, Solid, MoveType, ServerFlags } from '../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('func_plat2', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    entity = new Entity(1);
    entity.classname = 'func_plat2';
    // Mins/maxs required for size calcs
    entity.mins = { x: -10, y: -10, z: 0 };
    entity.maxs = { x: 10, y: 10, z: 10 };
    entity.angles = { x: 0, y: 0, z: 0 };
  });

  it('should initialize like func_plat', () => {
    const spawnFn = registry.get('func_plat2');
    spawnFn?.(entity, context);

    // Check defaults inherited from func_plat
    expect(entity.speed).toBe(200);
    expect(entity.accel).toBe(500);
    expect(entity.decel).toBe(500);
    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.Push);
  });
});

describe('func_pendulum', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    entity = new Entity(1);
    entity.classname = 'func_pendulum';
    entity.angles = { x: 0, y: 0, z: 0 };
  });

  it('should initialize correctly', () => {
    const spawnFn = registry.get('func_pendulum');
    spawnFn?.(entity, context);

    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.Push);
    expect(entity.speed).toBe(30); // Default speed
    expect(entity.think).toBeDefined();
  });

  it('should swing based on time', () => {
    const spawnFn = registry.get('func_pendulum');
    // Set explicit speed and distance
    entity.speed = 1; // 1 rad/s approx? No, in our simplified model it is multiplier.
    entity.dmg = 90; // Using dmg as distance default

    spawnFn?.(entity, context);

    // Initial angle
    expect(entity.angles.z).toBe(0);

    // Advance time
    // Current time is 10.
    // next think is 10.1.
    // We mock think execution manually or use runFrame?
    // Let's just call the think function.

    context.entities.beginFrame(10 + Math.PI / 2); // 90 degrees phase shift if speed=1

    // Call think
    if (entity.think) {
        entity.think(entity);
    }

    // sin(PI/2) = 1. distance = 90. angle.z should be 90.
    // Wait, our logic: Math.sin(time * speed) * dist
    // time = 10 + PI/2 ~= 11.57.
    // sin(11.57) is roughly sin(3.68 * PI) which is negative.

    // Let's control time precisely.
    // If time=0, sin(0)=0.
    // If time=PI/2, sin(PI/2)=1.

    context.entities.beginFrame(Math.PI / 2);
    if (entity.think) entity.think(entity);

    expect(entity.angles.z).toBeCloseTo(90, 0);

    context.entities.beginFrame(Math.PI * 1.5);
    if (entity.think) entity.think(entity);

    expect(entity.angles.z).toBeCloseTo(-90, 0);
  });
});
