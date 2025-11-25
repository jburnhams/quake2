import { type Vec3 } from '@quake2ts/shared';
import { MusicSystem } from './music.js';
import { SoundRegistry } from './registry.js';
import { AudioSystem, type SoundRequest } from './system.js';

export interface SubtitleClient {
  showSubtitle(text: string, soundName: string): void;
}

export interface AudioApiOptions {
  registry: SoundRegistry;
  system: AudioSystem;
  music?: MusicSystem;
  client?: SubtitleClient;
}

export class AudioApi {
  private readonly registry: SoundRegistry;
  private readonly system: AudioSystem;
  private readonly music?: MusicSystem;
  private readonly client?: SubtitleClient;

  constructor(options: AudioApiOptions) {
    this.registry = options.registry;
    this.system = options.system;
    this.music = options.music;
    this.client = options.client;
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
    this.triggerSubtitle(soundindex);
  }

  positioned_sound(origin: Vec3, soundindex: number, volume: number, attenuation: number): void {
    this.system.positionedSound(origin, soundindex, volume, attenuation);
    this.triggerSubtitle(soundindex);
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
    this.triggerSubtitle(soundindex);
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
    this.triggerSubtitle(soundindex);
  }

  play_channel(request: Omit<SoundRequest, 'looping'>): void {
    this.system.play({ ...request });
    this.triggerSubtitle(request.soundIndex);
  }

  private triggerSubtitle(soundIndex: number) {
    if (!this.client) return;

    const soundName = this.registry.getName(soundIndex);
    if (!soundName) return;

    // Simple heuristic for now: if a sound has a subtitle, it's probably dialogue.
    // We can make this more robust later with a dedicated subtitle data file.
    const dialogueMatch = soundName.match(/\[(.*?)\]/);
    if (dialogueMatch) {
      this.client.showSubtitle(dialogueMatch[1], soundName);
    }
  }
}
