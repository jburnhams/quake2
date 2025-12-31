import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, Solid } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { registerTriggerSpawns } from '../../src/entities/triggers/index.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';

describe('Trigger Conditions', () => {
  let entities: EntitySystem;
  let registry: SpawnRegistry;
  let warnSpy: any;
  let findByTargetNameSpy: any;

  beforeEach(() => {
    const context = createTestContext();
    entities = context.entities;
    // Mock the entities property to return our mocked system
    (entities as any).entities = entities;

    warnSpy = vi.fn();
    registry = new SpawnRegistry();
    registerTriggerSpawns(registry);

    findByTargetNameSpy = vi.fn().mockReturnValue([]);
    entities.findByTargetName = findByTargetNameSpy;

    // Enhance useTargets mock to actually call use on found targets
    entities.useTargets = vi.fn((entity: Entity, activator: Entity | null) => {
      if (entity.target) {
        const targets = entities.findByTargetName(entity.target);
        targets.forEach(t => t.use?.(t, entity, activator));
      }
    });
  });

  describe('trigger_counter', () => {
    it('should fire targets only after count reaches zero', () => {
      // Setup the counter
      const counter = entities.spawn();
      counter.classname = 'trigger_counter';
      counter.count = 2; // Needs 2 activations
      counter.target = 'my_target';
      counter.wait = -1; // Default

      const spawnFunc = registry.get('trigger_counter');
      expect(spawnFunc).toBeDefined();
      spawnFunc!(counter, {
        entities,
        keyValues: {},
        warn: warnSpy,
        free: vi.fn()
      });

      // Setup the target
      const target = entities.spawn();
      target.classname = 'info_notnull';
      target.targetname = 'my_target';
      target.use = vi.fn();

      // Setup mock lookup
      findByTargetNameSpy.mockImplementation((name: string) => {
        if (name === 'my_target') return [target];
        return [];
      });

      // Mock activator
      const activator = entities.spawn();
      activator.classname = 'player';

      // First activation
      counter.use!(counter, activator, activator);
      expect(counter.count).toBe(1);
      expect(target.use).not.toHaveBeenCalled();

      // Second activation
      counter.use!(counter, activator, activator);
      expect(counter.count).toBe(0);

      // It uses a think function to fire multiTrigger
      expect(counter.nextthink).toBeGreaterThan(0);

      // Advance time to process think
      // We simulate the scheduler calling the think function
      if (counter.think) {
        counter.think(counter);
      }

      expect(target.use).toHaveBeenCalled();
    });

    it('should default count to 2 if not set', () => {
      const counter = entities.spawn();
      counter.classname = 'trigger_counter';
      counter.count = 0; // Not set

      const spawnFunc = registry.get('trigger_counter');
      spawnFunc!(counter, {
        entities,
        keyValues: {},
        warn: warnSpy,
        free: vi.fn()
      });

      expect(counter.count).toBe(2);
    });
  });

  describe('trigger_key', () => {
    it('should require a key item to activate', () => {
      // Setup the trigger
      const trigger = entities.spawn();
      trigger.classname = 'trigger_key';
      trigger.target = 'door';

      const spawnFunc = registry.get('trigger_key');
      spawnFunc!(trigger, {
        entities,
        keyValues: { item: 'key_pass' },
        warn: warnSpy,
        free: vi.fn()
      });

      expect(trigger.item).toBe('key_pass');

      // Setup target
      const target = entities.spawn();
      target.targetname = 'door';
      target.use = vi.fn();

      // Setup mock lookup
      findByTargetNameSpy.mockImplementation((name: string) => {
        if (name === 'door') return [target];
        return [];
      });

      // Setup player without key
      const player = entities.spawn();
      player.classname = 'player';
      player.inventory = {};
      player.client = {} as any;

      // Mock centerprintf
      entities.engine.centerprintf = vi.fn();
      entities.sound = vi.fn();

      // Attempt to use
      trigger.use!(trigger, player, player);

      // Should not activate
      expect(target.use).not.toHaveBeenCalled();
      expect(entities.engine.centerprintf).toHaveBeenCalledWith(player, 'You need the key_pass');

      // Give key
      player.inventory['key_pass'] = 1;

      // Attempt to use again
      (entities.engine.centerprintf as any).mockClear();
      trigger.use!(trigger, player, player);

      // Should activate
      expect(target.use).toHaveBeenCalled();

      // Should consume key
      expect(player.inventory['key_pass']).toBeUndefined();
    });

    it('should warn if spawned without item key', () => {
      const trigger = entities.spawn();
      const freeSpy = vi.fn();

      const spawnFunc = registry.get('trigger_key');
      spawnFunc!(trigger, {
        entities,
        keyValues: {},
        warn: warnSpy,
        free: freeSpy
      });

      expect(warnSpy).toHaveBeenCalledWith('trigger_key requires an item');
      expect(freeSpy).toHaveBeenCalledWith(trigger);
    });
  });
});
