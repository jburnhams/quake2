import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFuncSpawns } from '../../../src/entities/funcs.js';
import { Entity, Solid, MoveType, ServerFlags } from '../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

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
    // Mins/Maxs
    entity.mins = { x: -10, y: -10, z: 0 };
    entity.maxs = { x: 10, y: 10, z: 10 };
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

    // If time=0, sin(0)=0.
    context.entities.beginFrame(0);
    if (entity.think) entity.think(entity, context.entities);
    expect(entity.angles.z).toBeCloseTo(0, 0);

    // If time=PI/2, sin(PI/2)=1.
    context.entities.beginFrame(Math.PI / 2);
    if (entity.think) entity.think(entity, context.entities);
    expect(entity.angles.z).toBeCloseTo(90, 0);

    // If time=PI*1.5, sin(PI*1.5)=-1.
    context.entities.beginFrame(Math.PI * 1.5);
    if (entity.think) entity.think(entity, context.entities);
    expect(entity.angles.z).toBeCloseTo(-90, 0);
  });
});
