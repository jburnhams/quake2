import { describe, expect, it } from 'vitest';
import { mixScene, silentPast, sourceAt, type SoundScene } from '../src/labs/sound/sound';

// The sound lab's simulation: a sound played to a listener through the client's own mixer.
/** A mono 16-bit WAV at 22,050 Hz. */
function wav(samples: number[]): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const dv = new DataView(out.buffer);
  const tag = (at: number, s: string) => [...s].forEach((c, i) => (out[at + i] = c.charCodeAt(0)));
  tag(0, 'RIFF');
  dv.setInt32(4, 36 + samples.length * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  dv.setInt32(16, 16, true);
  dv.setInt16(20, 1, true);
  dv.setInt16(22, 1, true);
  dv.setInt32(24, 22050, true);
  dv.setInt32(28, 44100, true);
  dv.setInt16(32, 2, true);
  dv.setInt16(34, 16, true);
  tag(36, 'data');
  dv.setInt32(40, samples.length * 2, true);
  samples.forEach((s, i) => dv.setInt16(44 + i * 2, s, true));
  return out;
}

const tone = wav(Array.from({ length: 11025 }, (_, i) => Math.round(Math.sin(i / 4) * 20000)));
const scene: SoundScene = { wav: tone, distance: 300, bearing: 90, path: 'still', attenuation: 1, volume: 1, master: 0.7, eightBit: true, seconds: 1, frameMs: 25 };
const energy = (s: Int16Array) => s.reduce((n, v) => n + Math.abs(v), 0);

describe('the sound lab simulation', () => {
  it('writes a second of stereo at the card’s 22,050 pairs a second', () => {
    const mix = mixScene(scene);
    expect(mix.rate).toBe(22050);
    expect(mix.left).toHaveLength(22050);
    expect(mix.stored).toEqual({ samples: 11025, width: 1, sourceRate: 22050, sourceWidth: 2 });
  });

  it('puts a sound on the left in the left ear', () => {
    const mix = mixScene(scene);
    const f = mix.frames[4]!;
    expect(f.left).toBeGreaterThan(f.right);
    expect(energy(mix.left)).toBeGreaterThan(energy(mix.right) * 2);
  });

  it('plays it again when it ends, so a half-second sound fills the second', () => {
    const mix = mixScene(scene);
    expect(mix.frames.filter((f) => f.started).length).toBe(2);
    expect(energy(mix.left.subarray(16000))).toBeGreaterThan(0);
  });

  it('fades it with distance until it is silent', () => {
    const near = mixScene({ ...scene, distance: 100 }).frames[4]!;
    const far = mixScene({ ...scene, distance: 1500 }).frames[4]!;
    expect(far.left).toBeLessThan(near.left);
    expect(silentPast(1)).toBe(2080);
    expect(silentPast(0)).toBeNull();
    const gone = mixScene({ ...scene, distance: 2100 });
    expect(energy(gone.left) + energy(gone.right)).toBe(0);
  });

  it('pans nothing without attenuation', () => {
    const f = mixScene({ ...scene, attenuation: 0 }).frames[4]!;
    expect(f.left).toBe(f.right);
  });

  it('takes a sound round the listener once on the round path', () => {
    expect(sourceAt({ ...scene, path: 'round' }, 500)[1]).toBeCloseTo(-300, 0);
    const mix = mixScene({ ...scene, path: 'round' });
    const at = (ms: number) => mix.frames.find((f) => f.timeMs === ms)!;
    expect(at(0).left).toBeGreaterThan(at(0).right);
    expect(at(500).right).toBeGreaterThan(at(500).left);
  });

  it('is quieter with the player’s volume turned down', () => {
    expect(energy(mixScene({ ...scene, master: 0.2 }).left)).toBeLessThan(energy(mixScene(scene).left));
  });
});
