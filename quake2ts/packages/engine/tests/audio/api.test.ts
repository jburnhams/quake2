import { describe, expect, it, vi } from 'vitest';
import { AudioApi } from '../../src/audio/api.js';
import { AudioContextController } from '../../src/audio/context.js';
import { SoundRegistry } from '../../src/audio/registry.js';
import { AudioSystem } from '../../src/audio/system.js';
import { MusicSystem } from '../../src/audio/music.js';
import { SoundChannel } from '../../src/audio/constants.js';
import { FakeAudioContext, createMockAudioBuffer } from '@quake2ts/test-utils';

const createSystem = () => {
  const context = new FakeAudioContext();
  const controller = new AudioContextController(() => context);
  const registry = new SoundRegistry();
  registry.register('player/pain.wav', createMockAudioBuffer(0.25));
  const system = new AudioSystem({ context: controller, registry, playerEntity: 1 });
  return { context, controller, registry, system };
};

describe('AudioApi', () => {
  it('registers sounds without buffers and routes playback through the audio system', () => {
    const { registry, system } = createSystem();
    const api = new AudioApi({ registry, system });
    const index = api.soundindex('world/ambience/windfly.wav');

    registry.register('world/ambience/windfly.wav', createMockAudioBuffer(0.75));

    expect(index).toBeGreaterThan(0);
    expect(registry.find('world/ambience/windfly.wav')).toBe(index);

    api.sound(1, SoundChannel.Weapon, index, 255, 1, 0);
    expect(system.getChannelState(0)?.active).toBe(true);
  });

  it('supports positioned, looping, and ambient helpers plus entity cleanup', () => {
    const { registry, system } = createSystem();
    const api = new AudioApi({ registry, system });
    const ambientIndex = registry.register('world/wind.wav', createMockAudioBuffer(0.5));

    api.loop_sound(2, SoundChannel.Body, ambientIndex, 200, 1);
    api.positioned_sound({ x: 10, y: 0, z: 0 }, ambientIndex, 200, 1);
    api.play_ambient({ x: 0, y: 0, z: 0 }, ambientIndex, 255);

    expect(system.getChannelState(0)?.active).toBe(true);
    api.stop_entity_sounds(2);
    expect(system.getChannelState(0)?.active).toBe(false);
  });

  it('routes music control to the music system when provided', async () => {
    const { registry, system } = createSystem();
    const music = new MusicSystem({
      createElement: () => ({
        src: '',
        loop: false,
        volume: 1,
        currentTime: 0,
        paused: true,
        ended: false,
        async play() {},
        pause() {},
        load() {},
      }),
    });
    const playSpy = vi.spyOn(music, 'play');
    const pauseSpy = vi.spyOn(music, 'pause');
    const resumeSpy = vi.spyOn(music, 'resume');
    const stopSpy = vi.spyOn(music, 'stop');
    const setVolumeSpy = vi.spyOn(music, 'setVolume');

    const api = new AudioApi({ registry, system, music });
    await api.play_music('media/track1.ogg');
    api.pause_music();
    await api.resume_music();
    api.set_music_volume(0.4);
    api.stop_music();

    expect(playSpy).toHaveBeenCalledWith('media/track1.ogg', { loop: true });
    expect(pauseSpy).toHaveBeenCalled();
    expect(resumeSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
    expect(setVolumeSpy).toHaveBeenCalledWith(0.4);
  });
});
