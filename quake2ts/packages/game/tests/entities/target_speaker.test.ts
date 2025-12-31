import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefaultSpawnRegistry, spawnEntityFromDictionary } from '../../src/entities/spawn.js';
import { EntitySystem } from '../../src/entities/system.js';
import { Solid } from '../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';

describe('target_speaker', () => {
  let entities: EntitySystem;
  let registry: any;
  let mockEngine: any;
  let context: ReturnType<typeof createTestContext>;

  beforeEach(async () => {
    // Use createTestContext to get a standardized mocked environment
    context = await createTestContext();
    entities = context.entities;
    // createDefaultSpawnRegistry calls registerTargetSpawns internally
    registry = createDefaultSpawnRegistry(context.game);
    entities.setSpawnRegistry(registry);

    // Override engine mocks specific to this test
    mockEngine = context.engine;
    mockEngine.soundIndex = vi.fn().mockImplementation((name) => {
        if (name === 'world/amb1.wav') return 10;
        return 0;
    });
    mockEngine.modelIndex = vi.fn().mockReturnValue(1);
    mockEngine.sound = vi.fn();
  });

  it('should initialize correctly with noise', () => {
    const target = spawnEntityFromDictionary({
        classname: 'target_speaker',
        noise: 'world/amb1.wav',
        volume: '0.5',
        attenuation: '2'
    }, { registry, entities });

    expect(target).not.toBeNull();
    expect(target?.message).toBe('world/amb1.wav');
    expect(target?.noise_index).toBe(10);
    expect(target?.volume).toBe(0.5);
    expect(target?.attenuation).toBe(2);
    expect(target?.solid).toBe(Solid.Not);
    expect(mockEngine.soundIndex).toHaveBeenCalledWith('world/amb1.wav');
  });

  it('should handle LoopedOn spawnflag correctly', () => {
    const LOOPED_ON = 1;
    const target = spawnEntityFromDictionary({
        classname: 'target_speaker',
        noise: 'world/amb1.wav',
        spawnflags: `${LOOPED_ON}`
    }, { registry, entities });

    expect(target?.spawnflags & LOOPED_ON).toBe(LOOPED_ON);
    expect(target?.sounds).toBe(10); // Should match noise_index
  });

  it('should play sound when used (one-shot)', () => {
    const target = spawnEntityFromDictionary({
        classname: 'target_speaker',
        noise: 'world/amb1.wav'
    }, { registry, entities });

    if (target?.use) {
        target.use(target, null, null, context.entities);
    }

    expect(mockEngine.sound).toHaveBeenCalledWith(
        target,
        2, // channel
        'world/amb1.wav',
        1.0, // default volume
        1, // default attenuation (ATTN_NORM)
        0
    );
  });

  it('should toggle looped sound when used', () => {
    const LOOPED_ON = 1;
    const LOOPED_OFF = 2;

    // Start with LOOPED_ON
    const target = spawnEntityFromDictionary({
        classname: 'target_speaker',
        noise: 'world/amb1.wav',
        spawnflags: `${LOOPED_ON}`
    }, { registry, entities });

    expect(target?.sounds).toBe(10);

    // Toggle off
    if (target?.use) {
        target.use(target, null, null, context.entities);
    }

    expect(target?.spawnflags & LOOPED_ON).toBe(0);
    expect(target?.spawnflags & LOOPED_OFF).toBe(LOOPED_OFF);
    expect(target?.sounds).toBe(0);

    // Toggle on
    if (target?.use) {
        target.use(target, null, null, context.entities);
    }

    expect(target?.spawnflags & LOOPED_ON).toBe(LOOPED_ON);
    expect(target?.spawnflags & LOOPED_OFF).toBe(0);
    expect(target?.sounds).toBe(10);
  });
});
