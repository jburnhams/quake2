import { describe, it, expect, beforeEach } from 'vitest';
import { registerFuncSpawns, DoorState } from '../../src/entities/funcs.js';
import { Entity } from '../../src/entities/entity.js';
import { createTestContext } from '../test-helpers.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { lengthVec3 } from '@quake2ts/shared';

describe('func_door acceleration', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    entity = new Entity(1);
    entity.classname = 'func_door';
    entity.angles = { x: 0, y: 0, z: 0 };
    // Move 100 units up
    entity.mins = { x: 0, y: 0, z: 0 };
    entity.maxs = { x: 10, y: 10, z: 10 };
    entity.movedir = { x: 0, y: 0, z: 1 };

    // Set accel/decel
    entity.speed = 100;
    entity.accel = 100; // 100 units/s^2
    entity.decel = 100;

    // Setup simple movement: pos1=0, pos2=100
    // lip defaults to 8, size is 10. move = 10 - 8 = 2.
    // That's too small for good testing.
    // Let's set lip to -90 so move is 100?
    // move = movedir * (abs(maxs-mins) - lip)
    // size = 10. if we want move=100: 10 - lip = 100 => lip = -90.
    entity.lip = -90;
  });

  it('should accelerate', () => {
    const spawnFn = registry.get('func_door');
    spawnFn?.(entity, context);

    // Check initial setup
    const dist = lengthVec3(entity.pos2); // pos1 is 0,0,0
    expect(dist).toBeCloseTo(100);

    // Trigger open
    const other = new Entity(2);
    entity.use?.(entity, other, other);

    expect(entity.state).toBe(DoorState.Opening);

    // Initial velocity set by use() -> move_calc() (Frame 1)
    // currentSpeed was 0. accel=100. dt=0.1. newSpeed = 10.
    const speed1 = lengthVec3(entity.velocity);
    expect(speed1).toBeCloseTo(10);

    // Initially think scheduled for 0.1s
    expect(context.entities.scheduleThink).toHaveBeenCalled();

    // Simulate next think (Frame 2)
    const thinkFn = entity.think;
    expect(thinkFn).toBeDefined();

    // Run think
    thinkFn?.(entity, context.entities);

    // 2nd frame: currentSpeed was 10. accel=100. dt=0.1. newSpeed = 20.
    const speed2 = lengthVec3(entity.velocity);
    expect(speed2).toBeCloseTo(20);

    // Run think again (Frame 3)
    thinkFn?.(entity, context.entities);

    // 3rd frame: currentSpeed was 20. accel=100. dt=0.1. newSpeed = 30.
    const speed3 = lengthVec3(entity.velocity);
    expect(speed3).toBeCloseTo(30);
  });
});
