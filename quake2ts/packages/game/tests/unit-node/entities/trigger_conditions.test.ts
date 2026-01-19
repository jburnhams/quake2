import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestGame, createPlayerEntityFactory } from '@quake2ts/test-utils';
import type { EntitySystem } from '../../../src/entities/system.js';
import type { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('Trigger Conditions', () => {
  let sys: EntitySystem;
  let registry: SpawnRegistry;
  let engine: any;
  let warnSpy: any;

  beforeEach(() => {
    const { game, engine: mockEngine } = createTestGame();
    sys = game.entities;
    engine = mockEngine;
    registry = (sys as any).spawnRegistry;
    warnSpy = vi.fn();
  });

  describe('trigger_counter', () => {
    it('should fire targets only after count reaches zero', () => {
      const spawnFn = registry.get('trigger_counter')!;

      const counter = sys.spawn();
      counter.classname = 'trigger_counter';
      counter.count = 2; // Needs 2 activations
      counter.target = 'my_target';
      counter.wait = -1; // Default

      const context = {
          entities: sys,
          keyValues: {},
          warn: warnSpy,
          free: vi.fn(),
          health_multiplier: 1
      };

      spawnFn(counter, context);
      sys.finalizeSpawn(counter);

      // Setup the target
      const target = sys.spawn();
      target.classname = 'info_notnull';
      target.targetname = 'my_target';
      target.use = vi.fn();
      sys.finalizeSpawn(target);

      // Mock activator
      const activator = sys.spawn();
      activator.classname = 'player';
      activator.client = {} as any;

      // First activation
      if (counter.use) counter.use(counter, activator, activator);
      expect(counter.count).toBe(1);
      expect(target.use).not.toHaveBeenCalled();

      // Second activation
      if (counter.use) counter.use(counter, activator, activator);
      expect(counter.count).toBe(0);

      expect(target.use).toHaveBeenCalled();
      expect(counter.nextthink).toBeGreaterThan(0);
    });

    it('should default count to 2 if not set', () => {
      const spawnFn = registry.get('trigger_counter')!;
      const counter = sys.spawn();
      counter.classname = 'trigger_counter';
      counter.count = 0; // Not set

      const context = {
          entities: sys,
          keyValues: {},
          warn: warnSpy,
          free: vi.fn(),
          health_multiplier: 1
      };

      spawnFn(counter, context);
      expect(counter.count).toBe(2);
    });
  });

  describe('trigger_key', () => {
    it('should require a key item to activate', () => {
      const spawnFn = registry.get('trigger_key')!;

      const trigger = sys.spawn();
      trigger.classname = 'trigger_key';
      trigger.target = 'door';

      const context = {
          entities: sys,
          keyValues: { item: 'key_pass' },
          warn: warnSpy,
          free: vi.fn(),
          health_multiplier: 1
      };

      spawnFn(trigger, context);
      sys.finalizeSpawn(trigger);

      expect(trigger.item).toBe('key_pass');

      // Setup target
      const target = sys.spawn();
      target.targetname = 'door';
      target.use = vi.fn();
      sys.finalizeSpawn(target);

      // Setup player using factory
      const player = sys.spawn();
      Object.assign(player, createPlayerEntityFactory());
      player.inventory = {};

      // Reset mocks
      (engine.centerprintf as any).mockClear();

      // Attempt to use
      if (trigger.use) trigger.use(trigger, player, player);

      // Should not activate
      expect(target.use).not.toHaveBeenCalled();
      expect(engine.centerprintf).toHaveBeenCalledWith(player, 'You need the key_pass');

      // Give key
      player.inventory['key_pass'] = 1;

      // Attempt to use again
      (engine.centerprintf as any).mockClear();
      if (trigger.use) trigger.use(trigger, player, player);

      // Should activate
      expect(target.use).toHaveBeenCalled();

      // Should consume key
      expect(player.inventory['key_pass']).toBeUndefined();
    });

    it('should warn if spawned without item key', () => {
      const spawnFn = registry.get('trigger_key')!;
      const trigger = sys.spawn();
      const freeSpy = vi.fn();

      const context = {
          entities: sys,
          keyValues: {},
          warn: warnSpy,
          free: freeSpy,
          health_multiplier: 1
      };

      spawnFn(trigger, context);

      expect(warnSpy).toHaveBeenCalledWith('trigger_key requires an item');
      expect(freeSpy).toHaveBeenCalledWith(trigger);
    });
  });
});
