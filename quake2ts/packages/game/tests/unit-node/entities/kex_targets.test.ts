import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefaultSpawnRegistry, spawnEntityFromDictionary } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { ServerFlags, Entity } from '../../../src/entities/entity.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { createTestContext } from '@quake2ts/test-utils';

describe('New Target Entities', () => {
  let registry: ReturnType<typeof createDefaultSpawnRegistry>;
  let entities: EntitySystem;

  beforeEach(() => {
    const context = createTestContext();
    registry = createDefaultSpawnRegistry();
    entities = context.entities;

    // Set up needed mocks that are specific to kex_targets tests
    entities.imports.cvar = vi.fn().mockReturnValue({ value: 0, string: '0' });
    entities.imports.cvar_set = vi.fn();
    entities.imports.configstring = vi.fn();
    entities.imports.serverCommand = vi.fn();
    entities.imports.positioned_sound = vi.fn();
    entities.imports.imageindex = vi.fn().mockReturnValue(1);
    entities.imports.soundindex = vi.fn().mockReturnValue(1);
    entities.imports.multicast = vi.fn();
    entities.multicast = vi.fn(); // Also mock system multicast
    entities.imports.get_configstring = vi.fn().mockReturnValue("az"); // Default light ramp

    // Some entities need engine mocked
    entities.engine.soundIndex = vi.fn().mockReturnValue(1);
    entities.engine.modelIndex = vi.fn().mockReturnValue(1);
    entities.engine.sound = vi.fn();

    // Add missing level properties that these tests expect
    entities.level.helpmessage1 = '';
    entities.level.helpmessage2 = '';
  });

  it('target_gravity should set sv_gravity cvar and level.gravity', () => {
    const target = spawnEntityFromDictionary({ classname: 'target_gravity', gravity: '400' }, { registry, entities });
    expect(target).not.toBeNull();
    expect(target.gravity).toBe(400);

    target.use(target, null, null, entities);

    expect(entities.level.gravity).toBe(400);
    expect(entities.imports.cvar_set).toHaveBeenCalledWith('sv_gravity', '400');
  });

  it('target_soundfx should play sound after delay', () => {
    const target = spawnEntityFromDictionary({ classname: 'target_soundfx', noise: '1', delay: '0.5' }, { registry, entities });
    expect(target).not.toBeNull();

    // Check initial parsing
    // soundIndex comes from engine.soundIndex which is mocked to return 1
    expect(target.noise_index).toBe(1);

    // Simulate use
    target.use(target, null, null, entities);
    expect(target.nextthink).toBeGreaterThan(entities.timeSeconds);
    expect(target.think).toBeDefined();

    // Simulate think
    if (target.think) {
        target.think(target, entities);
        expect(entities.imports.positioned_sound).toHaveBeenCalledWith(
            expect.anything(),
            target,
            expect.anything(), // CHAN_VOICE
            expect.anything(), // noise_index
            expect.anything(), // volume
            expect.anything(), // attenuation
            0
        );
    }
  });

  it('target_help should set help message and optionally POI', () => {
    const target = spawnEntityFromDictionary({ classname: 'target_help', message: 'Help Me', spawnflags: '2' }, { registry, entities });
    expect(target).not.toBeNull();
    expect(target.message).toBe('Help Me');

    target.use(target, null, null, entities);
    expect(entities.level.helpmessage1).toBe(''); // Default spawns to help2 if flag not set?
    // target_help use: if (spawnflags & HELP1) ... else ...
    // Our test spawns with flag '2' which is SET_POI. HELP1 is 1.
    // So it should go to else block -> helpmessage2.
    expect(entities.level.helpmessage2).toBe('Help Me');
  });

  it('target_sky should update configstrings', () => {
    const target = spawnEntityFromDictionary({ classname: 'target_sky', sky: 'unit1_sky', skyaxis: '0 0 1', skyrotate: '10' }, { registry, entities });

    target.use(target, null, null, entities);

    expect(entities.imports.configstring).toHaveBeenCalledWith(expect.anything(), 'unit1_sky');
  });

  it('target_achievement should send multicast event', () => {
    // entities.multicast calls imports.multicast which is mocked
    const target = spawnEntityFromDictionary({ classname: 'target_achievement', achievement: 'ACH_FRAG' }, { registry, entities });

    target.use(target, null, null, entities);

    expect(entities.multicast).toHaveBeenCalled();
  });

  it('target_story should update story configstring', () => {
     const target = spawnEntityFromDictionary({ classname: 'target_story', message: 'Once upon a time...' }, { registry, entities });

     target.use(target, null, null, entities);

     expect(entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.Story, 'Once upon a time...');
  });

});
