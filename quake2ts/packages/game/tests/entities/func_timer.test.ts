import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFuncSpawns } from '../../src/entities/funcs.js';
import { Entity, ServerFlags } from '../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { SpawnRegistry } from '../../src/entities/spawn.js';

describe('func_timer', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerFuncSpawns(registry);

    entity = new Entity(1);
    entity.classname = 'func_timer';

    // Mock crandom
    context.entities.rng.crandom = vi.fn(() => 0.5);
  });

  it('should initialize with defaults', () => {
    const spawnFn = registry.get('func_timer');
    expect(spawnFn).toBeDefined();
    spawnFn?.(entity, context);

    expect(entity.wait).toBe(1.0);
    expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
    expect(entity.use).toBeDefined();
  });

  it('should start automatically if START_ON is set', () => {
    // START_ON = 1
    entity.spawnflags = 1;
    entity.wait = 2;
    entity.random = 1;
    // mock pausetime
    (entity as any).pausetime = 1;

    const spawnFn = registry.get('func_timer');
    spawnFn?.(entity, context);

    expect(entity.think).toBeDefined();
    expect(context.entities.scheduleThink).toHaveBeenCalled();
    expect(entity.activator).toBe(entity);

    // Calc check: 1.0 (start base) + pausetime(1) + delay(0) + wait(2) + variance(0.5 * 1) = 4.5
    // Note: In C: level.time + 1_sec + ...
    // context.timeSeconds is mocked to 10 in helper.
    // But we use context.timeSeconds inside spawn?
    // In spawn: context.entities.timeSeconds + nextTime
    // nextTime = 1.0 + ...
    // So schedule time should be 10 + 4.5 = 14.5

    // Wait, let's verify exact logic in code:
    // const nextTime = 1.0 + pausetime + delay + entity.wait + variance;
    // context.entities.scheduleThink(entity, context.entities.timeSeconds + nextTime);

    // 1.0 + 1 + 0 + 2 + 0.5 = 4.5
    // 10 + 4.5 = 14.5

    expect(context.entities.scheduleThink).toHaveBeenCalledWith(entity, 14.5);
  });

  it('should toggle on and off when used', () => {
    const spawnFn = registry.get('func_timer');
    spawnFn?.(entity, context);

    // Initially off
    expect(entity.nextthink).toBe(0);

    // Turn on
    const activator = new Entity(2);
    entity.use?.(entity, null, activator);

    // Should fire immediately if no delay
    expect(context.entities.useTargets).toHaveBeenCalledWith(entity, activator);
    // Should reschedule
    expect(context.entities.scheduleThink).toHaveBeenCalled();

    // Mark as active
    entity.nextthink = 100; // Future

    // Turn off
    entity.use?.(entity, null, activator);
    expect(entity.nextthink).toBe(0);
    expect(entity.think).toBeUndefined();
  });

  it('should respect delay when turning on', () => {
    entity.delay = 5;
    const spawnFn = registry.get('func_timer');
    spawnFn?.(entity, context);

    const activator = new Entity(2);
    entity.use?.(entity, null, activator);

    // Should not fire targets yet
    expect(context.entities.useTargets).not.toHaveBeenCalled();

    // Should schedule think in delay seconds
    expect(context.entities.scheduleThink).toHaveBeenCalledWith(entity, context.entities.timeSeconds + 5);

    // Simulate think
    if (entity.think) {
        entity.think(entity, context.entities);
        // Now it should fire
        expect(context.entities.useTargets).toHaveBeenCalledWith(entity, activator);
        // And reschedule
        expect(context.entities.scheduleThink).toHaveBeenCalledTimes(2);
    }
  });
});
