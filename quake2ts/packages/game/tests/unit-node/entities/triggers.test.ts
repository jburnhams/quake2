import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestGame } from '@quake2ts/test-utils';
import { registerTriggerSpawns } from '../../../src/entities/triggers/index.js';
import { registerTargetSpawns } from '../../../src/entities/targets.js';
import type { EntitySystem } from '../../../src/entities/system.js';
import type { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('Triggers', () => {
  let sys: EntitySystem;
  let registry: SpawnRegistry;
  let engine: any;

  beforeEach(() => {
    const { game, engine: mockEngine } = createTestGame();
    sys = game.entities;
    engine = mockEngine;
    registry = (sys as any).spawnRegistry;

    // Ensure all triggers/targets are registered (createTestGame does it via createGame -> default registry)
    // But to be safe or explicit:
    // createGame calls registerDefaultSpawns which calls registerTriggerSpawns and registerTargetSpawns.
    // So they should be there.
  });

  describe('trigger_counter', () => {
    it('should fire targets after counting down', () => {
      const spawnFn = registry.get('trigger_counter')!;

      const trigger = sys.spawn();
      trigger.classname = 'trigger_counter';
      trigger.count = 2;
      trigger.target = 'my_target';

      const context = {
          entities: sys,
          keyValues: { count: '2' },
          warn: vi.fn(),
          free: vi.fn(),
          health_multiplier: 1
      };

      spawnFn(trigger, context);

      const target = sys.spawn();
      target.classname = 'target_relay';
      target.targetname = 'my_target';
      target.use = vi.fn();
      // We must register the target in the name index manually if we don't use spawn logic that does it.
      // sys.spawn() creates raw entity.
      // finalizeSpawn handles registration.
      // But spawnFn usually handles initialization.
      // For `target`, we just set properties.
      // We must call finalizeSpawn or registerTarget manually.
      // EntitySystem has private registerTarget called by finalizeSpawn.
      sys.finalizeSpawn(target);
      sys.finalizeSpawn(trigger);

      const activator = sys.spawn();
      activator.client = {} as any;

      // First use
      if (trigger.use) trigger.use(trigger, activator, activator);
      expect(trigger.count).toBe(1);
      expect(target.use).not.toHaveBeenCalled();

      // Second use
      if (trigger.use) trigger.use(trigger, activator, activator);
      expect(trigger.count).toBe(0);

      // trigger_counter fires immediately (multiTrigger with wait=-1)
      expect(target.use).toHaveBeenCalled();
    });

    it('should display messages by default', () => {
        const spawnFn = registry.get('trigger_counter')!;

        const trigger = sys.spawn();
        trigger.classname = 'trigger_counter';
        trigger.count = 2;

        const context = {
            entities: sys,
            keyValues: { count: '2' },
            warn: vi.fn(),
            free: vi.fn(),
            health_multiplier: 1
        };

        spawnFn(trigger, context);
        sys.finalizeSpawn(trigger);

        const activator = sys.spawn();
        activator.client = {} as any;

        // Reset mocks
        (engine.centerprintf as any).mockClear();
        (engine.sound as any).mockClear();

        // First use
        if (trigger.use) trigger.use(trigger, activator, activator);
        expect(engine.centerprintf).toHaveBeenCalledWith(activator, '1 more to go...');
        expect(engine.sound).toHaveBeenCalledWith(activator, expect.anything(), 'misc/talk1.wav', expect.anything(), expect.anything(), expect.anything());

        (engine.centerprintf as any).mockClear();
        (engine.sound as any).mockClear();

        // Second use
        if (trigger.use) trigger.use(trigger, activator, activator);
        expect(engine.centerprintf).toHaveBeenCalledWith(activator, 'Sequence completed!');
        expect(engine.sound).toHaveBeenCalledWith(activator, expect.anything(), 'misc/talk1.wav', expect.anything(), expect.anything(), expect.anything());
      });

      it('should suppress messages with spawnflag 1', () => {
        const spawnFn = registry.get('trigger_counter')!;

        const trigger = sys.spawn();
        trigger.classname = 'trigger_counter';
        trigger.count = 2;
        trigger.spawnflags = 1; // NOMESSAGE

        const context = {
            entities: sys,
            keyValues: { count: '2', spawnflags: '1' },
            warn: vi.fn(),
            free: vi.fn(),
            health_multiplier: 1
        };

        spawnFn(trigger, context);
        sys.finalizeSpawn(trigger);

        const activator = sys.spawn();
        activator.client = {} as any;

        (engine.centerprintf as any).mockClear();
        (engine.sound as any).mockClear();

        // First use
        if (trigger.use) trigger.use(trigger, activator, activator);
        expect(engine.centerprintf).not.toHaveBeenCalled();
        expect(engine.sound).not.toHaveBeenCalled();

        // Second use
        if (trigger.use) trigger.use(trigger, activator, activator);
        expect(engine.centerprintf).not.toHaveBeenCalled();
        expect(engine.sound).not.toHaveBeenCalled();
      });
  });

  describe('trigger_always', () => {
    it('should fire immediately if delay is small', () => {
      const spawnFn = registry.get('trigger_always')!;

      const trigger = sys.spawn();
      trigger.classname = 'trigger_always';
      trigger.target = 'always_target';
      trigger.delay = 0; // Should default to 0.2

      const context = {
          entities: sys,
          keyValues: {},
          warn: vi.fn(),
          free: vi.fn(),
          health_multiplier: 1
      };

      const target = sys.spawn();
      target.targetname = 'always_target';
      target.use = vi.fn();
      sys.finalizeSpawn(target);

      // Before spawnFn, time is 0.
      sys.beginFrame(0);

      spawnFn(trigger, context);
      sys.finalizeSpawn(trigger);

      // trigger_always calls useTargets in spawn.
      // useTargets schedules think on DelayedUse entity (not trigger itself) because default delay 0.2.

      expect(trigger.delay).toBe(0.2);

      expect(target.use).not.toHaveBeenCalled();

      // Advance time by 0.3s
      sys.beginFrame(0.3);
      sys.runFrame(); // Process thinks

      expect(target.use).toHaveBeenCalled();
    });
  });

  describe('trigger_relay', () => {
    it('should pass through to targets', () => {
      const spawnFn = registry.get('trigger_relay')!;

      const trigger = sys.spawn();
      trigger.classname = 'trigger_relay';
      trigger.target = 'relay_target';
      trigger.spawnflags = 1; // NoSound

      const context = {
          entities: sys,
          keyValues: { spawnflags: '1' },
          warn: vi.fn(),
          free: vi.fn(),
          health_multiplier: 1
      };

      spawnFn(trigger, context);
      sys.finalizeSpawn(trigger);

      const target = sys.spawn();
      target.targetname = 'relay_target';
      target.use = vi.fn();
      sys.finalizeSpawn(target);

      const activator = sys.spawn();
      if (trigger.use) trigger.use(trigger, activator, activator);

      expect(target.use).toHaveBeenCalled();
    });
  });
});
