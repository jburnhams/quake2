import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerTriggerLook } from '../../../src/entities/triggers/look.js';
import { Entity, Solid, ServerFlags, MoveType } from '../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { Vec3 } from '@quake2ts/shared';

describe('trigger_look', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerTriggerLook(registry);

    entity = new Entity(1);
    entity.classname = 'trigger_look';
    entity.origin = { x: 100, y: 0, z: 0 }; // Trigger at 100,0,0
  });

  it('should initialize correctly', () => {
    const spawnFn = registry.get('trigger_look');
    spawnFn?.(entity, context);
    expect(entity.movetype).toBe(MoveType.None);
    expect(entity.solid).toBe(Solid.Not);
    expect(entity.svflags).toBe(ServerFlags.NoClient);
    expect(entity.think).toBeDefined();
    expect(context.entities.scheduleThink).toHaveBeenCalled();
  });

  it('should trigger when player looks at it', () => {
      const spawnFn = registry.get('trigger_look');
      spawnFn?.(entity, context);

      const player = new Entity(2);
      player.classname = 'player';
      player.origin = { x: 0, y: 0, z: 0 };
      player.angles = { x: 0, y: 0, z: 0 }; // Facing +X, directly at trigger
      player.health = 100;

      // Mock finding player
      context.entities.findByClassname = vi.fn().mockReturnValue([player]);

      // Run think
      entity.think?.(entity);

      expect(context.entities.useTargets).toHaveBeenCalledWith(entity, player);
      expect(context.entities.free).toHaveBeenCalledWith(entity);
  });

  it('should not trigger when player looks away', () => {
      const spawnFn = registry.get('trigger_look');
      spawnFn?.(entity, context);

      const player = new Entity(2);
      player.classname = 'player';
      player.origin = { x: 0, y: 0, z: 0 };
      player.angles = { x: 0, y: 180, z: 0 }; // Facing -X, away from trigger
      player.health = 100;

      context.entities.findByClassname = vi.fn().mockReturnValue([player]);

      entity.think?.(entity);

      expect(context.entities.useTargets).not.toHaveBeenCalled();
      expect(context.entities.scheduleThink).toHaveBeenCalled(); // Rescheduled
  });

  it('should respect custom FOV', () => {
      entity.fov = 0.99; // Very narrow FOV
      const spawnFn = registry.get('trigger_look');
      spawnFn?.(entity, context);

      const player = new Entity(2);
      player.classname = 'player';
      player.origin = { x: 0, y: 0, z: 0 };
      player.angles = { x: 0, y: 10, z: 0 }; // Slightly off
      player.health = 100;

      context.entities.findByClassname = vi.fn().mockReturnValue([player]);

      entity.think?.(entity);

      // dot product of 0 and 10 deg is cos(10) ~= 0.9848 < 0.99
      expect(context.entities.useTargets).not.toHaveBeenCalled();

      // Change angle to 0
      player.angles = { x: 0, y: 0, z: 0 };
      entity.think?.(entity);
      expect(context.entities.useTargets).toHaveBeenCalled();
  });
});
