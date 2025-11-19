import { Vec3, dotVec3, lengthVec3, normalizeVec3, subtractVec3 } from '@quake2ts/shared';
import { SOUND_FULLVOLUME, attenuationToDistanceMultiplier } from './constants.js';

export interface ListenerState {
  origin: Vec3;
  right: Vec3;
  mono?: boolean;
  playerEntity?: number;
}

export interface SpatializationResult {
  left: number;
  right: number;
  distanceComponent: number;
}

export function spatializeOrigin(
  origin: Vec3,
  listener: ListenerState,
  masterVolume: number,
  attenuation: number,
  isListenerSound: boolean,
): SpatializationResult {
  if (isListenerSound) {
    return { left: masterVolume, right: masterVolume, distanceComponent: 0 };
  }

  const sourceVec = subtractVec3(origin, listener.origin);
  const distance = lengthVec3(sourceVec);
  const normalized = normalizeVec3(sourceVec);
  let dist = distance - SOUND_FULLVOLUME;
  if (dist < 0) dist = 0;
  dist *= attenuationToDistanceMultiplier(attenuation);

  const dot = dotVec3(listener.right, normalized);
  const mono = listener.mono ?? false;
  const rscale = mono || attenuation === 0 ? 1 : 0.5 * (1 + dot);
  const lscale = mono || attenuation === 0 ? 1 : 0.5 * (1 - dot);

  const right = Math.max(0, Math.floor(masterVolume * (1 - dist) * rscale));
  const left = Math.max(0, Math.floor(masterVolume * (1 - dist) * lscale));

  return { left, right, distanceComponent: dist };
}
