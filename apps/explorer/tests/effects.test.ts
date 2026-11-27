import { describe, expect, it } from 'vitest';
import { EFFECTS, EFFECT_KEYS, runEffect, type EffectSpot } from '../src/labs/effects/effects';

// The effects lab's simulation: the client's own effects code, fired once and run frame by frame.
const spot: EffectSpot = { origin: [0, 0, 0], normal: [0, 0, 1], from: [-512, 0, 64] };
const options = { seed: 1, gravity: 40, frameMs: 25 };

describe('the effects lab simulation', () => {
  it('draws a rocket explosion as 256 sparks, its model and its light', () => {
    const run = runEffect(EFFECTS.rocket!, spot, 1000, options);
    const first = run.frames[0]!;
    expect(first.particles).toHaveLength(256);
    expect(first.models.length).toBeGreaterThan(0);
    expect(first.lights.length).toBeGreaterThan(0);
    expect(run.drawsToFire).toBeGreaterThan(256);
    // Every spark has faded within a second and a half.
    const later = runEffect(EFFECTS.rocket!, spot, 1500, options);
    expect(later.frames.at(-1)!.particles).toHaveLength(0);
  });

  it('gives a boss teleport only the client’s 4,096 particles', () => {
    const run = runEffect(EFFECTS.boss!, spot, 100, options);
    expect(Math.max(...run.frames.map((f) => f.particles.length))).toBe(4096);
  });

  it('gives the same picture for the same seed, and another for another', () => {
    const a = runEffect(EFFECTS.blaster!, spot, 200, options);
    const b = runEffect(EFFECTS.blaster!, spot, 200, options);
    const c = runEffect(EFFECTS.blaster!, spot, 200, { ...options, seed: 2 });
    expect(b.frames).toEqual(a.frames);
    expect(c.frames[1]!.particles).not.toEqual(a.frames[1]!.particles);
  });

  it('lets gravity pull the sparks down faster', () => {
    const low = (g: number) => {
      const last = runEffect(EFFECTS.rocket!, spot, 500, { ...options, gravity: g }).frames.at(-1)!;
      return last.particles.reduce((sum, p) => sum + p.origin[2], 0) / last.particles.length;
    };
    expect(low(400)).toBeLessThan(low(40));
  });

  it('lays a rocket’s trail as it flies, and stops at the wall', () => {
    const run = runEffect(EFFECTS.rocketTrail!, spot, 1500, options);
    expect(run.frames[0]!.particles).toHaveLength(0);
    expect(Math.max(...run.frames.map((f) => f.particles.length))).toBeGreaterThan(50);
  });

  it('fires every effect the picker lists without throwing', () => {
    for (const key of EFFECT_KEYS) expect(() => runEffect(EFFECTS[key]!, spot, 300, options), key).not.toThrow();
  });
});
