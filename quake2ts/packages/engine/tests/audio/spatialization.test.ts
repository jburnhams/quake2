import { describe, expect, it } from 'vitest';
import { spatializeOrigin } from '../../src/audio/spatialization.js';
import { ATTN_NONE, ATTN_NORM, SOUND_FULLVOLUME } from '../../src/audio/constants.js';

const LISTENER = { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } };

describe('spatializeOrigin', () => {
  it('matches the rerelease right/left scaling directly from the C implementation', () => {
    const nearRight = spatializeOrigin({ x: SOUND_FULLVOLUME, y: 0, z: 0 }, LISTENER, 255, ATTN_NORM, false);
    expect(nearRight.right).toBe(255);
    expect(nearRight.left).toBe(0);

    const midRight = spatializeOrigin({ x: SOUND_FULLVOLUME * 2, y: 0, z: 0 }, LISTENER, 255, ATTN_NORM, false);
    expect(midRight.right).toBe(244);
    expect(midRight.left).toBe(0);
  });

  it('keeps listener-owned sounds at full volume regardless of distance', () => {
    const listenerSound = spatializeOrigin({ x: 400, y: 400, z: 0 }, LISTENER, 200, ATTN_NORM, true);
    expect(listenerSound.left).toBe(200);
    expect(listenerSound.right).toBe(200);
  });

  it('disables stereo panning when attenuation is none', () => {
    const omnipresent = spatializeOrigin({ x: 500, y: 0, z: 0 }, LISTENER, 128, ATTN_NONE, false);
    expect(omnipresent.left).toBe(128);
    expect(omnipresent.right).toBe(128);
  });
});
