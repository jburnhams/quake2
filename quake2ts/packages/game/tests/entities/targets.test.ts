import { describe, it, expect, vi } from 'vitest';
import { createDefaultSpawnRegistry, spawnEntityFromDictionary } from '../../src/entities/spawn.js';
import { EntitySystem } from '../../src/entities/system.js';
import { Solid, ServerFlags } from '../../src/entities/entity.js';

describe('Target Entities', () => {
  const registry = createDefaultSpawnRegistry();
  const entities = new EntitySystem(2048);

  it('target_secret should trigger targets when count reaches zero', () => {
    const useTargetsMock = vi.spyOn(entities, 'useTargets');
    const activator = entities.spawn();
    const target = spawnEntityFromDictionary({ classname: 'target_secret', count: '2' }, { registry, entities });
    target.activator = activator;

    target.use(target, null, activator, entities);
    expect(target.count).toBe(1);
    expect(useTargetsMock).not.toHaveBeenCalled();

    target.use(target, null, activator, entities);
    expect(target.count).toBe(0);
    expect(useTargetsMock).toHaveBeenCalledWith(target, activator);
  });

  it('target_goal should trigger targets when used', () => {
    const useTargetsMock = vi.spyOn(entities, 'useTargets');
    const activator = entities.spawn();
    const target = spawnEntityFromDictionary({ classname: 'target_goal' }, { registry, entities });
    target.activator = activator;

    target.use(target, null, activator, entities);
    expect(useTargetsMock).toHaveBeenCalledWith(target, activator);
  });

  it('target_changelevel should be created with a map', () => {
    const target = spawnEntityFromDictionary({ classname: 'target_changelevel', map: 'new_level' }, { registry, entities });
    expect(target).not.toBeNull();
    expect(target.map).toBe('new_level');
    expect(target.solid).toBe(Solid.Trigger);
  });

  it('target_explosion should be created', () => {
    const target = spawnEntityFromDictionary({ classname: 'target_explosion' }, { registry, entities });
    expect(target).not.toBeNull();
    expect(target.svflags & ServerFlags.NoClient).toBe(ServerFlags.NoClient);
    expect(target.use).toBeDefined();
  });

  it('target_splash should be created', () => {
    const target = spawnEntityFromDictionary({ classname: 'target_splash' }, { registry, entities });
    expect(target).not.toBeNull();
    expect(target.svflags & ServerFlags.NoClient).toBe(ServerFlags.NoClient);
    expect(target.use).toBeDefined();
  });
});
