import { describe, it, expect, vi } from 'vitest';
import { createDefaultSpawnRegistry, spawnEntityFromDictionary } from '../../src/entities/spawn.js';
import { EntitySystem } from '../../src/entities/system.js';
import { Solid, ServerFlags } from '../../src/entities/entity.js';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('Target Entities', () => {
  const registry = createDefaultSpawnRegistry();
  const mockEngine = {
        soundIndex: vi.fn().mockReturnValue(1),
        modelIndex: vi.fn().mockReturnValue(1),
        sound: vi.fn(),
  };
  const entities = new EntitySystem(mockEngine as any, undefined, undefined, 2048);
  (entities.imports as any).configstring = vi.fn();

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

  it('target_earthquake should trigger and update client state', () => {
    const activator = entities.spawn();
    (activator as any).client = { quake_time: 0 };

    const target = spawnEntityFromDictionary({ classname: 'target_earthquake', count: '5', speed: '200' }, { registry, entities });
    expect(target).not.toBeNull();
    expect(target.count).toBe(5);
    expect(target.speed).toBe(200);

    // Initial state
    expect((activator as any).client.quake_time).toBe(0);

    // Fire it
    target.use(target, null, activator, entities);

    // Manually call think to simulate frame
    if (target.think) {
        entities.beginFrame(1.0);
        target.think(target);

        expect((activator as any).client.quake_time).toBeCloseTo(1.2);
    }
  });

  it('target_lightramp should calculate movedir and update configstring', () => {
    const configStringMock = entities.imports.configstring;

    const target = spawnEntityFromDictionary({
        classname: 'target_lightramp',
        target: 'some_light',
        message: 'az', // 'a' to 'z'
        speed: '10' // 10 seconds
    }, { registry, entities });

    // Spawn dummy light target
    const light = entities.spawn();
    light.classname = 'light';
    light.targetname = 'some_light';
    light.style = 5;

    // Trigger
    target.use(target, null, null, entities);

    // Verify target found
    expect(target.enemy).toBe(light);

    // Call think to verify configstring update
    entities.beginFrame(5.0); // 5 seconds later

    if (target.think) {
        target.think(target);

        // 'a' is 97, 'z' is 122. Range 25.
        // Halfway (5s / 10s) = 0.5 * 25 = 12.5.
        // 97 + 12.5 = 109.5 -> 'm' (109) or 'n' (110).
        expect(configStringMock).toHaveBeenCalled();
        const callArgs = (configStringMock as any).mock.calls[0];
        expect(callArgs[0]).toBe(ConfigStringIndex.Lights + 5);
        expect(callArgs[1].length).toBe(1);
    }
  });
});
