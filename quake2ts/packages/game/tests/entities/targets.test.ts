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

  it('target_earthquake should trigger and update client state', () => {
    const activator = entities.spawn();
    // Use type assertion or extend type if needed for test
    (activator as any).client = { quake_time: 0 };

    // Create a mock entity to be iterated over
    // We need to inject it into entities or ensure it's in the loop.
    // EntitySystem.forEachEntity iterates over used entities.

    // target_earthquake checks all entities with clients.
    // In our simplified test, activator has client.

    const target = spawnEntityFromDictionary({ classname: 'target_earthquake', count: '5', speed: '200' }, { registry, entities });
    expect(target).not.toBeNull();
    expect(target.count).toBe(5);
    expect(target.speed).toBe(200);

    // Initial state
    expect((activator as any).client.quake_time).toBe(0);

    // Fire it
    target.use(target, null, activator, entities);

    // think function needs to be called to update clients
    // Calling use sets up timestamp and potentially nextthink.
    // Default quake behavior: use sets timestamp, think updates clients continuously.

    // Manually call think to simulate frame
    if (target.think) {
        // Mock time
        entities.beginFrame(1.0);
        target.think(target);

        // Check if activator's client quake_time was updated
        // target_earthquake_think updates client->quake_time = level.time + 0.2 (approx)
        // Actually code says: ent.client.quake_time = context.entities.timeSeconds + 0.2;
        expect((activator as any).client.quake_time).toBeCloseTo(1.2);
    }
  });

  it('target_lightramp should calculate movedir and update configstring', () => {
    // Mock entities.configstring
    const configStringMock = vi.fn();
    (entities as any).configstring = configStringMock;

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
    entities.time = target.timestamp + 5.0; // Halfway
    if (target.think) {
        target.think(target);

        // 'a' is 97, 'z' is 122. Range 25.
        // Halfway (5s / 10s) = 0.5 * 25 = 12.5.
        // 97 + 12.5 = 109.5 -> 'm' (109) or 'n' (110).
        // Let's check call arguments.
        expect(configStringMock).toHaveBeenCalled();
        const callArgs = configStringMock.mock.calls[0];
        expect(callArgs[0]).toBe(32 + 5); // CS_LIGHTS + style
        expect(callArgs[1].length).toBe(1); // Should be a single char string
    }
  });
});
