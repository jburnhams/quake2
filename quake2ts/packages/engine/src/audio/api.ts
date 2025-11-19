import { type Vec3 } from '@quake2ts/shared';
import { MusicSystem } from './music.js';
import { SoundRegistry } from './registry.js';
import { AudioSystem, type SoundRequest } from './system.js';

export interface AudioApiOptions {
  registry: SoundRegistry;
  system: AudioSystem;
  music?: MusicSystem;
}

export class AudioApi {
  private readonly registry: SoundRegistry;
  private readonly system: AudioSystem;
  private readonly music?: MusicSystem;

  constructor(options: AudioApiOptions) {
    this.registry = options.registry;
    this.system = options.system;
    this.music = options.music;
  }

  soundindex(name: string): number {
    return this.registry.registerName(name);
  }

  sound(entity: number, channel: number, soundindex: number, volume: number, attenuation: number, timeofs: number): void {
    this.system.play({
      entity,
      channel,
      soundIndex: soundindex,
      volume,
      attenuation,
      timeOffsetMs: timeofs,
    });
  }

  positioned_sound(origin: Vec3, soundindex: number, volume: number, attenuation: number): void {
    this.system.positionedSound(origin, soundindex, volume, attenuation);
  }

  loop_sound(entity: number, channel: number, soundindex: number, volume: number, attenuation: number): void {
    this.system.play({
      entity,
      channel,
      soundIndex: soundindex,
      volume,
      attenuation,
      looping: true,
    });
  }

  stop_entity_sounds(entnum: number): void {
    this.system.stopEntitySounds(entnum);
  }

  set_listener(listener: Parameters<AudioSystem['setListener']>[0]): void {
    this.system.setListener(listener);
  }

  play_music(track: string, loop = true): Promise<void> {
    if (!this.music) {
      return Promise.resolve();
    }
    return this.music.play(track, { loop });
  }

  pause_music(): void {
    this.music?.pause();
  }

  resume_music(): Promise<void> {
    return this.music?.resume() ?? Promise.resolve();
  }

  stop_music(): void {
    this.music?.stop();
  }

  set_music_volume(volume: number): void {
    this.music?.setVolume(volume);
  }

  play_ambient(origin: Vec3, soundindex: number, volume: number): void {
    this.system.ambientSound(origin, soundindex, volume);
  }

  play_channel(request: Omit<SoundRequest, 'looping'>): void {
    this.system.play({ ...request });
  }
}
