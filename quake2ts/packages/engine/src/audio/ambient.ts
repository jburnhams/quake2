// Ambient sound system implementation
// Handles looping ambient sounds, 3D spatialization, and auto-restart

import type { AudioSystem } from './system.js';
import type { Vec3 } from '@quake2ts/shared';
import { ATTN_NORM, SoundChannel } from '@quake2ts/shared';

export interface AmbientSound {
  soundIndex: number;
  origin: Vec3;
  volume: number;
  attenuation: number;
  playing: boolean;
  channelIndex?: number;
}

export class AmbientSoundSystem {
  private ambientSounds: AmbientSound[] = [];
  private audio: AudioSystem;

  constructor(audio: AudioSystem) {
    this.audio = audio;
  }

  addAmbient(soundIndex: number, origin: Vec3, volume: number = 1.0, attenuation: number = ATTN_NORM): void {
    const ambient: AmbientSound = {
      soundIndex,
      origin,
      volume,
      attenuation,
      playing: false
    };
    this.ambientSounds.push(ambient);
  }

  update(): void {
    for (const ambient of this.ambientSounds) {
      if (!ambient.playing) {
        // Start playing
        const active = this.audio.play({
            entity: 0, // World entity or specific?
            channel: SoundChannel.Auto,
            soundIndex: ambient.soundIndex,
            volume: ambient.volume,
            attenuation: ambient.attenuation,
            origin: ambient.origin,
            looping: true
        });

        if (active) {
            ambient.playing = true;
            ambient.channelIndex = active.channelIndex;
        }
      } else if (ambient.channelIndex !== undefined) {
         // Check if still playing?
         // Since it is looping, it should be unless stopped or stolen.
         const channelState = this.audio.getChannelState(ambient.channelIndex);
         if (!channelState || !channelState.active) {
             ambient.playing = false;
             ambient.channelIndex = undefined;
         }
      }
    }
  }

  clear(): void {
    for (const ambient of this.ambientSounds) {
        if (ambient.playing && ambient.channelIndex !== undefined) {
            this.audio.stop(ambient.channelIndex);
        }
    }
    this.ambientSounds = [];
  }
}
