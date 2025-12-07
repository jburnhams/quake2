import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefaultSpawnRegistry, spawnEntityFromDictionary } from '../../src/entities/spawn.js';
import { EntitySystem } from '../../src/entities/system.js';
import { ServerFlags, Entity } from '../../src/entities/entity.js';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('New Target Entities', () => {
  let registry: any;
  let entities: EntitySystem;
  let mockEngine: any;

  beforeEach(() => {
    registry = createDefaultSpawnRegistry();
    mockEngine = {
        soundIndex: vi.fn().mockReturnValue(1),
        modelIndex: vi.fn().mockReturnValue(1),
        sound: vi.fn(),
    };
    entities = new EntitySystem(mockEngine, undefined, undefined, 2048);
    // Mock cvar functions
    (entities.imports as any).cvar = vi.fn().mockReturnValue({ value: 0 });
    (entities.imports as any).cvar_set = vi.fn();
    (entities.imports as any).configstring = vi.fn();
    (entities.imports as any).serverCommand = vi.fn();
    (entities.imports as any).positioned_sound = vi.fn();
    (entities.imports as any).imageindex = vi.fn().mockReturnValue(1);
    (entities.imports as any).soundindex = vi.fn().mockReturnValue(1);
    (entities.imports as any).multicast = vi.fn();
    (entities.imports as any).get_configstring = vi.fn().mockReturnValue("az"); // Default light ramp
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

    expect(entities.imports.multicast).toHaveBeenCalled();
  });

  it('target_story should update story configstring', () => {
     const target = spawnEntityFromDictionary({ classname: 'target_story', message: 'Once upon a time...' }, { registry, entities });

     target.use(target, null, null, entities);

     expect(entities.imports.configstring).toHaveBeenCalledWith(ConfigStringIndex.Story, 'Once upon a time...');
  });

});
