import { describe, expect, it } from 'vitest';
import {
  ATTN_IDLE,
  ATTN_LOOP_NONE,
  ATTN_NONE,
  ATTN_NORM,
  ATTN_STATIC,
  MAX_SOUND_CHANNELS,
  SOUND_FULLVOLUME,
  SOUND_LOOP_ATTENUATE,
  SoundChannel,
  attenuationToDistanceMultiplier,
  calculateMaxAudibleDistance,
} from '../../src/audio/constants.js';

describe('audio/constants', () => {
  it('defines correct constants', () => {
    expect(MAX_SOUND_CHANNELS).toBe(32);
    expect(ATTN_LOOP_NONE).toBe(-1);
    expect(ATTN_NONE).toBe(0);
    expect(ATTN_NORM).toBe(1);
    expect(ATTN_IDLE).toBe(2);
    expect(ATTN_STATIC).toBe(3);
    expect(SOUND_FULLVOLUME).toBe(80);
    expect(SOUND_LOOP_ATTENUATE).toBe(0.003);
  });

  it('defines correct SoundChannel enum values', () => {
    expect(SoundChannel.Auto).toBe(0);
    expect(SoundChannel.Weapon).toBe(1);
    expect(SoundChannel.Voice).toBe(2);
    expect(SoundChannel.Item).toBe(3);
    expect(SoundChannel.Body).toBe(4);
    expect(SoundChannel.Aux).toBe(5);
    expect(SoundChannel.Footstep).toBe(6);
    expect(SoundChannel.Aux3).toBe(7);

    expect(SoundChannel.NoPhsAdd).toBe(1 << 3);
    expect(SoundChannel.Reliable).toBe(1 << 4);
    expect(SoundChannel.ForcePos).toBe(1 << 5);
  });

  it('calculates attenuationToDistanceMultiplier correctly', () => {
    // For ATTN_STATIC (3), it multiplies by 0.001
    expect(attenuationToDistanceMultiplier(ATTN_STATIC)).toBe(0.003);

    // For others, it multiplies by 0.0005
    expect(attenuationToDistanceMultiplier(ATTN_NORM)).toBe(0.0005);
    expect(attenuationToDistanceMultiplier(ATTN_IDLE)).toBe(0.001); // 2 * 0.0005
    expect(attenuationToDistanceMultiplier(ATTN_NONE)).toBe(0);
  });

  it('calculates calculateMaxAudibleDistance correctly', () => {
    // If distMult <= 0, returns Infinity
    expect(calculateMaxAudibleDistance(ATTN_NONE)).toBe(Number.POSITIVE_INFINITY);

    // Otherwise: SOUND_FULLVOLUME + 1 / distMult
    // Test with ATTN_STATIC
    // distMult = 3 * 0.001 = 0.003
    // result = 80 + 1 / 0.003 = 80 + 333.333... = 413.333...
    expect(calculateMaxAudibleDistance(ATTN_STATIC)).toBeCloseTo(80 + 1 / 0.003);

    // Test with ATTN_NORM
    // distMult = 1 * 0.0005 = 0.0005
    // result = 80 + 1 / 0.0005 = 80 + 2000 = 2080
    expect(calculateMaxAudibleDistance(ATTN_NORM)).toBe(2080);

    // Test with ATTN_IDLE
    // distMult = 2 * 0.0005 = 0.001
    // result = 80 + 1 / 0.001 = 80 + 1000 = 1080
    expect(calculateMaxAudibleDistance(ATTN_IDLE)).toBe(1080);
  });
});
