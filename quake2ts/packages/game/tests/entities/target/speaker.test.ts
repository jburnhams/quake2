import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTargetSpeaker } from '../../../src/entities/target/speaker.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity, Solid, ServerFlags } from '../../../src/entities/entity.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { createTestContext } from '../../test-helpers.js';

describe('target_speaker', () => {
  let context: ReturnType<typeof createTestContext>;
  let registry: SpawnRegistry;

  beforeEach(() => {
    context = createTestContext();
    registry = new SpawnRegistry();
    registerTargetSpeaker(registry);
  });

  it('registers target_speaker classname', () => {
    expect(registry.get('target_speaker')).toBeDefined();
  });

  it('initializes default properties', () => {
    const entity = context.entities.spawn();
    entity.classname = 'target_speaker';

    const spawnFunc = registry.get('target_speaker');
    spawnFunc!(entity, {
      keyValues: {},
      entities: context.entities,
      health_multiplier: 1,
      warn: vi.fn(),
      free: vi.fn(),
    });

    expect(entity.attenuation).toBe(1); // ATTN_NORM
    expect(entity.volume).toBe(1.0);
    expect(entity.solid).toBe(Solid.Not);
    expect(entity.noise_index).toBe(0);
  });

  it('parses keyvalues correctly', () => {
    const entity = context.entities.spawn();
    entity.classname = 'target_speaker';

    const spawnFunc = registry.get('target_speaker');
    spawnFunc!(entity, {
      keyValues: {
        noise: 'world/amb1.wav',
        attenuation: '2',
        volume: '0.5'
      },
      entities: context.entities,
      health_multiplier: 1,
      warn: vi.fn(),
      free: vi.fn(),
    });

    expect(entity.message).toBe('world/amb1.wav');
    expect(entity.noise_index).toBe(1);
    expect(entity.attenuation).toBe(2);
    expect(entity.volume).toBe(0.5);
  });

  it('handles LoopedOn spawnflag at spawn time', () => {
    const entity = context.entities.spawn();
    entity.classname = 'target_speaker';
    entity.spawnflags = 1; // LoopedOn

    const spawnFunc = registry.get('target_speaker');
    spawnFunc!(entity, {
      keyValues: { noise: 'world/amb1.wav', volume: '0.8' },
      entities: context.entities,
      health_multiplier: 1,
      warn: vi.fn(),
      free: vi.fn(),
    });

    expect(entity.sounds).toBe(entity.noise_index);
  });

  it('toggles loop state on use', () => {
    const entity = context.entities.spawn();
    entity.classname = 'target_speaker';
    entity.spawnflags = 1; // LoopedOn
    entity.noise_index = 1;

    const spawnFunc = registry.get('target_speaker');
    spawnFunc!(entity, {
      keyValues: { noise: 'world/amb1.wav', volume: '0.8' },
      entities: context.entities,
      health_multiplier: 1,
      warn: vi.fn(),
      free: vi.fn(),
    });

    // Initial state
    expect(entity.spawnflags & 1).toBeTruthy(); // LoopedOn
    expect(entity.sounds).toBe(1);

    // Use to toggle OFF
    entity.use!(entity, null, null);
    expect(entity.spawnflags & 1).toBeFalsy(); // LoopedOn cleared
    expect(entity.spawnflags & 2).toBeTruthy(); // LoopedOff set
    expect(entity.sounds).toBe(0);

    // Use to toggle ON
    entity.use!(entity, null, null);
    expect(entity.spawnflags & 1).toBeTruthy();
    expect(entity.spawnflags & 2).toBeFalsy();
    expect(entity.sounds).toBe(1);
  });

  it('plays one-shot sound on use if not looped', () => {
    const entity = context.entities.spawn();
    entity.classname = 'target_speaker';
    entity.spawnflags = 0; // Not looped
    entity.message = 'world/amb1.wav';
    entity.noise_index = 1;
    entity.volume = 0.8;
    entity.attenuation = 1;

    const spawnFunc = registry.get('target_speaker');
    spawnFunc!(entity, {
      keyValues: { noise: 'world/amb1.wav', volume: '0.8' },
      entities: context.entities,
      health_multiplier: 1,
      warn: vi.fn(),
      free: vi.fn(),
    });

    entity.use!(entity, null, null);

    // Check if entities.sound was called
    expect(context.entities.sound).toHaveBeenCalledWith(
        entity,
        2, // CHAN_VOICE
        'world/amb1.wav',
        0.8,
        1,
        0
    );
  });
});
