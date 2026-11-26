import { EntityState, Vec3 } from '@quake2ts/shared';
import { AudioApi, ActiveSound } from '@quake2ts/engine';
import { ClientConfigStrings } from '../configStrings.js';

interface TrackedSound {
  activeSound: ActiveSound;
  soundIndex: number;
  origin: Vec3;
  volume: number;
  attenuation: number;
  lastUpdateFrame: number;
}

// Minimal interface for EntityState to support both shared and engine types
interface MinimalEntityState {
    number: number;
    sound?: number;
    origin: { x: number, y: number, z: number };
    volume?: number;      // Optional override? Not in standard EntityState but maybe needed?
    attenuation?: number; // Optional override?
}

export class EntitySoundSystem {
  private readonly trackedSounds = new Map<number, TrackedSound>();
  private currentFrame = 0;

  constructor(
    private readonly audio: AudioApi,
    private readonly configStrings: ClientConfigStrings
  ) {}

  update(entities: MinimalEntityState[], nowMs: number) {
    this.currentFrame++;

    for (const ent of entities) {
      if (!ent.sound) continue;

      const entNum = ent.number;
      let tracked = this.trackedSounds.get(entNum);

      // If we have a tracked sound but the sound index changed, stop the old one
      if (tracked && tracked.soundIndex !== ent.sound) {
         this.stopSound(entNum);
         tracked = undefined;
      }

      // Start new sound if needed
      if (!tracked) {
         // Determine attenuation/volume.
         const volume = 1.0;
         const attenuation = 3; // ATTN_STATIC

         // Play sound
         const activeSound = this.audio.loop_sound(
             entNum,
             0, // Auto
             ent.sound,
             volume,
             attenuation
         );

         // We manually set origin if AudioApi doesn't support passing it in loop_sound
         // AudioApi.loop_sound calls play({ ... }).

         if (activeSound) {
             // TODO: Expose update_entity_position on AudioApi to avoid cast
             (this.audio as any).system.updateEntityPosition(entNum, ent.origin);

             tracked = {
                 activeSound,
                 soundIndex: ent.sound,
                 origin: ent.origin,
                 volume,
                 attenuation,
                 lastUpdateFrame: this.currentFrame
             };
             this.trackedSounds.set(entNum, tracked);
         }
      } else {
          // Update existing sound position
          (this.audio as any).system.updateEntityPosition(entNum, ent.origin);
          tracked.lastUpdateFrame = this.currentFrame;
          tracked.origin = ent.origin;
      }
    }

    // Prune sounds that were not updated this frame (entity went out of PVS or stopped loop)
    for (const [entNum, tracked] of this.trackedSounds.entries()) {
        if (tracked.lastUpdateFrame !== this.currentFrame) {
            this.stopSound(entNum);
        }
    }
  }

  private stopSound(entNum: number) {
      const tracked = this.trackedSounds.get(entNum);
      if (tracked) {
          this.audio.stop_entity_sounds(entNum);
          this.trackedSounds.delete(entNum);
      }
  }

  reset() {
      for (const entNum of this.trackedSounds.keys()) {
          this.stopSound(entNum);
      }
      this.trackedSounds.clear();
  }
}
