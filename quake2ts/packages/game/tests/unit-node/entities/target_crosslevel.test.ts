import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestGame } from '@quake2ts/test-utils';
import type { EntitySystem } from '../../../src/entities/system.js';
import type { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('target_crosslevel', () => {
  let sys: EntitySystem;
  let registry: SpawnRegistry;

  beforeEach(() => {
    const { game } = createTestGame();
    sys = game.entities;
    // createTestGame sets up the registry on the entities system
    registry = (sys as any).spawnRegistry;
  });

  describe('target_crosslevel_trigger', () => {
    it('should set crossLevelFlags when used', () => {
      const spawnFn = registry.get('target_crosslevel_trigger')!;
      const ent = sys.spawn();
      ent.spawnflags = 5; // Bits 1 and 3 set (1 | 4)

      const context = {
        entities: sys,
        free: vi.fn(),
        keyValues: {},
        health_multiplier: 1,
        warn: vi.fn(),
      };

      spawnFn(ent, context);

      // Trigger it
      expect(sys.crossLevelFlags).toBe(0);
      if (ent.use) {
        ent.use(ent, null, null);
      }

      expect(sys.crossLevelFlags).toBe(5);
      expect(context.free).toHaveBeenCalledWith(ent);
    });
  });

  describe('target_crosslevel_target', () => {
    it('should fire targets if flags match', () => {
      // Pre-set flags
      sys.crossLevelFlags = 5; // 1 | 4

      const spawnFn = registry.get('target_crosslevel_target')!;
      const ent = sys.spawn();
      ent.classname = 'target_crosslevel_target';
      ent.spawnflags = 4; // Only bit 3 required, which is present in 5
      ent.target = 'my_target';

      const context = {
        entities: sys,
        free: vi.fn(),
        keyValues: {},
        health_multiplier: 1,
        warn: vi.fn(),
      };

      spawnFn(ent, context);

      // Verify think is scheduled
      expect(ent.think).toBeDefined();
      expect(ent.nextthink).toBeGreaterThan(sys.timeSeconds);

      // Mock useTargets
      const useTargetsSpy = vi.spyOn(sys, 'useTargets');

      // Fast forward time to trigger think
      sys.beginFrame(ent.nextthink + 0.1);
      if (ent.think) {
        ent.think(ent);
      }

      expect(useTargetsSpy).toHaveBeenCalledWith(ent, ent);
      expect(context.free).toHaveBeenCalledWith(ent);
    });

    it('should NOT fire targets if flags do not match', () => {
      // Pre-set flags
      sys.crossLevelFlags = 1; // Only bit 1

      const spawnFn = registry.get('target_crosslevel_target')!;
      const ent = sys.spawn();
      ent.classname = 'target_crosslevel_target';
      ent.spawnflags = 4; // Requires bit 3
      ent.target = 'my_target';

      const context = {
        entities: sys,
        free: vi.fn(),
        keyValues: {},
        health_multiplier: 1,
        warn: vi.fn(),
      };

      spawnFn(ent, context);

      const useTargetsSpy = vi.spyOn(sys, 'useTargets');

      // Execute think
      if (ent.think) {
        ent.think(ent);
      }

      expect(useTargetsSpy).not.toHaveBeenCalled();
      expect(context.free).not.toHaveBeenCalled();
    });
  });

  describe('persistence', () => {
    it('should save and restore crossLevelFlags', () => {
      sys.crossLevelFlags = 12345;
      sys.crossUnitFlags = 67890;

      const snapshot = sys.createSnapshot();

      const { game: newGame } = createTestGame();
      const newSys = newGame.entities;

      newSys.restore(snapshot);

      expect(newSys.crossLevelFlags).toBe(12345);
      expect(newSys.crossUnitFlags).toBe(67890);
    });
  });
});
