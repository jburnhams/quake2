
import { describe, expect, it, vi } from 'vitest';
import { AudioContextController } from '../../../src/audio/context.js';
import { SoundRegistry } from '../../../src/audio/registry.js';
import { AudioSystem } from '../../../src/audio/system.js';
import { SoundChannel, ATTN_NORM } from '../../../src/audio/constants.js';
import { FakeAudioContext, createMockAudioBuffer } from '@quake2ts/test-utils';
import { MusicSystem } from '../../../src/audio/music.js';
import { AudioApi } from '../../../src/audio/api.js';

describe('AudioApi', () => {
  it('registers sounds via soundindex', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const system = new AudioSystem({ context: controller, registry });
    const api = new AudioApi({ registry, system });

    const index = api.soundindex('test.wav');
    expect(index).toBeDefined();
    expect(registry.find('test.wav')).toBe(index);
  });

  it('delegates sound playback to system', () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const index = registry.register('test.wav', createMockAudioBuffer(1));
    const system = new AudioSystem({ context: controller, registry });
    const api = new AudioApi({ registry, system });

    api.sound(1, SoundChannel.Weapon, index, 255, ATTN_NORM, 0);
    expect(fakeContext.sources.length).toBe(1);
  });

  it('plays music via music system', async () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const system = new AudioSystem({ context: controller, registry });
    const music = new MusicSystem({
      createElement: () => ({
        src: '',
        loop: false,
        volume: 1,
        currentTime: 0,
        paused: true,
        ended: false,
        play: async () => {},
        pause: () => {},
        load: () => {},
      }),
    });
    const api = new AudioApi({ registry, system, music });
    const spy = vi.spyOn(music, 'play');

    await api.play_music('track01');
    expect(spy).toHaveBeenCalledWith('track01', { loop: true });
  });
});
