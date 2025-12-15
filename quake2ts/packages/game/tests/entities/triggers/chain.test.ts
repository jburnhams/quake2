import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity, Solid, MoveType, ServerFlags } from '../../../src/entities/entity.js';
import { createTestContext } from '../../../tests/test-helpers.js';
import { registerFuncSpawns } from '../../../src/entities/funcs.js';
import { registerTriggerSpawns } from '../../../src/entities/triggers/index.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('Entity Chains', () => {
  let context: ReturnType<typeof createTestContext>;
  let sys: EntitySystem;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    sys = context.entities;
    registry = new SpawnRegistry();

    // Register needed spawns
    registerFuncSpawns(registry);
    registerTriggerSpawns(registry);

    // Mock sys.getSpawnFunction to use our local registry
    sys.getSpawnFunction = (classname: string) => registry.get(classname);

    // Mock sys.spawn to return a basic entity
    sys.spawn = () => {
        const ent = new Entity(1);
        // Bind context if needed, but for these tests we might need to verify properties
        return ent;
    };

    // Mock sys.useTargets to simulate target activation
    const entitiesByName = new Map<string, Entity[]>();

    sys.linkentity = (ent: Entity) => {
        if (ent.targetname) {
            if (!entitiesByName.has(ent.targetname)) {
                entitiesByName.set(ent.targetname, []);
            }
            entitiesByName.get(ent.targetname)!.push(ent);
        }
    };

    sys.useTargets = (ent: Entity, activator: Entity | null) => {
        if (ent.target) {
            const targets = entitiesByName.get(ent.target);
            if (targets) {
                for (const target of targets) {
                    if (target.use) {
                        target.use(target, ent, activator);
                    }
                }
            }
        }
    };
  });

  it('chains trigger_relay to targets', () => {
    const trigger = sys.spawn();
    trigger.classname = 'trigger_relay';
    trigger.targetname = 't1';
    trigger.target = 't2';

    const spawnRelay = registry.get('trigger_relay');
    if (spawnRelay) {
        spawnRelay(trigger, {
            entities: sys,
            keyValues: { classname: 'trigger_relay', targetname: 't1', target: 't2' },
            warn: () => {},
            free: () => {},
            health_multiplier: 1
        });
    }
    sys.linkentity(trigger);

    const target1 = sys.spawn();
    target1.classname = 'func_button';
    target1.targetname = 't2';
    target1.use = vi.fn();
    sys.linkentity(target1);

    const target2 = sys.spawn();
    target2.classname = 'func_button';
    target2.targetname = 't2';
    target2.use = vi.fn();
    sys.linkentity(target2);

    // Act
    // trigger_relay.use calls useTargets.
    if (trigger.use) {
        trigger.use(trigger, null, null);
    }

    // Assert
    expect(target1.use).toHaveBeenCalled();
    expect(target2.use).toHaveBeenCalled();
  });

  it('handles func_timer delays and chaining', () => {
    vi.useFakeTimers();

    const timer = sys.spawn();
    timer.classname = 'func_timer';
    timer.targetname = 'timer1';
    timer.target = 'target1';
    timer.wait = 1.0;

    const spawnTimer = registry.get('func_timer');
    spawnTimer?.(timer, {
        entities: sys,
        keyValues: { classname: 'func_timer', targetname: 'timer1', target: 'target1', wait: '1.0' },
        warn: () => {},
        free: () => {},
        health_multiplier: 1
    });
    sys.linkentity(timer);

    const target = sys.spawn();
    target.targetname = 'target1';
    target.use = vi.fn();
    sys.linkentity(target);

    // Activate timer
    if (timer.use) {
        timer.use(timer, null, null);
    }

    // Should schedule think
    expect(sys.scheduleThink).toHaveBeenCalled();

    const calls = (sys.scheduleThink as any).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1];
    const scheduledEnt = lastCall[0];
    const scheduledTime = lastCall[1];

    expect(scheduledEnt).toBe(timer);
    expect(scheduledTime).toBeCloseTo(sys.timeSeconds + 1.0);

    // Execute the think function to verify looping
    if (timer.think) {
        timer.think(timer, sys);
    }

    expect(target.use).toHaveBeenCalled();

    // Check re-schedule (loop)
    // After think, it should schedule again
    expect((sys.scheduleThink as any).mock.calls.length).toBeGreaterThan(1);

    vi.useRealTimers();
  });

  it('handles delayed trigger_relay', () => {
    const relay = sys.spawn();
    relay.classname = 'trigger_relay';
    relay.target = 'delayed_target';
    relay.delay = 0.5;

    const spawnRelay = registry.get('trigger_relay');
    spawnRelay?.(relay, {
        entities: sys,
        keyValues: { classname: 'trigger_relay', target: 'delayed_target', delay: '0.5' },
        warn: () => {},
        free: () => {},
        health_multiplier: 1
    });
    sys.linkentity(relay);

    const target = sys.spawn();
    target.targetname = 'delayed_target';
    target.use = vi.fn();
    sys.linkentity(target);

    // Use relay
    relay.use?.(relay, null, null);

    // Should NOT have called target yet
    expect(target.use).not.toHaveBeenCalled();

    // Should have scheduled think
    expect(sys.scheduleThink).toHaveBeenCalled();
    const calls = (sys.scheduleThink as any).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBe(relay);
    // time + delay
    expect(lastCall[1]).toBeCloseTo(sys.timeSeconds + 0.5);

    // Execute think
    if (relay.think) {
        relay.think(relay, sys);
    }

    expect(target.use).toHaveBeenCalled();
  });
});
