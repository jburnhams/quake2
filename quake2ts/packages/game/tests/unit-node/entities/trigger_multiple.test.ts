import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerTriggerSpawns } from '../../../src/entities/triggers/index.js';
import { Entity, Solid } from '../../../src/entities/entity.js';
import { createTestContext, createTriggerEntityFactory, createPlayerEntityFactory, spawnEntity } from '@quake2ts/test-utils';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('trigger_multiple', () => {
  let context: ReturnType<typeof createTestContext>;
  let entity: Entity;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerTriggerSpawns(registry);

    // Use createTriggerEntityFactory and spawnEntity
    entity = spawnEntity(context.entities, createTriggerEntityFactory('trigger_multiple'));
  });

  it('should initialize correctly', () => {
    const spawnFn = registry.get('trigger_multiple');
    spawnFn?.(entity, context);
    expect(entity.wait).toBe(0.2);
    expect(entity.touch).toBeDefined();
    expect(entity.use).toBeDefined();
    expect(entity.solid).toBe(Solid.Trigger);
  });

  it('should play sounds', () => {
      // Set sounds to 1 (secret)
      entity.sounds = 1;
      const spawnFn = registry.get('trigger_multiple');
      spawnFn?.(entity, context);

      // Trigger it
      const activator = spawnEntity(context.entities, createPlayerEntityFactory({
          number: 2
      }));

      // For use(), we don't check canActivate.
      entity.use?.(entity, activator, activator);

      // Check sound played
      expect(context.entities.sound).toHaveBeenCalledWith(entity, 0, 'misc/secret.wav', 1, 1, 0);
  });

  it('should display message', () => {
      entity.message = 'Test Message';
      entity.sounds = 2; // talk sound
      const spawnFn = registry.get('trigger_multiple');
      spawnFn?.(entity, context);

      const activator = spawnEntity(context.entities, createPlayerEntityFactory({
           number: 2
      }));

      entity.use?.(entity, activator, activator);

      expect(context.entities.engine.centerprintf).toHaveBeenCalledWith(activator, 'Test Message');
      expect(context.entities.sound).toHaveBeenCalledWith(activator, 0, 'misc/talk.wav', 1, 1, 0);
  });

  it('should handle CLIP spawnflag', () => {
      // CLIP = 32
      entity.spawnflags = 32;
      const spawnFn = registry.get('trigger_multiple');
      spawnFn?.(entity, context);

      expect(entity.solid).toBe(Solid.Bsp);
  });
});
