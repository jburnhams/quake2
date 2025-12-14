import type { Vec3 } from '@quake2ts/shared';
import type { AudioSystem, ActiveSound } from './system.js';
import { ATTN_IDLE, ATTN_STATIC } from './constants.js';

export interface AmbientSound {
  origin: Vec3;
  soundIndex: number;
  volume: number;
  attenuation: number;
  activeSound?: ActiveSound;
}

export class AmbientSoundSystem {
  private readonly sounds = new Map<number, AmbientSound>();
  private nextId = 1;
  private readonly audioSystem: AudioSystem;

  constructor(audioSystem: AudioSystem) {
    this.audioSystem = audioSystem;
  }

  addSound(origin: Vec3, soundIndex: number, volume: number, attenuation: number): number {
    const id = this.nextId++;
    const sound: AmbientSound = {
      origin,
      soundIndex,
      volume,
      attenuation,
    };

    // Only play if attenuation is not ATTN_STATIC (which is handled by server-side logic usually?)
    // Actually, in Q2, ambient sounds are usually looped.

    this.startSound(sound);
    this.sounds.set(id, sound);
    return id;
  }

  removeSound(id: number): void {
    const sound = this.sounds.get(id);
    if (sound) {
      this.stopSound(sound);
      this.sounds.delete(id);
    }
  }

  clear(): void {
    for (const sound of this.sounds.values()) {
      this.stopSound(sound);
    }
    this.sounds.clear();
  }

  update(): void {
    // Check if sounds are still playing, restart if needed (though loop=true should handle it)
    for (const sound of this.sounds.values()) {
        if (!sound.activeSound) {
             this.startSound(sound);
        }
    }
  }

  private startSound(sound: AmbientSound): void {
    if (sound.activeSound) return;

    sound.activeSound = this.audioSystem.play({
        entity: 0, // World entity or 0?
        channel: 0, // Auto
        soundIndex: sound.soundIndex,
        volume: sound.volume,
        attenuation: sound.attenuation,
        origin: sound.origin,
        looping: true
    });
  }

  private stopSound(sound: AmbientSound): void {
    if (sound.activeSound) {
        this.audioSystem.stop(sound.activeSound.channelIndex);
        sound.activeSound = undefined;
    }
  }
}
