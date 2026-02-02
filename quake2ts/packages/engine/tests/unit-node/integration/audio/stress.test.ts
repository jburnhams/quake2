
import { describe, expect, it, vi } from 'vitest';
import { AudioContextController } from '../../../../src/audio/context.js';
import { SoundRegistry } from '../../../../src/audio/registry.js';
import { AudioSystem } from '../../../../src/audio/system.js';
import { SoundChannel, MAX_SOUND_CHANNELS, ATTN_NORM } from '../../../../src/audio/constants.js';
import { FakeAudioContext, createMockAudioBuffer } from '@quake2ts/test-utils';

describe('AudioSystem Stress Tests', () => {
  it('handles channel stealing when playing more than MAX_SOUND_CHANNELS', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('stress.wav', createMockAudioBuffer(1.0));

    // Create system with enough channels to fill up
    const system = new AudioSystem({ context: controller, registry });

    // Play MAX_SOUND_CHANNELS sounds
    for (let i = 0; i < MAX_SOUND_CHANNELS; i++) {
      system.play({
        entity: i + 1,
        channel: SoundChannel.Auto,
        soundIndex,
        volume: 255,
        attenuation: ATTN_NORM,
      });
    }

    const diagFull = system.getDiagnostics();
    expect(diagFull.activeChannels).toBe(MAX_SOUND_CHANNELS);

    // Play one more sound, which should steal a channel
    // We'll use a new entity to ensure it's not just an override
    system.play({
      entity: MAX_SOUND_CHANNELS + 1,
      channel: SoundChannel.Auto,
      soundIndex,
      volume: 255,
      attenuation: ATTN_NORM,
    });

    const diagAfter = system.getDiagnostics();
    expect(diagAfter.activeChannels).toBe(MAX_SOUND_CHANNELS); // Should stay at max

    // Verify that one of the old ones is gone and the new one is present
    const newSoundPresent = diagAfter.activeSounds.some(s => s.entnum === MAX_SOUND_CHANNELS + 1);
    expect(newSoundPresent).toBe(true);
  });

  it('prioritizes player sounds over distant sounds during stealing', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('stress.wav', createMockAudioBuffer(10.0)); // Long sound

    const playerEntity = 1;
    const system = new AudioSystem({ context: controller, registry, playerEntity });

    // Fill channels with non-player sounds
    for (let i = 0; i < MAX_SOUND_CHANNELS; i++) {
      system.play({
        entity: i + 100, // Non-player entities
        channel: SoundChannel.Auto,
        soundIndex,
        volume: 255,
        attenuation: ATTN_NORM,
      });
    }

    // Now play a player sound
    system.play({
      entity: playerEntity,
      channel: SoundChannel.Weapon,
      soundIndex,
      volume: 255,
      attenuation: ATTN_NORM,
    });

    const diag = system.getDiagnostics();
    const playerSound = diag.activeSounds.find(s => s.entnum === playerEntity);
    expect(playerSound).toBeDefined();

    // Now try to play another non-player sound, it should NOT steal the player sound
    // We force the player sound to be the "oldest" or "least remaining life" candidate if logic was simple
    // But priority logic should protect it.

    // To properly test "protection", we'd need to mock time or ensure player sound is the 'best' candidate for stealing
    // if it weren't protected.
    // pickChannel logic: "skips player sounds" when looking for victims.

    system.play({
      entity: 200,
      channel: SoundChannel.Auto,
      soundIndex,
      volume: 255,
      attenuation: ATTN_NORM,
    });

    const diag2 = system.getDiagnostics();
    // Player sound should still be there
    const playerSoundStillThere = diag2.activeSounds.some(s => s.entnum === playerEntity);
    expect(playerSoundStillThere).toBe(true);
  });

  it('performance: can play 100 sounds sequentially without crashing', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const soundIndex = registry.register('short.wav', createMockAudioBuffer(0.1));
    const system = new AudioSystem({ context: controller, registry });

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
        system.play({
            entity: i,
            channel: SoundChannel.Auto,
            soundIndex,
            volume: 255,
            attenuation: ATTN_NORM
        });
    }
    const end = performance.now();
    // Just ensuring it doesn't throw and finishes reasonably fast (arbitrary check)
    expect(end - start).toBeLessThan(1000);
  });
});
