
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext } from '@quake2ts/test-utils';
import { registerTriggerSpawns } from '../../../src/entities/triggers/index.js';
import { registerTargetSpawns } from '../../../src/entities/targets';
import { Entity } from '../../../src/entities/entity';
import { Solid } from '../../../src/entities/entity';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { createEntityFactory } from '@quake2ts/test-utils';

describe('Triggers', () => {
  let context: ReturnType<typeof createTestContext>;
  let entities: any;
  let registry: SpawnRegistry;
  let spawnedEntities: Entity[];

  beforeEach(() => {
    context = createTestContext();
    entities = context.entities;
    registry = new SpawnRegistry();
    spawnedEntities = [];

    // Mock spawn to track entities
    const originalSpawn = entities.spawn;
    entities.spawn = () => {
        const e = createEntityFactory({ number: 1 });
        spawnedEntities.push(e);
        return e;
    };

    // Mock findByTargetName
    entities.findByTargetName = (name: string) => {
        return spawnedEntities.filter(e => e.targetname === name);
    };

    // Mock useTargets to simulate delay and activation
    entities.useTargets = vi.fn((entity: Entity, activator: Entity | null) => {
        if (entity.delay > 0) {
            entity.nextthink = entities.timeSeconds + entity.delay;
            entity.think = () => {
                if (entity.target) {
                    const targets = entities.findByTargetName(entity.target);
                    targets.forEach((t: Entity) => t.use?.(t, entity, activator));
                }
            };
            return;
        }
        if (entity.target) {
            const targets = entities.findByTargetName(entity.target);
            targets.forEach((t: Entity) => t.use?.(t, entity, activator));
        }
    });

    registerTriggerSpawns(registry);
    registerTargetSpawns(registry);
  });

  describe('trigger_counter', () => {
    it('should fire targets after counting down', () => {
      const trigger = entities.spawn();
      trigger.classname = 'trigger_counter';
      trigger.count = 2;
      trigger.target = 'my_target';

      const target = entities.spawn();
      target.classname = 'target_relay';
      target.targetname = 'my_target';
      target.use = vi.fn();

      const registryGet = registry.get('trigger_counter');
      expect(registryGet).toBeDefined();
      registryGet!(trigger, { ...context, keyValues: { count: '2' } });

      const activator = entities.spawn();
      activator.client = {};

      // First use
      trigger.use!(trigger, activator, activator);
      expect(trigger.count).toBe(1);
      expect(target.use).not.toHaveBeenCalled();

      // Second use
      trigger.use!(trigger, activator, activator);
      expect(trigger.count).toBe(0);

      // trigger_counter uses multiTrigger which uses a think delay (FRAME_TIME or wait)
      // So useTargets is called in the think function, not immediately if wait/think is involved.
      // But multiTrigger logic:
      // if wait > 0, think = multiWait
      // else think = free
      // AND it calls useTargets BEFORE that.
      // So useTargets IS called immediately in multiTrigger.

      expect(target.use).toHaveBeenCalled();
    });

    it('should display messages by default', () => {
        const trigger = entities.spawn();
        trigger.classname = 'trigger_counter';
        trigger.count = 2;

        const registryGet = registry.get('trigger_counter');
        registryGet!(trigger, { ...context, keyValues: { count: '2' } });

        const activator = entities.spawn();
        activator.client = {};

        const centerprintf = vi.fn();
        entities.engine.centerprintf = centerprintf;
        entities.sound = vi.fn();

        // First use
        trigger.use!(trigger, activator, activator);
        expect(centerprintf).toHaveBeenCalledWith(activator, '1 more to go...');
        expect(entities.sound).toHaveBeenCalledWith(activator, expect.anything(), 'misc/talk1.wav', expect.anything(), expect.anything(), expect.anything());

        centerprintf.mockClear();
        entities.sound.mockClear();

        // Second use
        trigger.use!(trigger, activator, activator);
        expect(centerprintf).toHaveBeenCalledWith(activator, 'Sequence completed!');
        expect(entities.sound).toHaveBeenCalledWith(activator, expect.anything(), 'misc/talk1.wav', expect.anything(), expect.anything(), expect.anything());
      });

      it('should suppress messages with spawnflag 1', () => {
        const trigger = entities.spawn();
        trigger.classname = 'trigger_counter';
        trigger.count = 2;
        trigger.spawnflags = 1; // NOMESSAGE

        const registryGet = registry.get('trigger_counter');
        registryGet!(trigger, { ...context, keyValues: { count: '2', spawnflags: '1' } });

        const activator = entities.spawn();
        activator.client = {};

        const centerprintf = vi.fn();
        entities.engine.centerprintf = centerprintf;
        entities.sound = vi.fn();

        // First use
        trigger.use!(trigger, activator, activator);
        expect(centerprintf).not.toHaveBeenCalled();
        expect(entities.sound).not.toHaveBeenCalled();

        // Second use
        trigger.use!(trigger, activator, activator);
        expect(centerprintf).not.toHaveBeenCalled();
        expect(entities.sound).not.toHaveBeenCalled();
      });
  });

  describe('trigger_always', () => {
    it('should fire immediately if delay is small', () => {
      const trigger = entities.spawn();
      trigger.classname = 'trigger_always';
      trigger.target = 'always_target';
      trigger.delay = 0; // Should default to 0.2

      const target = entities.spawn();
      target.targetname = 'always_target';
      target.use = vi.fn();

      const registryGet = registry.get('trigger_always');
      registryGet!(trigger, { ...context, keyValues: {} });

      // trigger_always calls useTargets in spawn.
      // useTargets (mocked) should see default delay 0.2 and schedule think on TRIGGER.

      expect(trigger.delay).toBe(0.2);

      expect(trigger.nextthink).toBeGreaterThan(0);
      expect(target.use).not.toHaveBeenCalled();

      // Advance time and run think
      // Simulate think execution
      if (trigger.think) {
          trigger.think(trigger);
      }
      expect(target.use).toHaveBeenCalled();
    });
  });

  describe('trigger_relay', () => {
    it('should pass through to targets', () => {
      const trigger = entities.spawn();
      trigger.classname = 'trigger_relay';
      trigger.target = 'relay_target';
      trigger.spawnflags = 1; // NoSound

      const target = entities.spawn();
      target.targetname = 'relay_target';
      target.use = vi.fn();

      const registryGet = registry.get('trigger_relay');
      registryGet!(trigger, { ...context, keyValues: { spawnflags: '1' } });

      const activator = entities.spawn();
      trigger.use!(trigger, activator, activator);

      expect(target.use).toHaveBeenCalled();
    });
  });
});
