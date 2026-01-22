import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerTriggerSecret } from '../../../../src/entities/triggers/secret.js';
import { Entity, Solid, ServerFlags, MoveType } from '../../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';
import { SpawnRegistry } from '../../../../src/entities/spawn.js';

describe('trigger_secret', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerTriggerSecret(registry);

    entity = new Entity(1);
    entity.classname = 'trigger_secret';
  });

  it('should initialize correctly', () => {
    const spawnFn = registry.get('trigger_secret');
    spawnFn?.(entity, context);
    expect(entity.movetype).toBe(MoveType.None);
    expect(entity.solid).toBe(Solid.Trigger);
    expect(entity.svflags).toBe(ServerFlags.NoClient);
    expect(entity.touch).toBeDefined();
  });

  it('should notify client on touch', () => {
      const spawnFn = registry.get('trigger_secret');
      spawnFn?.(entity, context);

      const player = new Entity(2);
      player.client = {} as any;
      player.classname = 'player';

      entity.touch?.(entity, player);

      expect(context.entities.engine.centerprintf).toHaveBeenCalledWith(player, 'You found a secret area!');
      expect(context.entities.sound).toHaveBeenCalledWith(player, 0, 'misc/secret.wav', 1, 1, 0);
  });

  it('should free itself if ONCE flag set', () => {
      entity.spawnflags = 1; // ONCE
      const spawnFn = registry.get('trigger_secret');
      spawnFn?.(entity, context);

      const player = new Entity(2);
      player.client = {} as any;

      entity.touch?.(entity, player);

      expect(context.entities.free).toHaveBeenCalledWith(entity);
  });

  it('should ignore non-client touch', () => {
      const spawnFn = registry.get('trigger_secret');
      spawnFn?.(entity, context);

      const monster = new Entity(2);
      monster.classname = 'monster_soldier';

      entity.touch?.(entity, monster);

      expect(context.entities.engine.centerprintf).not.toHaveBeenCalled();
  });

  it('should not re-trigger within timeout', () => {
      const spawnFn = registry.get('trigger_secret');
      spawnFn?.(entity, context);

      const player = new Entity(2);
      player.client = {} as any;

      entity.touch?.(entity, player);
      expect(context.entities.engine.centerprintf).toHaveBeenCalledTimes(1);

      // same time
      entity.touch?.(entity, player);
      expect(context.entities.engine.centerprintf).toHaveBeenCalledTimes(1);

      // advance time (initial is 10, so go to 12)
      context.entities.beginFrame(12.0);
      entity.touch?.(entity, player);
      expect(context.entities.engine.centerprintf).toHaveBeenCalledTimes(2);
  });

  it('should handle targetname enabling', () => {
      entity.targetname = 'secret1';
      const spawnFn = registry.get('trigger_secret');
      spawnFn?.(entity, context);

      expect(entity.solid).toBe(Solid.Not);
      expect(entity.use).toBeDefined();

      entity.use?.(entity, null, null);

      expect(entity.solid).toBe(Solid.Trigger);
      expect(entity.use).toBeUndefined();
  });
});
