export const MAX_SOUND_CHANNELS = 32;

// Sound channel identifiers and flags from the rerelease game headers.
export enum SoundChannel {
  Auto = 0,
  Weapon = 1,
  Voice = 2,
  Item = 3,
  Body = 4,
  Aux = 5,
  Footstep = 6,
  Aux3 = 7,

  NoPhsAdd = 1 << 3,
  Reliable = 1 << 4,
  ForcePos = 1 << 5,
}

export const ATTN_LOOP_NONE = -1;
export const ATTN_NONE = 0;
export const ATTN_NORM = 1;
export const ATTN_IDLE = 2;
export const ATTN_STATIC = 3;

export const SOUND_FULLVOLUME = 80;
export const SOUND_LOOP_ATTENUATE = 0.003;

export function attenuationToDistanceMultiplier(attenuation: number): number {
  return attenuation * 0.001;
}

export function calculateMaxAudibleDistance(attenuation: number): number {
  const distMult = attenuationToDistanceMultiplier(attenuation);
  return distMult <= 0 ? Number.POSITIVE_INFINITY : SOUND_FULLVOLUME + 1 / distMult;
}
