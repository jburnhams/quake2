import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFuncSpawns, DoorState } from '../../src/entities/funcs.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { createTestContext } from '../test-helpers.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';

describe('func_door', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    entity = new Entity(1);
    // Default func_door properties
    entity.classname = 'func_door';
    entity.angles = { x: 0, y: 0, z: 0 };
    entity.mins = { x: 0, y: 0, z: 0 };
    entity.maxs = { x: 100, y: 100, z: 100 };

    // Ensure scheduleThink mock is clean
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const spawnFn = registry.get('func_door');
    expect(spawnFn).toBeDefined();
    spawnFn?.(entity, context);

    expect(entity.speed).toBe(100);
    expect(entity.wait).toBe(3);
    expect(entity.lip).toBe(8);
    expect(entity.dmg).toBe(2);
    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.Push);
  });

  it('should calculate pos1 and pos2 correctly', () => {
    entity.angles = { x: 0, y: 0, z: 0 };
    const spawnFn = registry.get('func_door');
    spawnFn?.(entity, context);

    // Verify pos1 is start origin
    expect(entity.pos1).toEqual(entity.origin);

    // Verify pos2 is calculated based on movedir and size
    expect(entity.pos2).toBeDefined();
  });

  it('should open on touch if no health or targetname', () => {
    const spawnFn = registry.get('func_door');
    spawnFn?.(entity, context);

    // Mock other entity
    const other = new Entity(2);
    other.classname = 'player';

    // Check if touch is defined
    expect(entity.touch).toBeDefined();

    // Trigger touch
    entity.touch?.(entity, other);

    // Should be opening
    expect(entity.state).toBe(DoorState.Opening);
  });

  it('should be shootable if health > 0', () => {
    entity.health = 100;
    const spawnFn = registry.get('func_door');
    spawnFn?.(entity, context);

    expect(entity.takedamage).toBe(true);
    expect(entity.max_health).toBe(100);

    // Die callback should trigger use
    const other = new Entity(2);
    entity.die?.(entity, null, other, 100);

    // Should be opening and health reset
    expect(entity.state).toBe(DoorState.Opening);
    expect(entity.health).toBe(100);
    expect(entity.takedamage).toBe(false);
  });

  it('should support sounds property', () => {
      // Set sounds to 0 (default/loud)
      entity.sounds = 0;
      const spawnFn = registry.get('func_door');
      spawnFn?.(entity, context);

      // Trigger use
      const other = new Entity(2);
      entity.use?.(entity, other, other);

      // Check sound call
      expect(context.entities.sound).toHaveBeenCalledWith(
          entity,
          0,
          'doors/dr1_strt.wav',
          1,
          1,
          0
      );
  });

  it('should handle spawnflags', () => {
      // SPAWNFLAGS_START_OPEN = 1
      entity.spawnflags = 1;
      const spawnFn = registry.get('func_door');
      spawnFn?.(entity, context);

      // Should start in pos2 and state Open
      expect(entity.origin).toEqual(entity.pos2);
      expect(entity.state).toBe(DoorState.Open);
  });

  it('should toggle if TOGGLE spawnflag is set', () => {
      // SPAWNFLAGS_TOGGLE = 32
      entity.spawnflags = 32;
      const spawnFn = registry.get('func_door');
      spawnFn?.(entity, context);

      // Initially Closed
      expect(entity.state).toBe(DoorState.Closed);

      // Use to open
      const other = new Entity(2);
      entity.use?.(entity, other, other);
      expect(entity.state).toBe(DoorState.Opening);

      // Fast forward to Open state manually or mock think
      entity.state = DoorState.Open;
      entity.origin = entity.pos2;

      // Use again to close (toggle behavior)
      entity.use?.(entity, other, other);
      expect(entity.state).toBe(DoorState.Closing);
  });

  it('should inflict damage and reverse when blocked', () => {
    const spawnFn = registry.get('func_door');
    spawnFn?.(entity, context);

    // Setup blocking entity
    const victim = new Entity(2);
    victim.takedamage = true;
    victim.health = 100;

    // Simulate Opening state
    entity.state = DoorState.Opening;

    // Trigger blocked
    entity.blocked?.(entity, victim);

    // Check damage
    expect(victim.health).toBe(98); // Default dmg is 2

    // Check reverse (Opening -> Closing)
    expect(entity.state).toBe(DoorState.Closing);
    // Since door_go_down schedules a think, we should verify that.
    expect(context.entities.scheduleThink).toHaveBeenCalled();
  });

  it('should wait then close after opening', () => {
    const spawnFn = registry.get('func_door');
    spawnFn?.(entity, context);

    // Use the door
    const activator = new Entity(2);
    entity.use?.(entity, activator, activator);

    expect(entity.state).toBe(DoorState.Opening);

    // Simulate physics loop until door reaches top
    let iterations = 0;
    while(entity.state === DoorState.Opening && iterations < 100) {
        if(entity.think) {
            entity.think(entity, context.entities);
        }
        iterations++;
    }

    expect(entity.state).toBe(DoorState.Open);

    // Verify that a think is scheduled for 'wait' time (default 3s).
    // context.entities.timeSeconds is 10 in the helper.
    // So expected nextthink is 10 + 3 = 13.
    // However, the think function might be wrapped, so we check the scheduleThink call.

    // The last call to scheduleThink should be the wait timer.
    const lastCall = (context.entities.scheduleThink as any).mock.lastCall;
    expect(lastCall).toBeDefined();
    const scheduledTime = lastCall[1];

    // It should be roughly current time (10) + movement time + wait (3).
    // The movement time depends on distance/speed.
    // We consumed the movement time in the loop.
    // So now it should be effectively "time when loop finished" + 3.
    // Since we didn't increment context.entities.timeSeconds in the loop, the "current time" for the engine is still 10.
    // So it should be 10 + 3 = 13.
    expect(scheduledTime).toBeCloseTo(13.0, 1);

    // Executing that scheduled think should start closing the door
    const waitThink = entity.think;
    expect(waitThink).toBeDefined();

    waitThink?.(entity, context.entities);

    expect(entity.state).toBe(DoorState.Closing);
  });
});
