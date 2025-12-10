import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioSystem, AudioSystemOptions } from '../../src/audio/system.js';
import { SoundRegistry } from '../../src/audio/registry.js';
import { AudioContextController } from '../../src/audio/context.js';
import { SoundChannel } from '../../src/audio/constants.js';
import { mockAudioContextFactory, MockAudioBufferSourceNode } from './fakes.js';

describe('AudioSystem Playback Rate', () => {
  let context: AudioContextController;
  let registry: SoundRegistry;
  let system: AudioSystem;

  beforeEach(async () => {
    context = new AudioContextController(mockAudioContextFactory);
    registry = new SoundRegistry(context);

    // Create a dummy buffer in registry
    const buffer = context.getContext().createBufferSource().buffer; // Actually this is null in mock unless we set it
    // MockSoundRegistry logic?
    // We can just spy on registry.get
    vi.spyOn(registry, 'get').mockReturnValue({ duration: 1 } as any);

    system = new AudioSystem({
      context,
      registry,
      playerEntity: 1,
    });

    await system.ensureRunning();
  });

  it('should set playback rate on new sounds', () => {
    system.setPlaybackRate(0.5);
    const sound = system.play({
      entity: 1,
      channel: SoundChannel.Weapon,
      soundIndex: 1,
      volume: 255,
      attenuation: 1,
    });

    expect(sound).toBeDefined();
    expect((sound!.source as any).playbackRate.value).toBe(0.5);
  });

  it('should update playback rate on active sounds', () => {
    const sound = system.play({
      entity: 1,
      channel: SoundChannel.Weapon,
      soundIndex: 1,
      volume: 255,
      attenuation: 1,
    });

    expect((sound!.source as any).playbackRate.value).toBe(1.0);

    system.setPlaybackRate(2.0);
    expect((sound!.source as any).playbackRate.value).toBe(2.0);
  });

  it('should mute sounds when rate is not 1.0', () => {
    const sound = system.play({
      entity: 1,
      channel: SoundChannel.Weapon,
      soundIndex: 1,
      volume: 255,
      attenuation: 1,
    });

    // Check initial gain (should be non-zero)
    expect(sound!.gain.gain.value).toBeGreaterThan(0);

    system.setPlaybackRate(0.5);
    expect(sound!.gain.gain.value).toBe(0);

    system.setPlaybackRate(1.0);
    expect(sound!.gain.gain.value).toBeGreaterThan(0);
  });
});
